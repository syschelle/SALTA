import { describe, expect, it } from "vitest";
import { createSessionCookie, isIpInNetworks, parseCookies, SecurityManager } from "./security.js";

describe("security helpers", () => {
  it("matches private IPv4 and local IPv6 ranges", () => {
    const networks = ["127.0.0.0/8", "192.168.0.0/16", "fc00::/7", "::1/128"];
    expect(isIpInNetworks("127.0.0.1", networks)).toBe(true);
    expect(isIpInNetworks("::ffff:192.168.1.10", networks)).toBe(true);
    expect(isIpInNetworks("fd00::10", networks)).toBe(true);
    expect(isIpInNetworks("203.0.113.10", networks)).toBe(false);
  });

  it("creates opaque sessions and expires them", () => {
    const manager = new SecurityManager(60_000);
    const { token, session } = manager.createSession("admin");
    const cookie = createSessionCookie(token, 60, false);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(manager.getSession(cookie)?.session.csrfToken).toBe(session.csrfToken);
    manager.destroySession(token);
    expect(manager.getSession(cookie)).toBeNull();
    manager.close();
  });

  it("parses cookie values without throwing on malformed encoding", () => {
    expect(parseCookies("one=1; broken=%E0%A4%A; two=2")).toMatchObject({ one: "1", two: "2" });
  });
});
