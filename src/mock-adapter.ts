import type { Device, DeviceCommand } from "./types.js";
import { DeviceRegistry } from "./registry.js";

const now=()=>new Date().toISOString();
const base=(d: Omit<Device,"lastSeen"|"lastEvent"|"credentialMode"|"passwordConfigured">):Device=>({...d,credentialMode:"inherit",passwordConfigured:false,lastSeen:now(),lastEvent:now()});

export class MockAdapter {
  private timer?: NodeJS.Timeout;
  constructor(private registry: DeviceRegistry, private intervalMs:number) {}

  async start(): Promise<void> {
    for (const d of this.devices()) await this.registry.set(d);
    this.timer=setInterval(()=>void this.tick(), this.intervalMs);
  }
  async stop():Promise<void>{ if(this.timer) clearInterval(this.timer); }
  private devices():Device[]{ return [
    base({id:"mock:plug-s:office",source:"mock",sourceId:"plug-s-1",type:"outlet",name:"Office Plug S",room:"Office",reachable:true,state:{on:false,power:0,energy:12.4},capabilities:["turnOn","turnOff","toggle"],homekitEnabled:true}),
    base({id:"mock:shelly1:pump",source:"mock",sourceId:"shelly1-1",type:"switch",name:"Garden Pump",room:"Garden",reachable:true,state:{on:false,input:false},capabilities:["turnOn","turnOff","toggle"],homekitEnabled:true}),
    base({id:"mock:3em:main",source:"mock",sourceId:"3em-1",type:"energyMeter",name:"Main Energy Meter",room:"Utility",reachable:true,state:{powerL1:420,powerL2:380,powerL3:510,totalPower:1310,importEnergy:8290.4,exportEnergy:190.2,relay:false},capabilities:["turnOn","turnOff"],homekitEnabled:false}),
    base({id:"mock:2pm:shutter",source:"mock",sourceId:"2pmg4-1",type:"windowCovering",name:"Living Room Shutter",room:"Living Room",reachable:true,state:{currentPosition:35,targetPosition:35,positionState:"stopped"},capabilities:["open","close","stop","setTargetPosition"],homekitEnabled:true}),
    base({id:"mock:thermostat:living",source:"mock",sourceId:"hm-thermo-1",type:"thermostat",name:"Living Room Thermostat",room:"Living Room",reachable:true,state:{currentTemperature:21.3,targetTemperature:22,mode:"auto",batteryLow:false},capabilities:["setTargetTemperature"],homekitEnabled:true}),
    base({id:"mock:zigbee:light",source:"mock",sourceId:"zb-light-1",type:"light",name:"Dining Light",room:"Dining",reachable:true,state:{on:true,brightness:62},capabilities:["turnOn","turnOff","toggle","setBrightness"],homekitEnabled:true}),
    base({id:"mock:zigbee:motion",source:"mock",sourceId:"zb-motion-1",type:"motionSensor",name:"Hall Motion",room:"Hall",reachable:true,state:{motion:false,battery:91},capabilities:[],homekitEnabled:true})
  ];}
  private async tick():Promise<void>{
    const meter=this.registry.get("mock:3em:main"); if(meter){ const p=Number(meter.state.totalPower)+25; await this.registry.set({...meter,state:{...meter.state,totalPower:p,powerL1:Number(meter.state.powerL1)+5},lastSeen:now(),lastEvent:now()}); }
    const motion=this.registry.get("mock:zigbee:motion"); if(motion){ await this.registry.set({...motion,state:{...motion.state,motion:!Boolean(motion.state.motion)},lastSeen:now(),lastEvent:now()}); }
  }
  async command(c:DeviceCommand):Promise<Device>{
    const d=this.registry.get(c.deviceId); if(!d) throw new Error("DEVICE_NOT_FOUND");
    if(!d.capabilities.includes(c.capability)) throw new Error("CAPABILITY_NOT_SUPPORTED");
    const s={...d.state};
    if(c.capability==="turnOn") s.on=true;
    if(c.capability==="turnOff") s.on=false;
    if(c.capability==="toggle") s.on=!Boolean(s.on);
    if(c.capability==="setBrightness") s.brightness=Number(c.value);
    if(c.capability==="setTargetTemperature") s.targetTemperature=Number(c.value);
    if(c.capability==="open") Object.assign(s,{targetPosition:100,currentPosition:100,positionState:"stopped"});
    if(c.capability==="close") Object.assign(s,{targetPosition:0,currentPosition:0,positionState:"stopped"});
    if(c.capability==="stop") s.positionState="stopped";
    if(c.capability==="setTargetPosition") Object.assign(s,{targetPosition:Number(c.value),currentPosition:Number(c.value),positionState:"stopped"});
    const next={...d,state:s,lastSeen:now(),lastEvent:now()}; await this.registry.set(next); return next;
  }
  async reconcile():Promise<void>{ for(const d of this.registry.all()) await this.registry.set({...d,lastSeen:now()}); }
}
