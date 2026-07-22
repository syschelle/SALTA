import { randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export type AuthMethod = "session" | "basic";

export interface AuthenticatedSession {
  id: string;
  username: string;
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
}

interface RateBucket {
  startedAt: number;
  count: number;
}

interface LoginState {
  windowStartedAt: number;
  failures: number;
  blockedUntil: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

const SESSION_COOKIE = "salta_session";

export function safeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    try { cookies[name] = decodeURIComponent(rawValue); }
    catch { cookies[name] = rawValue; }
  }
  return cookies;
}

export function sessionCookieName(): string { return SESSION_COOKIE; }

export function createSessionCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  const secureAttribute = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secureAttribute}`;
}

export function clearSessionCookie(secure: boolean): string {
  const secureAttribute = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureAttribute}`;
}

function ipv4ToNumber(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    value = ((value << 8) | octet) >>> 0;
  }
  return value >>> 0;
}

function normalizeIp(address: string): string {
  const trimmed = address.trim().toLowerCase();
  return trimmed.startsWith("::ffff:") ? trimmed.slice(7) : trimmed;
}

function matchesIpv4Cidr(address: string, cidr: string): boolean {
  const [networkAddress, prefixRaw] = cidr.split("/");
  if (!networkAddress) return false;
  const addressNumber = ipv4ToNumber(address);
  const networkNumber = ipv4ToNumber(networkAddress);
  if (addressNumber === null || networkNumber === null) return false;
  const prefix = prefixRaw === undefined ? 32 : Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (addressNumber & mask) === (networkNumber & mask);
}

function matchesIpv6LocalRange(address: string, cidr: string): boolean {
  const normalizedCidr = cidr.toLowerCase();
  if (normalizedCidr === "::1" || normalizedCidr === "::1/128") return address === "::1";
  if (normalizedCidr === "fc00::/7") return address.startsWith("fc") || address.startsWith("fd");
  if (normalizedCidr === "fe80::/10") return /^fe[89ab]/.test(address);
  if (!normalizedCidr.includes("/")) return address === normalizedCidr;
  return false;
}

export function isIpInNetworks(rawAddress: string, networks: readonly string[]): boolean {
  const address = normalizeIp(rawAddress);
  const version = isIP(address);
  if (version === 0) return false;
  return networks.some((rawNetwork) => {
    const network = rawNetwork.trim().toLowerCase();
    if (!network) return false;
    return version === 4 ? matchesIpv4Cidr(address, network) : matchesIpv6LocalRange(address, network);
  });
}

export class SecurityManager {
  private readonly sessions = new Map<string, AuthenticatedSession>();
  private readonly rateBuckets = new Map<string, RateBucket>();
  private readonly loginStates = new Map<string, LoginState>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(private readonly sessionTtlMs: number, private readonly maxSessions = 100) {
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    this.cleanupTimer.unref();
  }

  close(): void { clearInterval(this.cleanupTimer); }

  createSession(username: string): { token: string; session: AuthenticatedSession } {
    this.cleanup();
    while (this.sessions.size >= this.maxSessions) {
      const oldest = this.sessions.keys().next().value as string | undefined;
      if (!oldest) break;
      this.sessions.delete(oldest);
    }
    const token = randomBytes(32).toString("base64url");
    const now = Date.now();
    const session: AuthenticatedSession = {
      id: randomBytes(16).toString("base64url"),
      username,
      csrfToken: randomBytes(32).toString("base64url"),
      createdAt: now,
      expiresAt: now + this.sessionTtlMs
    };
    this.sessions.set(token, session);
    return { token, session };
  }

  getSession(cookieHeader: string | undefined): { token: string; session: AuthenticatedSession } | null {
    const token = parseCookies(cookieHeader)[SESSION_COOKIE];
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return { token, session };
  }

  destroySession(token: string | undefined): void {
    if (token) this.sessions.delete(token);
  }

  consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    if (!this.rateBuckets.has(key) && this.rateBuckets.size >= 10_000) {
      const oldest = this.rateBuckets.keys().next().value as string | undefined;
      if (oldest) this.rateBuckets.delete(oldest);
    }
    const bucket = this.rateBuckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      this.rateBuckets.set(key, { startedAt: now, count: 1 });
      return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000), remaining: Math.max(0, limit - 1) };
    }
    bucket.count += 1;
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000));
    return { allowed: bucket.count <= limit, retryAfterSeconds, remaining: Math.max(0, limit - bucket.count) };
  }

  loginAllowed(ip: string, maxAttempts: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const state = this.loginStates.get(ip);
    if (!state) return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts };
    if (state.blockedUntil > now) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((state.blockedUntil - now) / 1000)), remaining: 0 };
    }
    if (now - state.windowStartedAt >= windowMs) {
      this.loginStates.delete(ip);
      return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts };
    }
    return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, maxAttempts - state.failures) };
  }

  recordLoginFailure(ip: string, maxAttempts: number, windowMs: number, blockMs: number): LoginState {
    const now = Date.now();
    if (!this.loginStates.has(ip) && this.loginStates.size >= 10_000) {
      const oldest = this.loginStates.keys().next().value as string | undefined;
      if (oldest) this.loginStates.delete(oldest);
    }
    const existing = this.loginStates.get(ip);
    const state = !existing || now - existing.windowStartedAt >= windowMs
      ? { windowStartedAt: now, failures: 0, blockedUntil: 0 }
      : existing;
    state.failures += 1;
    if (state.failures >= maxAttempts) state.blockedUntil = now + blockMs;
    this.loginStates.set(ip, state);
    return state;
  }

  clearLoginFailures(ip: string): void { this.loginStates.delete(ip); }

  private cleanup(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions) if (session.expiresAt <= now) this.sessions.delete(token);
    for (const [key, bucket] of this.rateBuckets) if (now - bucket.startedAt > 10 * 60_000) this.rateBuckets.delete(key);
    for (const [ip, state] of this.loginStates) if (state.blockedUntil <= now && now - state.windowStartedAt > 60 * 60_000) this.loginStates.delete(ip);
  }
}
