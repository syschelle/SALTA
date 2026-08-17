import { createHash, randomBytes } from "node:crypto";
import { request as httpRequest, type IncomingHttpHeaders, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { getFritzBoxPresenceConnection, listPresenceTargets, writeSystemLog } from "./db.js";
import type { Device, FritzBoxPresenceStatus, PresenceTarget, SystemLogLevel } from "./types.js";
import type { DeviceRegistry } from "./registry.js";

const serviceType = "urn:dslforum-org:service:Hosts:1";
const requestTimeoutMs = 10_000;
const defaultBaseUrl = "http://fritz.box:49000";
const houseDeviceId = "presence:house";

type DigestChallenge = { realm: string; nonce: string; algorithm: string; qop?: string; opaque?: string };
type ContentAuthChallenge = { realm: string; nonce: string; status?: string };
type HostEntry = { active: boolean; ipAddress?: string; interfaceType?: string; hostName?: string };

function now(): string { return new Date().toISOString(); }
function xmlEscape(value: string): string { return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }
function xmlUnescape(value: string): string { return value.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&"); }
function xmlValue(xml: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const match = new RegExp(`<(?:(?:[A-Za-z0-9_-]+):)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?${escaped}>`,"i").exec(xml);
  return match ? xmlUnescape(match[1]!.trim()) : undefined;
}

export function normalizeFritzBoxBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return defaultBaseUrl;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let parsed: URL;
  try { parsed = new URL(candidate); } catch { throw new Error("FRITZBOX_URL_INVALID"); }
  if (!["http:","https:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("FRITZBOX_URL_INVALID");
  if (parsed.pathname !== "/" && parsed.pathname !== "") throw new Error("FRITZBOX_URL_INVALID");
  if (!parsed.port) parsed.port = parsed.protocol === "https:" ? "49443" : "49000";
  parsed.pathname = "";
  return parsed.toString().replace(/\/$/,"");
}

export function normalizePresenceMac(value: string): string {
  const compact = value.trim().replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(compact)) throw new Error("PRESENCE_MAC_INVALID");
  return compact.match(/.{2}/g)!.join(":");
}

function digestAttributes(input: string): Record<string,string> {
  const result: Record<string,string> = {};
  let index = 0;
  while (index < input.length) {
    while (index < input.length && (input[index] === "," || /\s/.test(input[index]!))) index += 1;
    const start = index;
    while (index < input.length && /[A-Za-z0-9_-]/.test(input[index]!)) index += 1;
    const key = input.slice(start,index).toLowerCase();
    while (index < input.length && /\s/.test(input[index]!)) index += 1;
    if (!key || input[index] !== "=") { while (index < input.length && input[index] !== ",") index += 1; continue; }
    index += 1; while (index < input.length && /\s/.test(input[index]!)) index += 1;
    let value = "";
    if (input[index] === '"') {
      index += 1;
      while (index < input.length && input[index] !== '"') { if (input[index] === "\\" && index + 1 < input.length) index += 1; value += input[index] ?? ""; index += 1; }
      if (input[index] === '"') index += 1;
    } else {
      const valueStart = index; while (index < input.length && input[index] !== "," && !/\s/.test(input[index]!)) index += 1; value = input.slice(valueStart,index);
    }
    result[key] = value;
  }
  return result;
}
function parseDigestChallenge(value: string | null): DigestChallenge | undefined {
  if (!value?.toLowerCase().startsWith("digest ")) return undefined;
  const attributes = digestAttributes(value.slice(7));
  if (!attributes.realm || !attributes.nonce) return undefined;
  return { realm: attributes.realm, nonce: attributes.nonce, algorithm: attributes.algorithm ?? "MD5", qop: attributes.qop, opaque: attributes.opaque };
}
function digestHash(algorithm: string, value: string): string {
  const normalized = algorithm.toUpperCase().replace(/-SESS$/,"");
  const nodeAlgorithm = normalized === "SHA-256" ? "sha256" : normalized === "MD5" ? "md5" : undefined;
  if (!nodeAlgorithm) throw new Error("FRITZBOX_AUTHENTICATION_FAILED");
  return createHash(nodeAlgorithm).update(value).digest("hex");
}
function quoteDigest(value: string): string { return value.replace(/\\/g,"\\\\").replace(/"/g,'\\"'); }
function digestAuthHeader(challenge: DigestChallenge, username: string, password: string, method: string, url: string): string {
  const parsed = new URL(url); const uri = `${parsed.pathname}${parsed.search}`; const cnonce = randomBytes(16).toString("hex"); const nc = "00000001";
  const offered = challenge.qop?.split(",").map(value=>value.trim().toLowerCase()); const qop = offered?.includes("auth") ? "auth" : undefined;
  let ha1 = digestHash(challenge.algorithm,`${username}:${challenge.realm}:${password}`);
  if (challenge.algorithm.toUpperCase().endsWith("-SESS")) ha1 = digestHash(challenge.algorithm,`${ha1}:${challenge.nonce}:${cnonce}`);
  const ha2 = digestHash(challenge.algorithm,`${method}:${uri}`);
  const response = qop ? digestHash(challenge.algorithm,`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : digestHash(challenge.algorithm,`${ha1}:${challenge.nonce}:${ha2}`);
  const fields = [`username="${quoteDigest(username)}"`,`realm="${quoteDigest(challenge.realm)}"`,`nonce="${quoteDigest(challenge.nonce)}"`,`uri="${quoteDigest(uri)}"`,`response="${response}"`,`algorithm=${challenge.algorithm}`];
  if (challenge.opaque) fields.push(`opaque="${quoteDigest(challenge.opaque)}"`); if (qop) fields.push(`qop=${qop}`,`nc=${nc}`,`cnonce="${cnonce}"`); return `Digest ${fields.join(", ")}`;
}

function soapEnvelope(action: string, args: Record<string,string>, headerXml = ""): string {
  const argumentsXml = Object.entries(args).map(([key,value])=>`<${key}>${xmlEscape(value)}</${key}>`).join("");
  const header = headerXml ? `<s:Header>${headerXml}</s:Header>` : "";
  return `<?xml version="1.0" encoding="utf-8"?><s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">${header}<s:Body><u:${action} xmlns:u="${serviceType}">${argumentsXml}</u:${action}></s:Body></s:Envelope>`;
}

function contentAuthInitHeader(username: string): string {
  return `<h:InitChallenge xmlns:h="http://soap-authentication.org/digest/2001/10/" s:mustUnderstand="1"><UserID>${xmlEscape(username)}</UserID></h:InitChallenge>`;
}

function contentAuthDigest(username: string, password: string, realm: string, nonce: string): string {
  // FRITZ! TR-064 SOAP content-level authentication explicitly specifies
  // response = MD5(secret + ":" + nonce) and
  // secret = MD5(username + ":" + realm + ":" + password). Reuse the same
  // protocol digest helper used for HTTP Digest rather than maintaining direct
  // MD5 crypto calls in the content-authentication path. This is protocol
  // interoperability only; SALTA never stores passwords with MD5.
  const secret = digestHash("MD5",`${username}:${realm}:${password}`);
  return digestHash("MD5",`${secret}:${nonce}`);
}

function contentAuthClientHeader(username: string, password: string, challenge: ContentAuthChallenge): string {
  const auth = contentAuthDigest(username,password,challenge.realm,challenge.nonce);
  return `<h:ClientAuth xmlns:h="http://soap-authentication.org/digest/2001/10/" s:mustUnderstand="1"><Nonce>${xmlEscape(challenge.nonce)}</Nonce><Auth>${auth}</Auth><UserID>${xmlEscape(username)}</UserID><Realm>${xmlEscape(challenge.realm)}</Realm></h:ClientAuth>`;
}

function contentAuthChallenge(xml: string): ContentAuthChallenge | undefined {
  if (!/<(?:(?:[A-Za-z0-9_-]+):)?Challenge(?:\s|>)/i.test(xml)) return undefined;
  const nonce = xmlValue(xml,"Nonce");
  const realm = xmlValue(xml,"Realm");
  if (!nonce || !realm) return undefined;
  return { nonce, realm, status: xmlValue(xml,"Status") };
}

type SoapHttpResponse = { status: number; headers: IncomingHttpHeaders; text: string };

const hostsControlUrlCache = new Map<string,{url:string;expiresAt:number}>();

function headerValue(headers: IncomingHttpHeaders, name: string): string | null {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function transportError(error: unknown): Error {
  if (error instanceof Error && error.message === "FRITZBOX_TIMEOUT") return error;
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as {code?:unknown}).code ?? "") : "";
  if (["DEPTH_ZERO_SELF_SIGNED_CERT","SELF_SIGNED_CERT_IN_CHAIN","UNABLE_TO_VERIFY_LEAF_SIGNATURE","CERT_HAS_EXPIRED","ERR_TLS_CERT_ALTNAME_INVALID"].includes(code)) return new Error("FRITZBOX_TLS_CERTIFICATE");
  if (["ECONNREFUSED","ECONNRESET","EHOSTUNREACH","ENETUNREACH","ENOTFOUND","EAI_AGAIN","ETIMEDOUT"].includes(code)) return new Error("FRITZBOX_UNREACHABLE");
  return error instanceof Error ? error : new Error("FRITZBOX_UNREACHABLE");
}

async function executeSoapRequest(url: string, headers: Record<string,string>, body: string, tlsInsecure: boolean): Promise<SoapHttpResponse> {
  const target = new URL(url);
  // FRITZ!OS TR-064 SOAP endpoints expect a concrete Content-Length. Without
  // it Node.js sends the request body with Transfer-Encoding: chunked, which
  // some FRITZ!OS versions reject with HTTP 411 (Length Required). Calculate
  // the byte length of the UTF-8 XML payload explicitly for every SOAP retry,
  // including Digest and content-level authentication requests.
  const requestHeaders: Record<string,string> = {
    ...headers,
    "content-length": String(Buffer.byteLength(body,"utf8")),
    "user-agent": "SALTA TR-064 Client",
    connection: "close"
  };
  return new Promise((resolve,reject)=>{
    let settled=false;
    const onResponse=(response: IncomingMessage)=>{
      const chunks: Buffer[]=[];
      response.on("data",chunk=>chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)));
      response.on("end",()=>{
        if(settled)return; settled=true; clearTimeout(timer);
        resolve({status:response.statusCode??0,headers:response.headers,text:Buffer.concat(chunks).toString("utf8")});
      });
    };
    const request=target.protocol === "https:"
      ? httpsRequest(target,{method:"POST",headers:requestHeaders,rejectUnauthorized:!tlsInsecure},onResponse)
      : httpRequest(target,{method:"POST",headers:requestHeaders},onResponse);
    const timer=setTimeout(()=>{if(settled)return;settled=true;request.destroy(new Error("FRITZBOX_TIMEOUT"));reject(new Error("FRITZBOX_TIMEOUT"));},requestTimeoutMs);
    request.on("error",error=>{if(settled)return;settled=true;clearTimeout(timer);reject(transportError(error));});
    request.write(body); request.end();
  });
}

async function executeDescriptionRequest(url: string, tlsInsecure: boolean): Promise<SoapHttpResponse> {
  const target = new URL(url);
  return new Promise((resolve,reject)=>{
    let settled=false;
    const onResponse=(response: IncomingMessage)=>{
      const chunks: Buffer[]=[];
      response.on("data",chunk=>chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)));
      response.on("end",()=>{
        if(settled)return; settled=true; clearTimeout(timer);
        resolve({status:response.statusCode??0,headers:response.headers,text:Buffer.concat(chunks).toString("utf8")});
      });
    };
    const options={method:"GET",headers:{accept:"text/xml, application/xml;q=0.9, */*;q=0.1","user-agent":"SALTA TR-064 Client"}};
    const request=target.protocol === "https:"
      ? httpsRequest(target,{...options,rejectUnauthorized:!tlsInsecure},onResponse)
      : httpRequest(target,options,onResponse);
    const timer=setTimeout(()=>{if(settled)return;settled=true;request.destroy(new Error("FRITZBOX_TIMEOUT"));reject(new Error("FRITZBOX_TIMEOUT"));},requestTimeoutMs);
    request.on("error",error=>{if(settled)return;settled=true;clearTimeout(timer);reject(transportError(error));});
    request.end();
  });
}

function hostsControlUrlFromDescription(baseUrl: string, xml: string): string | undefined {
  const normalizedBaseUrl=normalizeFritzBoxBaseUrl(baseUrl);
  for(const match of xml.matchAll(/<(?:(?:[A-Za-z0-9_-]+):)?service(?:\s[^>]*)?>([\s\S]*?)<\/(?:(?:[A-Za-z0-9_-]+):)?service>/gi)) {
    const block=match[1]??"";
    if(xmlValue(block,"serviceType")!==serviceType) continue;
    const controlUrl=xmlValue(block,"controlURL");
    if(!controlUrl) continue;
    try {
      const resolved=new URL(controlUrl,`${normalizedBaseUrl}/`);
      const base=new URL(normalizedBaseUrl);
      if(resolved.origin!==base.origin) return undefined;
      return resolved.toString();
    } catch { return undefined; }
  }
  return undefined;
}

async function resolveHostsControlUrl(baseUrl: string, tlsInsecure: boolean): Promise<string> {
  const normalizedBaseUrl=normalizeFritzBoxBaseUrl(baseUrl);
  const cacheKey=`${normalizedBaseUrl}\u0000${tlsInsecure?"insecure":"verify"}`;
  const cached=hostsControlUrlCache.get(cacheKey);
  if(cached&&cached.expiresAt>Date.now()) return cached.url;
  const fallback=`${normalizedBaseUrl}/upnp/control/hosts`;
  try {
    const description=await executeDescriptionRequest(`${normalizedBaseUrl}/tr64desc.xml`,tlsInsecure);
    if(description.status>=200&&description.status<300) {
      const discovered=hostsControlUrlFromDescription(normalizedBaseUrl,description.text);
      if(discovered) {
        hostsControlUrlCache.set(cacheKey,{url:discovered,expiresAt:Date.now()+10*60_000});
        return discovered;
      }
    }
  } catch {
    // Discovery is a robustness aid. Preserve compatibility with boxes that do
    // not expose the description on the selected transport by falling back to
    // the canonical Hosts control path. The SOAP request will report the actual
    // transport error if the endpoint itself is not reachable.
  }
  hostsControlUrlCache.set(cacheKey,{url:fallback,expiresAt:Date.now()+60_000});
  return fallback;
}

async function requestSoap(baseUrl: string, username: string, password: string, action: string, args: Record<string,string> = {}, tlsInsecure = false): Promise<string> {
  const url = await resolveHostsControlUrl(baseUrl,tlsInsecure);
  const effectiveUsername = username.trim();
  const execute = (body: string, authorization?: string) => executeSoapRequest(url,{"content-type":"text/xml; charset=utf-8",soapaction:`"${serviceType}#${action}"`,...(authorization?{authorization}:{})},body,tlsInsecure);
  const normalBody = soapEnvelope(action,args);

  // Hosts:GetHostNumberOfEntries and Hosts:GetSpecificHostEntry require no
  // FRITZ!Box user rights according to the current AVM/FRITZ! TR-064 Hosts
  // specification. Always try the plain request first, even when credentials
  // are configured. Authentication is only negotiated when the box actually
  // asks for it. This prevents valid no-auth Hosts calls from being broken by
  // an unnecessary InitChallenge/ClientAuth exchange.
  let response = await execute(normalBody);

  const retryWithConfiguredAuthentication = async (): Promise<boolean> => {
    if(!effectiveUsername) return false;

    const digestChallenge=parseDigestChallenge(headerValue(response.headers,"www-authenticate"));
    if((response.status===401||response.status===403)&&digestChallenge) {
      response=await execute(normalBody,digestAuthHeader(digestChallenge,effectiveUsername,password,"POST",url));
      return true;
    }

    let challenge=contentAuthChallenge(response.text);
    if(!challenge) {
      const initialFaultCode=xmlValue(response.text,"errorCode");
      const initialFaultDescription=xmlValue(response.text,"errorDescription")??"";
      const shouldStartContentAuth=response.status===401||response.status===403||response.status===503||(initialFaultCode==="503"&&/auth/i.test(initialFaultDescription));
      if(shouldStartContentAuth) {
        const initResponse=await execute(soapEnvelope(action,args,contentAuthInitHeader(effectiveUsername)));
        challenge=contentAuthChallenge(initResponse.text);
        if(!challenge) { response=initResponse; return true; }
        response=await execute(soapEnvelope(action,args,contentAuthClientHeader(effectiveUsername,password,challenge)));
        return true;
      }
      return false;
    }

    response=await execute(soapEnvelope(action,args,contentAuthClientHeader(effectiveUsername,password,challenge)));
    return true;
  };

  const initialFaultCode=xmlValue(response.text,"errorCode");
  const initialFaultDescription=xmlValue(response.text,"errorDescription")??"";
  const initialChallenge=contentAuthChallenge(response.text);
  const authenticationRequested=response.status===401||response.status===403||Boolean(initialChallenge)||(initialFaultCode==="503"&&/auth/i.test(initialFaultDescription));
  if(authenticationRequested) await retryWithConfiguredAuthentication();

  const text = response.text;
  const faultCode = xmlValue(text,"errorCode");
  const faultDescription = xmlValue(text,"errorDescription") ?? "";
  const challenge = contentAuthChallenge(text);

  if (challenge?.status?.toLowerCase() === "unauthenticated" || faultCode === "503" && /auth/i.test(faultDescription)) {
    throw new Error(effectiveUsername ? "FRITZBOX_AUTHENTICATION_FAILED" : "FRITZBOX_AUTHENTICATION_REQUIRED");
  }
  if (faultCode === "606") throw new Error("FRITZBOX_AUTHORIZATION_FAILED");
  if (response.status < 200 || response.status >= 300) {
    if (faultCode === "714") return text;
    if (response.status===401||response.status===403) throw new Error(effectiveUsername ? "FRITZBOX_AUTHENTICATION_FAILED" : "FRITZBOX_AUTHENTICATION_REQUIRED");
    throw new Error(faultCode ? `FRITZBOX_SOAP_${faultCode}` : `FRITZBOX_HTTP_${response.status}`);
  }
  if (faultCode) {
    if (faultCode === "714") return text;
    throw new Error(`FRITZBOX_SOAP_${faultCode}`);
  }
  if (!text.includes("Envelope")) throw new Error("FRITZBOX_INVALID_RESPONSE");
  return text;
}

export async function fritzBoxHostCount(baseUrl: string, username = "", password = "", tlsInsecure = false): Promise<number> {
  const xml = await requestSoap(baseUrl,username,password,"GetHostNumberOfEntries",{},tlsInsecure);
  const value = Number(xmlValue(xml,"NewHostNumberOfEntries") ?? xmlValue(xml,"HostNumberOfEntries"));
  if (!Number.isFinite(value)) throw new Error("FRITZBOX_INVALID_RESPONSE");
  return value;
}

export async function fritzBoxHostByMac(baseUrl: string, username: string, password: string, macAddress: string, tlsInsecure = false): Promise<HostEntry> {
  const xml = await requestSoap(baseUrl,username,password,"GetSpecificHostEntry",{NewMACAddress:normalizePresenceMac(macAddress)},tlsInsecure);
  if (xmlValue(xml,"errorCode") === "714") return {active:false};
  const activeRaw = xmlValue(xml,"NewActive");
  if (activeRaw === undefined) throw new Error("FRITZBOX_INVALID_RESPONSE");
  return { active: activeRaw === "1" || activeRaw.toLowerCase() === "true", ipAddress: xmlValue(xml,"NewIPAddress"), interfaceType: xmlValue(xml,"NewInterfaceType"), hostName: xmlValue(xml,"NewHostName") };
}

export class FritzBoxPresenceAdapter {
  private timer?: NodeJS.Timeout;
  private reconcileTask?: Promise<void>;
  private status: FritzBoxPresenceStatus = {connected:false,enabled:false};
  private stopped = true;
  private lastConnectionErrorSignature = "";
  private targetErrorSignatures = new Map<string,string>();
  constructor(private readonly registry: DeviceRegistry) {}

  private log(level: SystemLogLevel, code: string | undefined, message: string, details: Record<string, unknown> = {}): void {
    void writeSystemLog(level,"presence",code,message,details).catch(()=>undefined);
  }

  private errorCode(error: unknown): string {
    return error instanceof Error ? error.message : "FRITZBOX_REQUEST_FAILED";
  }

  private connectionLogDetails(baseUrl: string, tlsInsecure: boolean, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      baseUrl: normalizeFritzBoxBaseUrl(baseUrl),
      tlsCertificateVerificationDisabled: Boolean(tlsInsecure),
      ...extra
    };
  }

  private logScheduledConnectionFailure(code: string, baseUrl: string, tlsInsecure: boolean, targetCount: number): void {
    const normalizedBaseUrl=normalizeFritzBoxBaseUrl(baseUrl);
    const signature=`${normalizedBaseUrl}\u0000${code}`;
    if(signature===this.lastConnectionErrorSignature) return;
    this.lastConnectionErrorSignature=signature;
    this.log("error",code,"FRITZ!Box presence synchronization failed",this.connectionLogDetails(normalizedBaseUrl,tlsInsecure,{targetCount,errorCode:code}));
  }

  private logConnectionRecovery(baseUrl: string, tlsInsecure: boolean, hostCount: number): void {
    if(!this.lastConnectionErrorSignature) return;
    this.lastConnectionErrorSignature="";
    this.log("info","FRITZBOX_PRESENCE_RECOVERED","FRITZ!Box presence connection recovered",this.connectionLogDetails(baseUrl,tlsInsecure,{hostCount}));
  }

  private logTargetFailure(target: PresenceTarget, error: unknown, baseUrl: string): void {
    const code=this.errorCode(error);
    const signature=`${code}`;
    if(this.targetErrorSignatures.get(target.id)===signature) return;
    this.targetErrorSignatures.set(target.id,signature);
    this.log("warning",code,"FRITZ!Box presence device query failed",{
      baseUrl:normalizeFritzBoxBaseUrl(baseUrl),
      targetId:target.id,
      targetName:target.name,
      macAddress:target.macAddress,
      errorCode:code
    });
  }

  private logTargetRecovery(target: PresenceTarget, baseUrl: string): void {
    if(!this.targetErrorSignatures.delete(target.id)) return;
    this.log("info","FRITZBOX_PRESENCE_DEVICE_RECOVERED","FRITZ!Box presence device query recovered",{
      baseUrl:normalizeFritzBoxBaseUrl(baseUrl),
      targetId:target.id,
      targetName:target.name,
      macAddress:target.macAddress
    });
  }

  start(): void { this.stopped=false; void this.reload().catch(()=>undefined); }
  stop(): void { this.stopped=true; if(this.timer) clearInterval(this.timer); this.timer=undefined; }
  getStatus(): FritzBoxPresenceStatus { return {...this.status}; }

  async reload(): Promise<void> {
    if(this.timer) clearInterval(this.timer); this.timer=undefined;
    const settings = await getFritzBoxPresenceConnection(); this.status.enabled=settings.enabled;
    const targets=await listPresenceTargets();
    const validTargetIds=new Set(targets.map(target=>target.id));
    for(const targetId of this.targetErrorSignatures.keys()) if(!validTargetIds.has(targetId)) this.targetErrorSignatures.delete(targetId);
    await this.ensureTargetDevices(targets); await this.updateHousePresence();
    if(!settings.enabled || this.stopped) { this.status={...this.status,connected:false,enabled:settings.enabled}; return; }
    await this.reconcile().catch(()=>undefined);
    if(this.stopped) return;
    this.timer=setInterval(()=>void this.reconcile().catch(()=>undefined),Math.max(10,settings.pollIntervalSeconds)*1000); this.timer.unref();
  }

  async testConnection(input?: {baseUrl:string;username:string;password:string;tlsInsecure:boolean}): Promise<{hostCount:number}> {
    const connection=input??await getFritzBoxPresenceConnection();
    const baseUrl=normalizeFritzBoxBaseUrl(connection.baseUrl);
    try {
      const hostCount=await fritzBoxHostCount(baseUrl,connection.username,connection.password,connection.tlsInsecure);
      this.status={...this.status,lastTestAt:now(),lastTestSuccess:true,lastTestHostCount:hostCount,lastTestBaseUrl:baseUrl,lastTestError:undefined};
      this.log("info","FRITZBOX_CONNECTION_TEST_OK","FRITZ!Box presence connection test succeeded",this.connectionLogDetails(baseUrl,connection.tlsInsecure,{hostCount,usernameConfigured:Boolean(connection.username.trim())}));
      return {hostCount};
    } catch(error) {
      const code=this.errorCode(error);
      this.status={...this.status,lastTestAt:now(),lastTestSuccess:false,lastTestError:code,lastTestBaseUrl:baseUrl,lastTestHostCount:undefined};
      this.log("error",code,"FRITZ!Box presence connection test failed",this.connectionLogDetails(baseUrl,connection.tlsInsecure,{usernameConfigured:Boolean(connection.username.trim()),errorCode:code}));
      throw error;
    }
  }

  async reconcile(): Promise<void> {
    if(this.reconcileTask) return this.reconcileTask;
    this.reconcileTask=this.performReconcile().finally(()=>{this.reconcileTask=undefined}); return this.reconcileTask;
  }

  private async performReconcile(): Promise<void> {
    const connection=await getFritzBoxPresenceConnection(); this.status.enabled=connection.enabled; if(!connection.enabled) return;
    const targets=await listPresenceTargets(); await this.ensureTargetDevices(targets);
    try {
      const hostCount=await fritzBoxHostCount(connection.baseUrl,connection.username,connection.password,connection.tlsInsecure);
      this.logConnectionRecovery(connection.baseUrl,connection.tlsInsecure,hostCount);
      for(const target of targets) {
        try {
          const host=await fritzBoxHostByMac(connection.baseUrl,connection.username,connection.password,target.macAddress,connection.tlsInsecure);
          await this.applyTarget(target,host,connection.absenceDelaySeconds);
          this.logTargetRecovery(target,connection.baseUrl);
        } catch(error) {
          await this.markTargetUnavailable(target,error);
          this.logTargetFailure(target,error,connection.baseUrl);
        }
      }
      await this.updateHousePresence(); this.status={...this.status,connected:true,enabled:true,hostCount,lastSync:now(),lastError:undefined};
    } catch(error) {
      const code=this.errorCode(error); this.status={...this.status,connected:false,enabled:true,lastError:code};
      this.logScheduledConnectionFailure(code,connection.baseUrl,connection.tlsInsecure,targets.length);
      for(const target of targets) await this.markTargetUnavailable(target,error);
      await this.updateHousePresence(); throw error;
    }
  }

  private async ensureTargetDevices(targets: PresenceTarget[]): Promise<void> {
    const targetIds=new Set(targets.map(target=>`presence:${target.id}`));
    for(const existing of this.registry.all().filter(device=>device.source==="presence"&&device.id!==houseDeviceId&&!targetIds.has(device.id))) await this.registry.remove(existing.id);
    for(const target of targets) {
      const id=`presence:${target.id}`; const existing=this.registry.get(id); if(existing&&existing.name===target.name&&existing.macAddress===target.macAddress&&existing.adapterData?.personName===target.personName) continue;
      const stamp=now(); await this.registry.set({id,source:"presence",sourceId:target.id,type:"genericSensor",presentationType:"auto",name:target.name,model:"FRITZ!Box Wi-Fi Presence",macAddress:target.macAddress,profile:"presence",reachable:existing?.reachable??false,state:existing?.state??{present:false},capabilities:[],homekitEnabled:false,hidden:false,credentialMode:"none",passwordConfigured:false,lastSeen:existing?.lastSeen??stamp,lastEvent:existing?.lastEvent??stamp,adapterData:{...(existing?.adapterData??{}),targetId:target.id,personName:target.personName}});
    }
  }

  private async applyTarget(target: PresenceTarget, host: HostEntry, defaultDelaySeconds: number): Promise<void> {
    const id=`presence:${target.id}`; const existing=this.registry.get(id); if(!existing) return; const stamp=now(); const previous=Boolean(existing.state.present); const delay=target.absenceDelaySeconds??defaultDelaySeconds;
    let present=host.active; let missingSince=typeof existing.adapterData?.missingSince==="string"?existing.adapterData.missingSince:undefined;
    if(host.active) missingSince=undefined;
    else if(previous) { missingSince=missingSince??stamp; present=(Date.now()-Date.parse(missingSince))<delay*1000; }
    const changed=present!==previous;
    const adapterData={...(existing.adapterData??{})}; delete adapterData.lastError;
    await this.registry.set({...existing,reachable:true,hostname:host.hostName||existing.hostname,state:{...existing.state,present,...(host.ipAddress?{ipAddress:host.ipAddress}:{}),...(host.interfaceType?{interfaceType:host.interfaceType}:{}),...(host.hostName?{hostName:host.hostName}:{})},lastSeen:host.active?stamp:existing.lastSeen,lastEvent:changed?stamp:existing.lastEvent,adapterData:{...adapterData,targetId:target.id,absenceDelaySeconds:delay,...(missingSince?{missingSince}:{})}});
  }

  private async markTargetUnavailable(target: PresenceTarget, error: unknown): Promise<void> {
    const id=`presence:${target.id}`; const existing=this.registry.get(id); if(!existing) return; const code=this.errorCode(error);
    await this.registry.set({...existing,reachable:false,adapterData:{...(existing.adapterData??{}),lastError:code}});
  }

  private async updateHousePresence(): Promise<void> {
    const people=this.registry.all().filter(device=>device.source==="presence"&&device.id!==houseDeviceId); const presentPeople=people.filter(device=>Boolean(device.state.present)); const count=presentPeople.length; const anyHome=count>0; const nobodyHome=!anyHome; const existing=this.registry.get(houseDeviceId); const stamp=now(); const previousAny=Boolean(existing?.state.anyHome); const previousNobody=existing?.state.nobodyHome===undefined?nobodyHome:Boolean(existing.state.nobodyHome);
    const personName=(device:Device)=>typeof device.adapterData?.personName==="string"&&device.adapterData.personName.trim()?device.adapterData.personName.trim():device.name;
    const memberNames=people.map(personName); const presentNames=presentPeople.map(personName);
    const changed=Boolean(existing)&&(previousAny!==anyHome||previousNobody!==nobodyHome);
    const device: Device={id:houseDeviceId,source:"presence",sourceId:"house",type:"genericSensor",presentationType:"auto",name:"Hauspräsenz",model:"SALTA Presence Group",profile:"presence-group",reachable:this.status.enabled?people.every(device=>device.reachable):true,state:{anyHome,nobodyHome,present:anyHome,presentCount:count,memberNames:JSON.stringify(memberNames),presentNames:JSON.stringify(presentNames)},capabilities:[],homekitEnabled:false,hidden:false,credentialMode:"none",passwordConfigured:false,lastSeen:stamp,lastEvent:changed?stamp:(existing?.lastEvent??stamp),adapterData:{memberCount:people.length}};
    await this.registry.set(device);
  }
}
