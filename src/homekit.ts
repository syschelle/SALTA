import { Accessory, Bridge, Categories, Characteristic, Service, uuid } from "@homebridge/hap-nodejs";
import type { Device } from "./types.js";
import type { DeviceRegistry } from "./registry.js";
import type { MockAdapter } from "./mock-adapter.js";
import { config } from "./config.js";

export class HomeKitBridge {
  private bridge?: Bridge;
  private accessories = new Map<string, Accessory>();
  constructor(private registry:DeviceRegistry, private adapter:MockAdapter){}
  start():void{
    if(!config.HOMEKIT_ENABLED) return;
    this.bridge=new Bridge(config.HOMEKIT_NAME, uuid.generate("salta:bridge"));
    for(const d of this.registry.all()) this.sync(d);
    this.registry.on("device", (d:Device)=>this.sync(d));
    this.bridge.publish({username:config.HOMEKIT_USERNAME,pincode:config.HOMEKIT_PIN,port:config.HOMEKIT_PORT,category:Categories.BRIDGE});
  }
  stop():void{ this.bridge?.unpublish(); }
  private sync(d:Device):void{
    if(!this.bridge || !d.homekitEnabled) return;
    let a=this.accessories.get(d.id);
    if(!a){ a=new Accessory(d.name,uuid.generate(`salta:${d.id}`)); this.addService(a,d); this.bridge.addBridgedAccessory(a); this.accessories.set(d.id,a); }
    const service=a.services.find(s=>s.UUID!==Service.AccessoryInformation.UUID); if(!service) return;
    if("on" in d.state) service.updateCharacteristic(Characteristic.On,Boolean(d.state.on));
    if("brightness" in d.state) service.updateCharacteristic(Characteristic.Brightness,Number(d.state.brightness));
    if("motion" in d.state) service.updateCharacteristic(Characteristic.MotionDetected,Boolean(d.state.motion));
    if("currentTemperature" in d.state) service.updateCharacteristic(Characteristic.CurrentTemperature,Number(d.state.currentTemperature));
    if("targetTemperature" in d.state) service.updateCharacteristic(Characteristic.TargetTemperature,Number(d.state.targetTemperature));
    if("currentPosition" in d.state) service.updateCharacteristic(Characteristic.CurrentPosition,Number(d.state.currentPosition));
    if("targetPosition" in d.state) service.updateCharacteristic(Characteristic.TargetPosition,Number(d.state.targetPosition));
  }
  private addService(a:Accessory,d:Device):void{
    let s:Service;
    switch(d.type){
      case "outlet": s=a.addService(Service.Outlet,d.name); break;
      case "switch": s=a.addService(Service.Switch,d.name); break;
      case "light": s=a.addService(Service.Lightbulb,d.name); break;
      case "motionSensor": s=a.addService(Service.MotionSensor,d.name); break;
      case "thermostat": s=a.addService(Service.Thermostat,d.name); break;
      case "windowCovering": s=a.addService(Service.WindowCovering,d.name); break;
      default: s=a.addService(Service.Switch,d.name); break;
    }
    const cmd=(capability:string,value?:unknown)=>void this.adapter.command({deviceId:d.id,capability,value:value as never,source:"homekit"}).catch(()=>undefined);
    if(d.capabilities.includes("turnOn")) s.getCharacteristic(Characteristic.On).onSet(v=>cmd(v?"turnOn":"turnOff"));
    if(d.capabilities.includes("setBrightness")) s.getCharacteristic(Characteristic.Brightness).onSet(v=>cmd("setBrightness",Number(v)));
    if(d.capabilities.includes("setTargetTemperature")) s.getCharacteristic(Characteristic.TargetTemperature).onSet(v=>cmd("setTargetTemperature",Number(v)));
    if(d.capabilities.includes("setTargetPosition")) s.getCharacteristic(Characteristic.TargetPosition).onSet(v=>cmd("setTargetPosition",Number(v)));
  }
}
