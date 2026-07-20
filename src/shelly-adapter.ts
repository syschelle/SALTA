import { createHash } from "node:crypto";
import type { Device, DeviceCommand, DeviceState, DeviceType } from "./types.js";
import { DeviceRegistry } from "./registry.js";
import { getDeviceCredentials } from "./db.js";

const now = () => new Date().toISOString();
const timeoutMs = 3500;

type ProbeResult = { host: string; generation: "gen1" | "rpc"; model: string; sourceId: string; name: string; device: Device };

function authHeader(username: string, password: string): Record<string,string> {
  if (!username && !password) return {};
  return { authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };
}
async function requestJson(url:string, username="", password="", method="GET", body?:unknown):Promise<any>{
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{method,headers:{accept:"application/json","content-type":"application/json",...authHeader(username,password)},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
    if(!response.ok) throw new Error(response.status===401?"AUTHENTICATION_FAILED":`HTTP_${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}
function idFor(host:string,sourceId:string){ return `shelly:${createHash("sha1").update(`${host}:${sourceId}`).digest("hex").slice(0,20)}`; }
function gen1Type(status:any,settings:any):DeviceType{
  if(Array.isArray(status?.rollers)&&status.rollers.length) return "windowCovering";
  if(Array.isArray(status?.lights)&&status.lights.length) return "light";
  if(status?.emeters || status?.em) return "energyMeter";
  return "switch";
}
function gen1State(status:any,type:DeviceType):DeviceState{
  if(type==="windowCovering"){const r=status.rollers?.[0]??{};return {currentPosition:Number(r.current_pos??0),targetPosition:Number(r.current_pos??0),positionState:r.state??"stopped",power:Number(r.power??0)};}
  if(type==="light"){const l=status.lights?.[0]??{};return {on:Boolean(l.ison),brightness:Number(l.brightness??0),power:Number(l.power??0)};}
  if(type==="energyMeter"){const phases=status.emeters??[];return {totalPower:phases.reduce((n:number,x:any)=>n+Number(x.power??0),0),importEnergy:phases.reduce((n:number,x:any)=>n+Number(x.total??0),0)};}
  const r=status.relays?.[0]??{};return {on:Boolean(r.ison),power:Number(status.meters?.[0]?.power??0),energy:Number(status.meters?.[0]?.total??0)};
}
function caps(type:DeviceType):string[]{
  if(type==="windowCovering") return ["open","close","stop","setTargetPosition"];
  if(type==="light") return ["turnOn","turnOff","toggle","setBrightness"];
  if(type==="energyMeter") return [];
  return ["turnOn","turnOff","toggle"];
}
function rpcComponent(status:any){
  const entries=Object.entries(status??{});
  return entries.find(([k])=>/^switch:\d+$/.test(k)) ?? entries.find(([k])=>/^light:\d+$/.test(k)) ?? entries.find(([k])=>/^cover:\d+$/.test(k)) ?? entries.find(([k])=>/^em:\d+$/.test(k));
}
function rpcType(key:string):DeviceType { return key.startsWith("cover:")?"windowCovering":key.startsWith("light:")?"light":key.startsWith("em:")?"energyMeter":"switch"; }
function rpcState(key:string,value:any):DeviceState{
  if(key.startsWith("cover:")) return {currentPosition:Number(value.current_pos??0),targetPosition:Number(value.target_pos??value.current_pos??0),positionState:value.state??"stopped",power:Number(value.apower??0)};
  if(key.startsWith("light:")) return {on:Boolean(value.output),brightness:Number(value.brightness??0),power:Number(value.apower??0),energy:Number(value.aenergy?.total??0)};
  if(key.startsWith("em:")) return {totalPower:Number(value.total_act_power??0),powerL1:Number(value.a_act_power??0),powerL2:Number(value.b_act_power??0),powerL3:Number(value.c_act_power??0)};
  return {on:Boolean(value.output),power:Number(value.apower??0),energy:Number(value.aenergy?.total??0),temperature:Number(value.temperature?.tC??0)};
}

export class ShellyAdapter {
  private timer?:NodeJS.Timeout;
  constructor(private registry:DeviceRegistry){}
  start(){ this.timer=setInterval(()=>void this.reconcile(),15000); }
  stop(){ if(this.timer) clearInterval(this.timer); }
  async probe(host:string, username="", password=""):Promise<ProbeResult>{
    const clean=host.trim().replace(/^https?:\/\//,"").replace(/\/$/,"");
    try{
      const info=await requestJson(`http://${clean}/rpc/Shelly.GetDeviceInfo`,username,password);
      const status=await requestJson(`http://${clean}/rpc/Shelly.GetStatus`,username,password);
      const component=rpcComponent(status); if(!component) throw new Error("UNSUPPORTED_SHELLY_DEVICE");
      const [key,value]=component; const type=rpcType(key); const sourceId=String(info.id??clean);
      const device:Device={id:idFor(clean,sourceId),source:"shelly",sourceId,type,name:String(info.name||info.model||sourceId),host:clean,generation:"rpc",model:String(info.model??"Shelly RPC"),reachable:true,state:rpcState(key,value),capabilities:caps(type),homekitEnabled:true,credentialMode:"inherit",passwordConfigured:false,lastSeen:now(),lastEvent:now()};
      return {host:clean,generation:"rpc",model:device.model!,sourceId,name:device.name,device};
    }catch(rpcError){
      if(rpcError instanceof Error && rpcError.message==="AUTHENTICATION_FAILED") throw rpcError;
      const [settings,status]=await Promise.all([requestJson(`http://${clean}/settings`,username,password),requestJson(`http://${clean}/status`,username,password)]);
      const type=gen1Type(status,settings); const sourceId=String(settings.device?.mac??settings.device?.hostname??clean);
      const device:Device={id:idFor(clean,sourceId),source:"shelly",sourceId,type,name:String(settings.name||settings.device?.hostname||sourceId),host:clean,generation:"gen1",model:String(settings.device?.type??"Shelly Gen1"),reachable:true,state:gen1State(status,type),capabilities:caps(type),homekitEnabled:true,credentialMode:"inherit",passwordConfigured:false,lastSeen:now(),lastEvent:now()};
      return {host:clean,generation:"gen1",model:device.model!,sourceId,name:device.name,device};
    }
  }
  async add(host:string,username="",password="",name?:string,roomId?:string,room?:string,credentialMode:"inherit"|"custom"|"none"="inherit"){
    const result=await this.probe(host,username,password); const device={...result.device,name:name?.trim()||result.device.name,roomId,room,credentialMode,credentialUsername:credentialMode==="custom"?username:undefined,passwordConfigured:credentialMode==="custom"&&Boolean(password)};
    await this.registry.set(device); if(credentialMode==="custom") await this.registry.patchCredentials(device.id,"custom",username,password); return device;
  }
  async discover(prefix:string,username="",password=""){
    const match=prefix.trim().match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.(?:0\/24|\d{1,3})$/); if(!match) throw new Error("INVALID_SUBNET");
    const hosts=Array.from({length:254},(_,i)=>`${match[1]}.${i+1}`); const found:ProbeResult[]=[]; let index=0;
    const workers=Array.from({length:24},async()=>{while(index<hosts.length){const host=hosts[index++];if(!host) continue;try{found.push(await this.probe(host,username,password));}catch{}}}); await Promise.all(workers); return found.map(({device,...item})=>item);
  }
  async refresh(device:Device){
    if(!device.host) return device; const credentials=await getDeviceCredentials(device.id); try{const probed=await this.probe(device.host,credentials.username,credentials.password); const next={...device,...probed.device,id:device.id,name:device.name,roomId:device.roomId,room:device.room,credentialMode:device.credentialMode,credentialUsername:device.credentialUsername,passwordConfigured:device.passwordConfigured,lastSeen:now()}; await this.registry.set(next); return next;}catch{const next={...device,reachable:false,lastSeen:now()};await this.registry.set(next);return next;}
  }
  async reconcile(){for(const d of this.registry.all().filter(x=>x.source==="shelly")) await this.refresh(d);}
  async command(c:DeviceCommand):Promise<Device>{
    const d=this.registry.get(c.deviceId); if(!d||d.source!=="shelly"||!d.host) throw new Error("DEVICE_NOT_FOUND"); if(!d.capabilities.includes(c.capability)) throw new Error("CAPABILITY_NOT_SUPPORTED");
    const cr=await getDeviceCredentials(d.id); const h=`http://${d.host}`;
    if(d.generation==="rpc"){
      const kind=d.type==="windowCovering"?"Cover":d.type==="light"?"Light":"Switch"; let method="";let params:any={id:0};
      if(c.capability==="toggle") {method=`${kind}.Toggle`;} else if(c.capability==="turnOn"||c.capability==="turnOff"){method=`${kind}.Set`;params.on=c.capability==="turnOn";} else if(c.capability==="setBrightness"){method="Light.Set";params.on=true;params.brightness=Number(c.value);} else if(c.capability==="open"||c.capability==="close"||c.capability==="stop"){method=`Cover.${c.capability.charAt(0).toUpperCase()+c.capability.slice(1)}`;} else if(c.capability==="setTargetPosition"){method="Cover.GoToPosition";params.pos=Number(c.value);} else throw new Error("CAPABILITY_NOT_SUPPORTED");
      await requestJson(`${h}/rpc/${method}`,cr.username,cr.password,"POST",params);
    } else {
      if(d.type==="windowCovering"){const action=c.capability==="setTargetPosition"?`to_pos&roller_pos=${Number(c.value)}`:c.capability;await requestJson(`${h}/roller/0?go=${action}`,cr.username,cr.password);} else if(d.type==="light"){const turn=c.capability==="turnOn"?"on":c.capability==="turnOff"?"off":c.capability==="toggle"?"toggle":"on";const gain=c.capability==="setBrightness"?`&brightness=${Number(c.value)}`:"";await requestJson(`${h}/light/0?turn=${turn}${gain}`,cr.username,cr.password);} else {const turn=c.capability==="turnOn"?"on":c.capability==="turnOff"?"off":"toggle";await requestJson(`${h}/relay/0?turn=${turn}`,cr.username,cr.password);}
    }
    return this.refresh(d);
  }
}
