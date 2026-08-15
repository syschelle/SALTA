let all=[],rooms=[],systemLogs=[],selectedDevice=null,shellySettingsStatus=null,phosconSettingsStatus=null,openCcuSettingsStatus=null,presenceData=null,climateModeData=null,notificationData=null,generalData=null,homeKitData=null,editingPresenceTargetId=null,editingRoomId=null,liveRefreshInFlight=false,activeCoverSliderId=null,activeBrightnessSliderId=null,activeTemperatureSliderId=null,presenceSettingsDirty=false,selectedRecoveryBackup=null,csrfToken="";
const coverSliderDrafts=new Map();

const themeToggleElement=document.getElementById('themeToggle');
const themeToggleIconElement=document.getElementById('themeToggleIcon');
const themeToggleTextElement=document.getElementById('themeToggleText');
const THEME_COOKIE='salta_theme';
const THEME_COOKIE_MAX_AGE=60*60*24*365;
function normalizeTheme(value){return value==='dark'?'dark':'light'}
function readThemeCookie(){const prefix=`${THEME_COOKIE}=`;const entry=document.cookie.split('; ').find(value=>value.startsWith(prefix));return entry?normalizeTheme(decodeURIComponent(entry.slice(prefix.length))):normalizeTheme(document.documentElement.dataset.theme)}
function writeThemeCookie(theme){const secure=location.protocol==='https:'?'; Secure':'';document.cookie=`${THEME_COOKIE}=${encodeURIComponent(theme)}; Max-Age=${THEME_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`}
function updateThemeToggle(theme){const dark=theme==='dark';if(!themeToggleElement||!themeToggleIconElement||!themeToggleTextElement)return;themeToggleElement.setAttribute('aria-pressed',String(dark));themeToggleElement.setAttribute('aria-label',dark?'Helles Theme aktivieren':'Dunkles Theme aktivieren');themeToggleElement.title=dark?'Zum hellen Theme wechseln':'Zum dunklen Theme wechseln';themeToggleIconElement.className=`mdi ${dark?'mdi-weather-sunny':'mdi-weather-night'}`;themeToggleTextElement.textContent=dark?'Helles Theme':'Dunkles Theme'}
function applyTheme(value,{persist=false,announce=false}={}){const theme=normalizeTheme(value);document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#0d1117':'#f4f6f8');if(persist)writeThemeCookie(theme);updateThemeToggle(theme);if(announce)notify(theme==='dark'?'Dunkles Theme aktiviert.':'Helles Theme aktiviert.')}
function toggleTheme(){applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',{persist:true,announce:true})}
function initializeTheme(){applyTheme(readThemeCookie())}
const pages=['overview','shelly','zigbee','openccu','virtual','presence','automations','rooms','logs','settings'];
const defaultPage='overview';
const icons={outlet:'mdi-power-socket-eu',switch:'mdi-toggle-switch-outline',energyMeter:'mdi-flash-outline',windowCovering:'mdi-window-shutter',light:'mdi-lightbulb-outline',fan:'mdi-fan',motionSensor:'mdi-motion-sensor',contactSensor:'mdi-door-closed-lock',temperatureSensor:'mdi-thermometer',humiditySensor:'mdi-water-percent',lightSensor:'mdi-brightness-6',waterLeakSensor:'mdi-water-alert-outline',smokeSensor:'mdi-smoke-detector-variant-alert',button:'mdi-gesture-tap-button',thermostat:'mdi-thermostat',genericSensor:'mdi-access-point'};
const mdiIcon=(name,fallback='help-circle-outline')=>{const normalized=String(name||'').trim().toLowerCase().replace(/^mdi-/,'');return /^[a-z0-9-]+$/.test(normalized)?`mdi-${normalized}`:`mdi-${fallback}`};
const iconMarkup=(name)=>`<span class="mdi ${mdiIcon(name)}" aria-hidden="true"></span>`;
const typeLabels={outlet:'Steckdose',switch:'Schalter',energyMeter:'Energiezähler',windowCovering:'Rollladen',light:'Licht',fan:'Ventilator',motionSensor:'Bewegungssensor',contactSensor:'Kontakt',temperatureSensor:'Temperatursensor',humiditySensor:'Feuchtesensor',lightSensor:'Lichtsensor',waterLeakSensor:'Wassersensor',smokeSensor:'Gefahrensensor',button:'Taster',thermostat:'Thermostat',genericSensor:'Sensor'};
const sourceLabels={shelly:'Shelly',phoscon:'Zigbee',openccu:'HomeMatic',virtual:'Virtuell',presence:'Präsenz'};
const overviewDeviceGridElement=document.getElementById('overviewDeviceGrid');
const roomGrouping=globalThis.SaltaRoomGrouping;
if(!overviewDeviceGridElement||!roomGrouping)throw new Error('Overview room grouping could not be initialized');
const roomIconChoices=[
  ['home-outline','Allgemein'],
  ['sofa-outline','Wohnzimmer'],
  ['bed-outline','Schlafzimmer'],
  ['silverware-fork-knife','Küche'],
  ['bathtub-outline','Badezimmer'],
  ['toilet','WC'],
  ['desk','Arbeitszimmer'],
  ['washing-machine','Hauswirtschaft'],
  ['garage-variant','Garage'],
  ['door-open','Flur / Eingang'],
  ['balcony','Balkon'],
  ['flower-outline','Garten'],
  ['pine-tree','Außenbereich'],
  ['floor-plan','Sonstiger Raum']
];
function roomIconOptions(selected='home-outline'){
  const current=String(selected||'home-outline').trim().toLowerCase().replace(/^mdi-/,'');
  const choices=[...roomIconChoices];
  if(current&&!choices.some(([value])=>value===current))choices.unshift([current,'Bisheriges Icon']);
  return choices.map(([value,label])=>`<option value="${escapeHtml(value)}"${value===current?' selected':''}>${escapeHtml(label)}</option>`).join('');
}
function updateRoomIconPreview(select){const preview=select?.closest('.room-icon-select')?.querySelector('.room-icon-preview');if(preview)preview.innerHTML=iconMarkup(select.value||'home-outline')}
const labels={on:'Status',brightness:'Helligkeit',power:'Leistung',energy:'Energie',consumption:'Verbrauch',voltage:'Spannung',current:'Strom',frequency:'Frequenz',temperature:'Temperatur',humidity:'Luftfeuchte',battery:'Batterie',motion:'Bewegung',open:'Kontakt',water:'Wasser',fire:'Feuer',carbonMonoxide:'Kohlenmonoxid',alarm:'Alarm',vibration:'Vibration',buttonEvent:'Tasterereignis',lux:'Beleuchtungsstärke',lightlevel:'Lichtniveau',pressure:'Luftdruck',airquality:'Luftqualität',airqualityppb:'Luftqualität',lowBattery:'Batteriewarnung',tampered:'Manipulation',dark:'Dunkel',daylight:'Tageslicht',sunrise:'Sonnenaufgang',sunset:'Sonnenuntergang',daylightStatus:'Sonnenphase',present:'Anwesenheit',anyHome:'Jemand zuhause',nobodyHome:'Niemand zuhause',presentCount:'Anwesend',ipAddress:'IP-Adresse',interfaceType:'Verbindung',hostName:'Hostname',colorTemperature:'Farbtemperatur',currentPosition:'Position',targetPosition:'Ziel',positionState:'Fahrt',targetTemperature:'Solltemperatur',valvePosition:'Ventilstellung',controlMode:'Regelmodus',mode:'Modus',totalPower:'Gesamtleistung',powerL1:'Phase L1',powerL2:'Phase L2',powerL3:'Phase L3'};
const daylightPhaseLabels={100:'Nadir',110:'Nachtende',120:'Nautische Morgendämmerung',130:'Morgendämmerung',140:'Sonnenaufgang beginnt',150:'Sonnenaufgang beendet',160:'Goldene Stunde',170:'Sonnenhöchststand',180:'Goldene Stunde',190:'Sonnenuntergang beginnt',200:'Sonnenuntergang beendet',210:'Abenddämmerung',220:'Nautische Abenddämmerung',230:'Nachtbeginn'};
const daylightTimeLabel=value=>{const match=/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/.exec(String(value||''));return match?.[1]||String(value)};
const formatEnergyKwh=value=>`${Math.round((value/1000)*1000)/1000} kWh`;
const fmt=(k,v)=>{if((k==='sunrise'||k==='sunset')&&typeof v==='string')return daylightTimeLabel(v);if(k==='daylightStatus'&&typeof v==='number')return daylightPhaseLabels[v]||String(v);if(typeof v==='boolean'){const states={motion:['Bewegung','Keine Bewegung'],open:['Offen','Geschlossen'],water:['Alarm','Trocken'],fire:['Alarm','Normal'],carbonMonoxide:['Alarm','Normal'],alarm:['Alarm','Normal'],vibration:['Erkannt','Ruhe'],lowBattery:['Niedrig','OK'],tampered:['Erkannt','OK'],dark:['Ja','Nein'],daylight:['Ja','Nein'],present:['Anwesend','Abwesend'],anyHome:['Jemand zuhause','Niemand zuhause'],nobodyHome:['Niemand zuhause','Jemand zuhause']};return states[k]?(v?states[k][0]:states[k][1]):v?'Ein':'Aus'}if((k==='controlMode'||k==='mode')&&typeof v==='string'){const modes={off:'Aus',manual:'Hand',auto:'Automatik',boost:'Boost',party:'Party',away:'Abwesend'};return modes[v.toLowerCase()]||v}if(typeof v!=='number')return String(v);if(k==='energy')return formatEnergyKwh(v);const value=Math.round(v*10)/10;const lower=k.toLowerCase();const unit=lower.includes('temperature')?' °C':k==='humidity'||lower.includes('position')||k==='brightness'||k==='battery'?' %':lower.includes('power')?' W':k==='consumption'?' Wh':k==='voltage'?' V':k==='current'?' A':k==='frequency'?' Hz':k==='lux'?' lx':k==='pressure'?' hPa':'';return `${value}${unit}`};
const displayedState=d=>{const values=Object.entries(d.state||{}).filter(([,value])=>value!==null&&value!==undefined&&!(typeof value==='number'&&!Number.isFinite(value)));const limit=String(d.profile||'').split(' + ').includes('Daylight')?5:4;return values.slice(0,limit)};
function supportsPresentationOverride(d){return ['switch','outlet','light'].includes(d.type)&&d.capabilities.includes('turnOn')&&d.capabilities.includes('turnOff')}
function resolvedPresentationType(d){return d.presentationType&&d.presentationType!=='auto'&&supportsPresentationOverride(d)?d.presentationType:d.type}
function homeKitStateValue(d,...keys){return keys.some(key=>d.state?.[key]!==undefined&&d.state?.[key]!==null)}
function homeKitSupportedDevice(d){const type=resolvedPresentationType(d);if(type==='windowCovering')return d.capabilities.includes('setTargetPosition');if(type==='thermostat')return d.capabilities.includes('setTargetTemperature')&&d.capabilities.includes('setThermostatMode');if(['switch','outlet','light','fan'].includes(type))return d.capabilities.includes('turnOn')&&d.capabilities.includes('turnOff');if(type==='motionSensor')return homeKitStateValue(d,'motion');if(type==='contactSensor')return homeKitStateValue(d,'open');if(type==='temperatureSensor')return homeKitStateValue(d,'temperature');if(type==='humiditySensor')return homeKitStateValue(d,'humidity');if(type==='lightSensor')return homeKitStateValue(d,'lux','lightlevel');if(type==='waterLeakSensor')return homeKitStateValue(d,'water','alarm');if(type==='smokeSensor')return homeKitStateValue(d,'fire','alarm');return false}
function homeKitTargetRoomName(d){if(d.homekitUseSaltaRoom===false)return d.homekitRoom||rooms.find(room=>room.id===d.homekitRoomId)?.name||'Nicht zugeordnet';return d.room||rooms.find(room=>room.id===d.roomId)?.name||'Nicht zugeordnet'}
function homeKitDeviceStateMeta(d){
  const type=resolvedPresentationType(d);const state=d.state||{};
  if(d.reachable===false)return {label:'Offline',tone:'offline'};
  if(type==='contactSensor')return {label:state.open===true?'Offen':'Geschlossen',tone:state.open===true?'warning':'ok'};
  if(type==='thermostat'){
    const temperature=Number(state.temperature);const target=Number(state.targetTemperature);const parts=[];
    if(Number.isFinite(temperature))parts.push(fmt('temperature',temperature));
    if(Number.isFinite(target))parts.push(`Soll ${fmt('targetTemperature',target)}`);
    if(state.controlMode)parts.push(fmt('controlMode',state.controlMode));
    return {label:parts.join(' · ')||'Thermostat',tone:String(state.controlMode||'').toLowerCase()==='off'?'muted':'ok'};
  }
  if(type==='windowCovering'){const position=boundedPosition(state.currentPosition);return {label:position===null?'Rollladen':`${position} %`,tone:'muted'}}
  if(['switch','outlet','light','fan'].includes(type))return {label:state.on===true?'Ein':'Aus',tone:state.on===true?'ok':'muted'};
  if(type==='motionSensor')return {label:state.motion===true?'Bewegung':'Keine Bewegung',tone:state.motion===true?'warning':'ok'};
  if(type==='temperatureSensor'&&Number.isFinite(Number(state.temperature)))return {label:fmt('temperature',Number(state.temperature)),tone:'muted'};
  if(type==='humiditySensor'&&Number.isFinite(Number(state.humidity)))return {label:fmt('humidity',Number(state.humidity)),tone:'muted'};
  if(type==='lightSensor'){const value=state.lux??state.lightlevel;return {label:value!==undefined?fmt(state.lux!==undefined?'lux':'lightlevel',value):'Lichtsensor',tone:'muted'}}
  if(type==='waterLeakSensor')return {label:(state.water??state.alarm)===true?'Wasser erkannt':'Trocken',tone:(state.water??state.alarm)===true?'warning':'ok'};
  if(type==='smokeSensor')return {label:(state.fire??state.alarm)===true?'Alarm':'Normal',tone:(state.fire??state.alarm)===true?'warning':'ok'};
  return {label:d.reachable===false?'Offline':'Bereit',tone:'muted'};
}
function homeKitDeviceRoomGroups(devices){
  const known=new Set(rooms.map(room=>room.id));
  const groups=rooms.map(room=>({id:room.id,name:room.name,icon:room.icon||'home-outline',devices:devices.filter(device=>device.roomId===room.id)})).filter(group=>group.devices.length);
  const unassigned=devices.filter(device=>!device.roomId||!known.has(device.roomId));
  if(unassigned.length)groups.push({id:'unassigned',name:'Nicht zugeordnet',icon:'help-circle-outline',devices:unassigned});
  return groups;
}
function renderHomeKitDeviceList(){
  if(!globalThis.homeKitDeviceList||!globalThis.homeKitDeviceCount)return;
  const supported=all.filter(homeKitSupportedDevice);const enabled=supported.filter(device=>device.homekitEnabled&&!(device.source==='phoscon'&&device.hidden)).length;
  homeKitDeviceCount.textContent=`${enabled} / ${supported.length}`;
  homeKitDeviceCount.title=`${enabled} von ${supported.length} unterstützten Geräten für HomeKit freigegeben`;
  if(!supported.length){homeKitDeviceList.innerHTML='<article class="empty-state compact"><strong>Keine unterstützten Geräte</strong><p class="muted">Sobald SALTA kompatible Geräte erkennt, erscheinen sie hier.</p></article>';return}
  homeKitDeviceList.innerHTML=homeKitDeviceRoomGroups(supported).map(group=>`<section class="homekit-device-room"><div class="homekit-device-room-head"><div><span class="mdi ${mdiIcon(group.icon)}" aria-hidden="true"></span><strong>${escapeHtml(group.name)}</strong></div><span>${group.devices.length} ${group.devices.length===1?'Gerät':'Geräte'}</span></div><div class="homekit-device-room-list">${group.devices.map(device=>{
    const type=resolvedPresentationType(device);const state=homeKitDeviceStateMeta(device);const hidden=device.source==='phoscon'&&device.hidden;const checked=Boolean(device.homekitEnabled&&!hidden);const disabled=hidden?' disabled':'';const roomTarget=homeKitTargetRoomName(device);const source=sourceLabels[device.source]||device.source;const typeLabel=typeLabels[type]||type;const encodedId=encodeURIComponent(device.id).replace(/'/g,'%27');
    return `<article class="homekit-device-item ${checked?'enabled':''} ${hidden?'disabled':''}" data-homekit-device-id="${escapeHtml(device.id)}"><div class="homekit-device-main"><span class="homekit-device-icon">${iconMarkup(icons[type]||'home-automation')}</span><div class="homekit-device-copy"><div class="homekit-device-title"><strong>${escapeHtml(device.homekitName||device.name)}</strong><span class="homekit-source-badge">${escapeHtml(source)}</span></div><div class="homekit-device-meta"><span>${escapeHtml(typeLabel)}</span><span>${escapeHtml(roomTarget)}</span>${hidden?'<span>In SALTA ausgeblendet</span>':''}</div></div></div><div class="homekit-device-side"><span class="homekit-device-state ${state.tone}">${escapeHtml(state.label)}</span><label class="homekit-device-toggle${hidden?' disabled':''}" title="${hidden?'Ausgeblendete Zigbee-Geräte werden nicht an HomeKit weitergereicht.':'Gerät in HomeKit veröffentlichen'}"><input type="checkbox" ${checked?'checked ':''}onchange="setHomeKitDeviceEnabled(decodeURIComponent('${encodedId}'),this.checked,this)"${disabled}><span aria-hidden="true"></span><em>HomeKit</em></label></div></article>`;
  }).join('')}</div></section>`).join('');
}
async function setHomeKitDeviceEnabled(id,enabled,input){
  const device=all.find(item=>item.id===id);if(!device)return;
  if(!homeKitSupportedDevice(device)){if(input)input.checked=false;notify('Dieses Gerät wird von der SALTA-HomeKit-Bridge nicht unterstützt.',true);return}
  if(device.source==='phoscon'&&device.hidden){if(input)input.checked=false;notify('Das Zigbee-Gerät ist in SALTA ausgeblendet und kann deshalb nicht in HomeKit veröffentlicht werden.',true);return}
  const row=input?.closest('.homekit-device-item');if(input)input.disabled=true;row?.classList.add('saving');
  try{
    const updated=await api(`/api/devices/${encodeURIComponent(id)}/config`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({homekitEnabled:Boolean(enabled)})});
    all=all.map(item=>item.id===id?updated:item);renderDevices();renderHomeKitDeviceList();
    await loadHomeKitSettings();
    notify(`${updated.name} wird ${enabled?'in HomeKit veröffentlicht':'nicht mehr in HomeKit veröffentlicht'}.`);
  }catch(error){if(input)input.checked=!enabled;renderHomeKitDeviceList();notify(error.message,true)}finally{row?.classList.remove('saving')}
}
function syncDeviceHomeKitRoomControls(){const useSaltaRoom=deviceHomeKitUseSaltaRoom.checked;deviceHomeKitRoom.disabled=useSaltaRoom;deviceHomeKitRoomField.classList.toggle('disabled',useSaltaRoom);if(useSaltaRoom)deviceHomeKitRoom.value=deviceRoom.value||''}
function renderDeviceHomeKitCompatibility(){if(!selectedDevice)return;const candidate={...selectedDevice,presentationType:devicePresentationSection.hidden?(selectedDevice.presentationType||'auto'):devicePresentationType.value};const supported=homeKitSupportedDevice(candidate);const hidden=selectedDevice.source==='phoscon'&&deviceHidden.checked;deviceHomeKitEnabled.disabled=!supported;deviceHomeKitEnabledRow.classList.toggle('disabled',!supported);if(!supported){deviceHomeKitEnabled.checked=false;deviceHomeKitCompatibility.className='homekit-compatibility unsupported';deviceHomeKitCompatibility.innerHTML=`<span class="mdi mdi-alert-circle-outline" aria-hidden="true"></span><div><strong>Noch nicht unterstützt</strong><small>${escapeHtml(typeLabels[resolvedPresentationType(candidate)]||resolvedPresentationType(candidate))} kann von der aktuellen SALTA-HomeKit-Bridge noch nicht veröffentlicht werden.</small></div>`;return}deviceHomeKitCompatibility.className=`homekit-compatibility ${hidden?'warning':'supported'}`;deviceHomeKitCompatibility.innerHTML=hidden?'<span class="mdi mdi-eye-off-outline" aria-hidden="true"></span><div><strong>HomeKit-kompatibel, aber ausgeblendet</strong><small>Das Zigbee-Gerät wird erst veröffentlicht, wenn „Gerät ausblenden“ deaktiviert ist.</small></div>':`<span class="mdi mdi-check-circle-outline" aria-hidden="true"></span><div><strong>HomeKit-kompatibel</strong><small>${escapeHtml(typeLabels[resolvedPresentationType(candidate)]||resolvedPresentationType(candidate))} wird von der SALTA-HomeKit-Bridge unterstützt.</small></div>`}

function daylightOverviewDevice(){
  return all.find(device=>device.source==='phoscon'&&String(device.profile||'').split(' + ').includes('Daylight'))||null;
}
function renderDaylightOverview(){
  const device=daylightOverviewDevice();
  if(!daylightOverviewStatus)return;
  if(!device){
    daylightOverviewStatus.className='daylight-overview-status unavailable';
    daylightOverviewStatus.innerHTML='<div class="daylight-current"><span class="mdi mdi-weather-cloudy-alert" aria-hidden="true"></span><div><strong>Nicht verfügbar</strong><small>Kein Phoscon-Daylight-Sensor gefunden</small></div></div>';
    return;
  }
  const state=device.state||{};
  const status=Number(state.daylightStatus);
  const phase=device.reachable===false?'Sensor offline':Number.isFinite(status)?(daylightPhaseLabels[status]||`Sonnenphase ${status}`):(state.daylight===true?'Tageslicht':state.dark===true?'Dunkel':'Status unbekannt');
  const daylightState=device.reachable===false?'Phoscon-Daylight nicht erreichbar':state.daylight===true?'Tageslicht':state.dark===true?'Dunkel':'Daylight-Sensor';
  const sunrise=state.sunrise?daylightTimeLabel(state.sunrise):'–';
  const sunset=state.sunset?daylightTimeLabel(state.sunset):'–';
  const icon=state.daylight===true?'mdi-weather-sunny':state.dark===true?'mdi-weather-night':'mdi-weather-sunset';
  daylightOverviewStatus.className=`daylight-overview-status ${device.reachable===false?'unavailable':state.daylight===true?'day':'night'}`;
  daylightOverviewStatus.innerHTML=`<div class="daylight-current"><span class="mdi ${icon}" aria-hidden="true"></span><div><strong>${escapeHtml(phase)}</strong><small>${escapeHtml(daylightState)}</small></div></div><div class="daylight-times"><div><span class="mdi mdi-weather-sunset-up" aria-hidden="true"></span><small>Sonnenaufgang</small><strong>${escapeHtml(sunrise)}</strong></div><div><span class="mdi mdi-weather-sunset-down" aria-hidden="true"></span><small>Sonnenuntergang</small><strong>${escapeHtml(sunset)}</strong></div></div>`;
}

function renderClimateMode(){
  if(!climateModeData)return;
  const summer=climateModeData.mode==='summer';
  climateSummerButton.classList.toggle('active',summer);
  climateWinterButton.classList.toggle('active',!summer);
  climateSummerButton.setAttribute('aria-pressed',String(summer));
  climateWinterButton.setAttribute('aria-pressed',String(!summer));
  const thermostats=Number(climateModeData.thermostats||0);
  const supported=Number(climateModeData.supportedThermostats||0);
  const result=climateModeData.lastResult;
  const applied=climateModeData.lastAppliedAt?new Date(climateModeData.lastAppliedAt).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'}):'noch nicht angewendet';
  const winterModeLabel=climateModeData.winterMode==='manual'?'Handbetrieb':'Automatik';
  climateWinterModeDisplay.innerHTML=`<span>Winterbetrieb</span><strong>${winterModeLabel}</strong>`;
  const chips=[`<span>${supported}/${thermostats} unterstützt</span>`,`<span>${escapeHtml(applied)}</span>`];
  if(result){chips.push(`<span class="${Number(result.failed||0)>0?'warning':'success'}">${Number(result.succeeded||0)} erfolgreich${Number(result.failed||0)>0?` · ${Number(result.failed)} fehlgeschlagen`:''}</span>`)}
  climateModeStatus.innerHTML=chips.join('');
}
function renderBatteryOverview(){
  if(!notificationData)return;
  const warnings=notificationData.warnings||[];
  const threshold=Number(notificationData.batteryThreshold||20);
  batteryOverviewStatus.className=`battery-overview-status ${warnings.length?'warning':'ok'}`;
  if(!warnings.length){batteryOverviewStatus.innerHTML=`<span class="mdi mdi-battery-check" aria-hidden="true"></span><div><strong>Keine Batteriewarnung</strong><small>Grenzwert ${threshold} % · aktuell alles im grünen Bereich</small></div>`;return}
  const names=warnings.slice(0,2).map(item=>`${escapeHtml(item.name)}${item.battery!==undefined?` · ${Number(item.battery)} %`:' · Low Battery'}`).join(' · ');
  const more=warnings.length>2?` · +${warnings.length-2} weitere`:'';
  batteryOverviewStatus.innerHTML=`<span class="mdi mdi-battery-alert-variant-outline" aria-hidden="true"></span><div><strong>${warnings.length} ${warnings.length===1?'Batteriewarnung':'Batteriewarnungen'}</strong><small>${names}${more}</small></div>`;
}
async function loadSystemControls(){
  try{
    [climateModeData,notificationData,generalData]=await Promise.all([api('/api/system/climate-mode'),api('/api/settings/notifications'),api('/api/settings/general')]);
    renderClimateMode();renderBatteryOverview();renderDebugModeIndicator();
  }catch(error){console.warn('System controls could not be loaded',error)}
}
async function applyClimateMode(mode){
  const summer=mode==='summer';const button=summer?climateSummerButton:climateWinterButton;const original=button.innerHTML;
  climateSummerButton.disabled=true;climateWinterButton.disabled=true;button.textContent='Wird angewendet …';
  try{
    climateModeData=await api('/api/system/climate-mode',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({mode})});
    renderClimateMode();
    renderClimateSettings();
    const result=climateModeData.lastResult||{};
    notify(`${summer?'Sommer':'Winter'}modus angewendet: ${Number(result.succeeded||0)} Thermostate erfolgreich${Number(result.failed||0)?`, ${Number(result.failed)} fehlgeschlagen`:''}.`,Number(result.failed||0)>0);
  }catch(error){notify(error.message,true)}finally{climateSummerButton.disabled=false;climateWinterButton.disabled=false;button.innerHTML=original;renderClimateMode()}
}
function renderClimateSettings(){
  if(!climateModeData)return;
  climateSettingsWinterMode.value=climateModeData.winterMode||'auto';
  const currentMode=climateModeData.mode==='summer'?'Sommer':'Winter';
  const winterMode=climateModeData.winterMode==='manual'?'Handbetrieb':'Automatik';
  const applied=climateModeData.lastAppliedAt?new Date(climateModeData.lastAppliedAt).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'}):'noch nicht angewendet';
  const result=climateModeData.lastResult;
  const resultText=result?`${Number(result.succeeded||0)} erfolgreich${Number(result.failed||0)?` · ${Number(result.failed)} fehlgeschlagen`:''}`:'noch kein Ergebnis';
  climateSettingsStatus.className='gateway-status connected';
  climateSettingsStatus.innerHTML=`<span class="gateway-status-dot" aria-hidden="true"></span><div><strong>Aktuell: ${currentMode} · Winter: ${winterMode}</strong><small>${Number(climateModeData.supportedThermostats||0)} von ${Number(climateModeData.thermostats||0)} Thermostaten unterstützt · zuletzt angewendet ${escapeHtml(applied)} · ${escapeHtml(resultText)}</small></div>`;
}
async function loadClimateSettings(){
  climateModeData=await api('/api/settings/climate-mode');
  renderClimateMode();renderClimateSettings();
  return climateModeData;
}
async function saveClimateSettings({announce=true}={}){
  climateModeData=await api('/api/settings/climate-mode',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({winterMode:climateSettingsWinterMode.value})});
  renderClimateMode();renderClimateSettings();
  if(announce)notify('Winterbetriebsart wurde gespeichert. Die Thermostate wurden nicht umgeschaltet.');
  return climateModeData;
}
async function applyClimateSettingsNow(){
  const original=climateApplyNowButton.innerHTML;climateApplyNowButton.disabled=true;
  try{
    await saveClimateSettings({announce:false});
    await applyClimateMode(climateModeData?.mode==='summer'?'summer':'winter');
  }catch(error){notify(error.message,true)}finally{climateApplyNowButton.disabled=false;climateApplyNowButton.innerHTML=original}
}
function debugLevelLabel(level){return level==='verbose'?'VERBOSE':level==='errors'?'FEHLER':'AUS'}
function renderDebugModeIndicator(){
  const level=generalData?.debugLevel||'off';
  const active=level!=='off';
  debugModeIndicator.hidden=!active;
  debugModeIndicator.dataset.level=level;
  debugModeIndicatorText.textContent=active?`DEBUG · ${debugLevelLabel(level)}`:'DEBUG';
}
function renderGeneralSettings(){
  if(!generalData)return;
  const level=generalData.debugLevel||'off';
  generalDebugLevel.value=level;
  generalSettingsStatus.className=`gateway-status ${level==='off'?'connected':'pending'}`;
  const title=level==='off'?'Normalbetrieb':'DEBUG aktiv';
  const detail=level==='verbose'?'Verbose: automatische Korrekturen und Fehler können per Pushover gemeldet werden.':level==='errors'?'Fehler: nur fehlgeschlagene Diagnoseaktionen können per Pushover gemeldet werden.':'Keine zusätzlichen DEBUG-Pushover-Meldungen.';
  generalSettingsStatus.innerHTML=`<span class="gateway-status-dot" aria-hidden="true"></span><div><strong>${title}</strong><small>${detail}</small></div>`;
  renderDebugModeIndicator();
}
async function loadGeneralSettings(){generalData=await api('/api/settings/general');renderGeneralSettings();return generalData}

function homeKitRuntimeLabel(){
  if(!homeKitData?.enabled)return 'Deaktiviert';
  if(homeKitData.running&&homeKitData.advertised)return 'Aktiv · angekündigt';
  if(homeKitData.running)return 'Aktiv · startet';
  return 'Fehler / nicht gestartet';
}
function renderHomeKitSettings(){
  if(!homeKitData)return;
  homeKitEnabled.checked=Boolean(homeKitData.enabled);
  homeKitName.value=homeKitData.name||'SALTA';
  homeKitNetworkInterface.innerHTML='<option value="">Automatisch / alle geeigneten Schnittstellen</option>'+(homeKitData.networkInterfaces||[]).map(entry=>`<option value="${escapeHtml(entry.name)}">${escapeHtml(entry.name)} · ${escapeHtml((entry.addresses||[]).join(', '))}</option>`).join('');
  homeKitNetworkInterface.value=homeKitData.networkInterface||'';
  homeKitRuntimeState.textContent=homeKitRuntimeLabel();
  homeKitPairingState.textContent=homeKitData.paired?'Gekoppelt':'Nicht gekoppelt';
  homeKitUsername.textContent=homeKitData.username||'–';
  homeKitPort.textContent=homeKitData.listeningPort?String(homeKitData.listeningPort):homeKitData.port?String(homeKitData.port):'–';
  homeKitDeviceSummary.textContent=`${Number(homeKitData.publishedDevices||0)} veröffentlicht · ${Number(homeKitData.supportedDevices||0)} unterstützt`;
  const healthy=!homeKitData.enabled||(homeKitData.running&&homeKitData.advertised&&!homeKitData.lastError);
  homeKitStatus.className=`gateway-status ${healthy?(homeKitData.enabled?'connected':'pending'):'disconnected'}`;
  const title=!homeKitData.enabled?'HomeKit ist deaktiviert':healthy?'HomeKit-Bridge läuft':'HomeKit-Bridge nicht betriebsbereit';
  const detail=homeKitData.lastError?`Fehler: ${homeKitData.lastError}`:homeKitData.enabled?(homeKitData.paired?'Bridge ist mit Apple Home gekoppelt.':'Bridge wartet auf die Kopplung mit Apple Home.'):'Aktiviere die Bridge, wenn du SALTA-Geräte in Apple Home verwenden möchtest.';
  homeKitStatus.innerHTML=`<span class="gateway-status-dot" aria-hidden="true"></span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div>`;
  homeKitCredentialWarning.hidden=homeKitData.encryptionStatus!=='invalid';
  homeKitCredentialWarning.textContent=homeKitData.encryptionStatus==='invalid'?'Die gespeicherten HomeKit-Pairingdaten können mit dem aktuellen SALTA_ENCRYPTION_KEY nicht entschlüsselt werden. Stelle ein passendes Disaster-Recovery-Backup wieder her oder setze die HomeKit-Konfiguration zurück.':'';
  const showPairing=Boolean(homeKitData.enabled&&!homeKitData.paired&&homeKitData.pairingCode);
  const showQr=Boolean(showPairing&&homeKitData.setupUri);
  homeKitPairingBox.hidden=!showPairing;
  homeKitPairingCode.textContent=showPairing?homeKitData.pairingCode:'–';
  if(showQr){
    try{homeKitPairingQr.innerHTML=renderHomeKitSetupQrSvg(homeKitData.setupUri)}catch{homeKitPairingQr.innerHTML='';}
  }else homeKitPairingQr.innerHTML='';
  homeKitPairingQr.hidden=!showQr;
  homeKitSetupUriState.textContent=showPairing?(showQr?'QR-Code oder Pairing-Code werden nach erfolgreicher Kopplung nicht mehr angezeigt.':'Der QR-Code ist noch nicht verfügbar. Du kannst den Pairing-Code manuell verwenden.') : '';
  homeKitResetButton.disabled=false;
  renderHomeKitDeviceList();
}
async function loadHomeKitSettings(){
  try{homeKitData=await api('/api/settings/homekit');renderHomeKitSettings();return homeKitData}catch(error){notify(error.message,true);throw error}
}
async function saveHomeKitSettings(){
  const originalEnabled=Boolean(homeKitData?.enabled);
  try{
    homeKitData=await api('/api/settings/homekit',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:homeKitEnabled.checked,name:homeKitName.value.trim(),networkInterface:homeKitNetworkInterface.value})});
    renderHomeKitSettings();await load();
    notify(homeKitData.enabled?(originalEnabled?'HomeKit-Einstellungen wurden gespeichert.':'HomeKit wurde aktiviert. Die Bridge kann jetzt mit Apple Home gekoppelt werden.'):'HomeKit wurde deaktiviert.');
  }catch(error){await loadHomeKitSettings().catch(()=>{homeKitEnabled.checked=originalEnabled});notify(error.message,true)}
}
async function resetHomeKitPairing(){
  if(!confirm('HomeKit-Pairing wirklich zurücksetzen? Die SALTA-Bridge muss anschließend in Apple Home erneut hinzugefügt werden.'))return;
  const button=homeKitResetButton;const original=button.textContent;button.disabled=true;button.textContent='Pairing wird zurückgesetzt …';
  try{homeKitData=await api('/api/settings/homekit/reset',{method:'POST'});renderHomeKitSettings();notify('HomeKit-Pairing wurde zurückgesetzt. Verwende den neuen Pairing-Code.')}catch(error){notify(error.message,true)}finally{button.disabled=false;button.textContent=original}
}
async function saveGeneralSettings(){
  try{
    generalData=await api('/api/settings/general',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({debugLevel:generalDebugLevel.value})});
    renderGeneralSettings();notify('Allgemeine Einstellungen wurden gespeichert.');
  }catch(error){notify(error.message,true)}
}

function renderNotificationSettings(){
  if(!notificationData)return;
  notificationEnabled.checked=Boolean(notificationData.enabled);
  notificationUserKey.value='';notificationApiToken.value='';
  notificationUserKeyState.textContent=notificationData.userKeyConfigured?'User Key ist verschlüsselt gespeichert. Leer lassen, um ihn beizubehalten.':'Noch kein User Key gespeichert.';
  notificationApiTokenState.textContent=notificationData.apiTokenConfigured?'API Token ist verschlüsselt gespeichert. Leer lassen, um ihn beizubehalten.':'Noch kein API Token gespeichert.';
  notificationBatteryThreshold.value=String(notificationData.batteryThreshold||20);
  notificationCredentialWarning.hidden=notificationData.encryptionStatus!=='invalid';
  notificationCredentialWarning.textContent=notificationData.encryptionStatus==='invalid'?'Die gespeicherten Pushover-Zugangsdaten können mit dem aktuellen SALTA_ENCRYPTION_KEY nicht entschlüsselt werden. Bitte User Key und API Token neu eingeben.':'';
  const warnings=notificationData.warnings||[];
  const configured=Boolean(notificationData.configured);
  notificationStatus.className=`gateway-status ${configured?'connected':'disconnected'}`;
  const last=notificationData.lastSentAt?`Letzte Batteriewarnung ${new Date(notificationData.lastSentAt).toLocaleString('de-DE')}`:'Noch keine Batteriewarnung gesendet';
  const next=notificationData.nextEligibleAt?` · frühestens wieder ${new Date(notificationData.nextEligibleAt).toLocaleString('de-DE')}`:'';
  notificationStatus.innerHTML=`<span class="gateway-status-dot" aria-hidden="true"></span><div><strong>${configured?'Pushover konfiguriert':'Pushover nicht vollständig konfiguriert'}</strong><small>${escapeHtml(last+next)}</small></div>`;
  notificationWarningList.innerHTML=warnings.length?`<strong>Aktuelle Warnungen</strong>${warnings.map(item=>`<div><span>${escapeHtml(item.name)}${item.room?` · ${escapeHtml(item.room)}`:''}</span><b>${item.battery!==undefined?`${Number(item.battery)} %`:'Low Battery'}</b></div>`).join('')}`:'<p class="setting-note">Aktuell meldet kein Gerät einen niedrigen Batteriestand.</p>';
}
async function loadNotificationSettings(){notificationData=await api('/api/settings/notifications');renderNotificationSettings();renderBatteryOverview();return notificationData}
async function saveNotificationSettings(){
  try{
    notificationData=await api('/api/settings/notifications',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:notificationEnabled.checked,userKey:notificationUserKey.value.trim()||undefined,apiToken:notificationApiToken.value.trim()||undefined,batteryThreshold:Number(notificationBatteryThreshold.value)})});
    renderNotificationSettings();renderBatteryOverview();notify('Pushover- und Batteriewarnungs-Einstellungen wurden gespeichert.');
  }catch(error){notify(error.message,true)}
}
async function testPushover(){
  const original=notificationTestButton.innerHTML;notificationTestButton.disabled=true;notificationTestButton.textContent='Test wird gesendet …';
  try{await api('/api/settings/notifications/test',{method:'POST'});notify('Pushover-Testnachricht wurde gesendet.')}catch(error){notify(error.message,true)}finally{notificationTestButton.disabled=false;notificationTestButton.innerHTML=original}
}

function recoveryBackupSummary(backup){
  const created=backup?.createdAt?new Date(backup.createdAt):null;
  const date=created&&!Number.isNaN(created.getTime())?created.toLocaleString('de-DE'):'unbekannt';
  const summary=backup?.summary||{};
  return `SALTA ${backup?.saltaVersion||'?'} · ${date} · ${Number(summary.rooms||0)} Räume · ${Number(summary.devices||0)} Geräte · ${Number(summary.automations||0)} Automationen · ${Number(summary.homeKitFiles||0)} HomeKit-Dateien`;
}
async function exportDisasterRecoveryBackup(){
  const password=recoveryBackupExportPassword.value;const confirmation=recoveryBackupExportPasswordConfirm.value;
  if(password.length<12){recoveryBackupExportPassword.focus();notify('Das Backup-Passwort muss mindestens 12 Zeichen lang sein.',true);return}
  if(password!==confirmation){recoveryBackupExportPasswordConfirm.focus();notify('Die Backup-Passwörter stimmen nicht überein.',true);return}
  const original=recoveryBackupExportButton.innerHTML;recoveryBackupExportButton.disabled=true;recoveryBackupExportButton.textContent='Vollsicherung wird verschlüsselt …';
  try{
    const backup=await api('/api/settings/disaster-recovery-backup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});
    const blob=new Blob([JSON.stringify(backup,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);
    const stamp=String(backup.createdAt||new Date().toISOString()).replace(/[:.]/g,'-');const link=document.createElement('a');link.href=url;link.download=`SALTA-full-backup-${stamp}.salta-backup.json`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    recoveryBackupExportPassword.value='';recoveryBackupExportPasswordConfirm.value='';notify('Passwortverschlüsselte SALTA-Vollsicherung wurde erstellt.');
  }catch(error){notify(error.message,true)}finally{recoveryBackupExportButton.disabled=false;recoveryBackupExportButton.innerHTML=original}
}
async function inspectDisasterRecoveryBackupFile(file){
  selectedRecoveryBackup=null;recoveryBackupImportButton.disabled=true;
  if(!file){recoveryBackupFileState.className='configuration-backup-file-state';recoveryBackupFileState.textContent='Noch keine Vollsicherung ausgewählt.';return}
  if(file.size>10*1024*1024){recoveryBackupFileState.className='configuration-backup-file-state error';recoveryBackupFileState.textContent='Die Sicherungsdatei ist größer als 10 MB.';return}
  try{
    const backup=JSON.parse(await file.text());
    if(backup?.format!=='salta-disaster-recovery-backup'||backup?.formatVersion!==1||typeof backup?.ciphertext!=='string'||backup?.encryption?.algorithm!=='aes-256-gcm'||backup?.encryption?.kdf!=='scrypt')throw new Error('INVALID_BACKUP');
    selectedRecoveryBackup=backup;recoveryBackupImportButton.disabled=false;recoveryBackupFileState.className='configuration-backup-file-state ready';recoveryBackupFileState.textContent=`${file.name} · ${recoveryBackupSummary(backup)}`;
  }catch{recoveryBackupFileState.className='configuration-backup-file-state error';recoveryBackupFileState.textContent='Die Datei ist keine gültige SALTA-Vollsicherung.'}
}
async function importDisasterRecoveryBackupFile(){
  if(!selectedRecoveryBackup)return;const password=recoveryBackupImportPassword.value;
  if(password.length<12){recoveryBackupImportPassword.focus();notify('Gib das Backup-Passwort ein.',true);return}
  if(!confirm('Die aktuelle SALTA-Konfiguration, Laufzeitschlüssel und HomeKit-Pairing-Daten werden durch diese Vollsicherung ersetzt. SALTA startet danach automatisch neu. Fortfahren?'))return;
  const original=recoveryBackupImportButton.innerHTML;recoveryBackupImportButton.disabled=true;recoveryBackupImportButton.textContent='System wird wiederhergestellt …';
  try{
    const result=await api('/api/settings/disaster-recovery-backup/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password,backup:selectedRecoveryBackup})});
    const warning=Array.isArray(result.deploymentWarnings)&&result.deploymentWarnings.length?` · ${result.deploymentWarnings.length} Host-Einstellung(en) prüfen`:'';
    recoveryBackupFileState.className='configuration-backup-file-state ready';recoveryBackupFileState.textContent=`Wiederherstellung abgeschlossen · ${Number(result.rooms||0)} Räume · ${Number(result.devices||0)} Geräte · ${Number(result.automations||0)} Automationen · ${Number(result.homeKitFiles||0)} HomeKit-Dateien${warning}. SALTA startet neu.`;
    recoveryBackupImportPassword.value='';notify('SALTA wurde aus der Vollsicherung wiederhergestellt und startet neu.');if(result.restartScheduled)setTimeout(()=>location.reload(),4500);
  }catch(error){recoveryBackupImportButton.disabled=false;recoveryBackupImportButton.innerHTML=original;recoveryBackupFileState.className='configuration-backup-file-state error';recoveryBackupFileState.textContent=error.message;notify(error.message,true)}
}

async function initializeSession(){
  const response=await fetch('/auth/session',{credentials:'same-origin',headers:{accept:'application/json'}});
  if(!response.ok){location.replace('/login');throw new Error('Authentication required')}
  const session=await response.json();
  csrfToken=session.csrfToken;
  return session;
}
async function api(url,options={}){
  const method=String(options.method||'GET').toUpperCase();
  const headers=new Headers(options.headers||{});
  if(!['GET','HEAD','OPTIONS'].includes(method))headers.set('X-SALTA-CSRF',csrfToken);
  const response=await fetch(url,{...options,method,headers,credentials:'same-origin'});
  const payload=response.status===204?null:await response.json().catch(()=>null);
  if(!response.ok){
    const code=payload?.error?.code||`HTTP_${response.status}`;
    if(response.status===401&&code==='UNAUTHORIZED'){location.replace('/login');throw new Error('Authentication required')}
    const error=new Error(payload?.error?.message||`HTTP ${response.status}`);
    error.code=code;
    error.status=response.status;
    error.requestId=payload?.error?.requestId;
    error.details=payload?.error?.details||{};
    throw error;
  }
  return payload;
}
async function logout(){
  try{await api('/auth/logout',{method:'POST'})}finally{location.replace('/login')}
}
function updateDashboardSummary(){
  renderDaylightOverview();
  const dashboardDevices=all.filter(device=>device.source!=='presence');
  deviceCount.textContent=dashboardDevices.length;
  reachableCount.textContent=dashboardDevices.filter(device=>device.reachable).length;
  roomCount.textContent=rooms.length;
  const currentPower=dashboardDevices.filter(device=>device.reachable).reduce((sum,device)=>sum+Number(device.state?.totalPower??device.state?.power??0),0);
  power.textContent=dashboardDevices.some(device=>device.state?.totalPower!==undefined||device.state?.power!==undefined)?String(Math.round(currentPower)):'–';

  const housePresence=all.find(device=>device.id==='presence:house'||(device.source==='presence'&&device.profile==='presence-group'));
  const presenceCard=document.getElementById('overviewPresenceCard');
  const presenceValue=document.getElementById('overviewPresence');
  const presenceDetail=document.getElementById('overviewPresenceDetail');
  if(!presenceCard||!presenceValue||!presenceDetail)return;
  presenceCard.classList.remove('home','away','unconfigured');
  if(!housePresence){
    presenceCard.classList.add('unconfigured');
    presenceValue.textContent='–';
    presenceDetail.textContent='nicht eingerichtet';
    return;
  }
  const count=Math.max(0,Number(housePresence.state?.presentCount)||0);
  const members=Math.max(0,Number(housePresence.adapterData?.memberCount)||0);
  const anyHome=Boolean(housePresence.state?.anyHome??housePresence.state?.present);
  presenceCard.classList.add(anyHome?'home':'away');
  presenceValue.textContent=anyHome?'Zuhause':'Niemand';
  presenceDetail.textContent=members?`${count} von ${members} anwesend`:'keine Personen konfiguriert';
  presenceCard.title=members?`${count} von ${members} ${members===1?'Person':'Personen'} anwesend`:'Noch keine Person für die Präsenzerkennung konfiguriert';
}
async function load(){
  try{
    [all,rooms,phosconSettingsStatus,openCcuSettingsStatus]=await Promise.all([api('/api/devices'),api('/api/rooms'),api('/api/settings/phoscon'),api('/api/settings/openccu')]);
    renderFilters();
    renderDevices();
    renderRooms();
    updateDashboardSummary();
    await loadSystemControls();
    renderPhosconConnectionNotice();
    renderOpenCcuConnectionNotice();
    await loadAutomations();
    if(routeFromHash()==='presence')await loadPresence();
  }catch(error){notify(error.message,true)}
}
function liveRefreshAllowedForRoute(route){return route!=='automations'&&route!=='settings'}
async function refreshLiveData(){
  if(!liveRefreshAllowedForRoute(routeFromHash())||liveRefreshInFlight)return;
  liveRefreshInFlight=true;
  try{
    all=await api('/api/devices');
    if(!activeCoverSliderId&&!activeBrightnessSliderId&&!activeTemperatureSliderId)renderDevices();
    updateDashboardSummary();
    automationDevicesChanged();
    if(routeFromHash()==='presence')await loadPresence();
  }catch(error){
    console.warn('Live device refresh failed',error);
  }finally{
    liveRefreshInFlight=false;
  }
}
function fillRoomFilter(select){const current=select.value;select.innerHTML='<option value="">Alle Räume</option>'+rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')+'<option value="unassigned">Nicht zugeordnet</option>';select.value=current;}
function renderFilters(){fillRoomFilter(roomFilter);fillRoomFilter(zigbeeRoomFilter);fillRoomFilter(openCcuRoomFilter);fillRoomFilter(virtualRoomFilter)}
function filtered(source,searchInput,roomSelect){const q=searchInput.value.toLowerCase();const rf=roomSelect.value;return all.filter(d=>d.source===source&&d.name.toLowerCase().includes(q)&&(!rf||(rf==='unassigned'?!d.roomId:d.roomId===rf)))}
function boundedPosition(value){const number=Number(value);return Number.isFinite(number)?Math.min(100,Math.max(0,Math.round(number))):null}
function brightnessValue(d){const value=Number(d.state?.brightness);return Number.isFinite(value)?Math.min(100,Math.max(0,Math.round(value))):0}
function brightnessControl(d,instance=''){if(!d.capabilities.includes('setBrightness'))return '';const value=brightnessValue(d);const controlId=`brightness-${d.id}${instance?`-${instance}`:''}`;return `<div class="brightness-control"><div class="brightness-control-head"><label for="${controlId}">Helligkeit</label><output for="${controlId}">${value} %</output></div><input id="${controlId}" type="range" min="0" max="100" step="1" value="${value}" onpointerdown="activeBrightnessSliderId='${d.id}'" onpointerup="activeBrightnessSliderId=null" onblur="activeBrightnessSliderId=null" oninput="previewBrightness('${d.id}',this.value,this)" onchange="setBrightness('${d.id}',this.value)" aria-label="Helligkeit von ${escapeHtml(d.name)}"></div>`}
function previewBrightness(id,value,input){activeBrightnessSliderId=id;const output=input?.closest('.brightness-control')?.querySelector('output');if(output)output.textContent=`${Math.round(Number(value)||0)} %`}
async function setBrightness(id,value){activeBrightnessSliderId=id;try{await cmd(id,'setBrightness',Math.round(Number(value)||0))}finally{activeBrightnessSliderId=null}}
function thermostatRange(d){const metadata=d.adapterData||{};const min=Number(metadata.targetTemperatureMin??4.5);const max=Number(metadata.targetTemperatureMax??30);const step=Number(metadata.targetTemperatureStep??0.5);return {min:Number.isFinite(min)?min:4.5,max:Number.isFinite(max)?max:30,step:Number.isFinite(step)&&step>0?step:0.5}}
function targetTemperatureValue(d){const range=thermostatRange(d);const value=Number(d.state?.targetTemperature);return Number.isFinite(value)?Math.min(range.max,Math.max(range.min,value)):range.min}
function thermostatModeValue(d){const mode=String(d.state?.controlMode||'').trim().toLowerCase();return ['off','manual','auto'].includes(mode)?mode:''}
function thermostatModeControl(d){const displayed=String(d.state?.controlMode||'').trim();const current=thermostatModeValue(d);const supported=d.capabilities.includes('setThermostatMode')||(d.source==='openccu'&&d.type==='thermostat'&&d.capabilities.includes('setTargetTemperature')&&Boolean(displayed));if(!supported)return '';const disabled=d.reachable?'':' disabled';const options=[['off','Aus','power-off'],['manual','Hand','hand-back-right-outline'],['auto','Automatik','calendar-clock']];return `<div class="thermostat-mode-control"><div class="thermostat-mode-head"><span>Betriebsart</span><strong>${displayed?fmt('controlMode',displayed):'–'}</strong></div><div class="thermostat-mode-buttons" role="group" aria-label="Betriebsart von ${escapeHtml(d.name)}">${options.map(([value,label,icon])=>`<button type="button" class="${current===value?'active':''}" aria-pressed="${current===value}" onclick="setThermostatMode('${d.id}','${value}')"${disabled}>${iconMarkup(icon)}<span>${label}</span></button>`).join('')}</div></div>`}
function targetTemperatureControl(d,instance=''){if(!d.capabilities.includes('setTargetTemperature'))return '';const range=thermostatRange(d);const value=targetTemperatureValue(d);const disabled=d.reachable?'':' disabled';const controlId=`target-temperature-${d.id}${instance?`-${instance}`:''}`;return `<div class="temperature-control"><div class="temperature-control-head"><label for="${controlId}">Solltemperatur</label><output for="${controlId}">${fmt('targetTemperature',value)}</output></div><input id="${controlId}" type="range" min="${range.min}" max="${range.max}" step="${range.step}" value="${value}" onpointerdown="activeTemperatureSliderId='${d.id}'" onpointerup="activeTemperatureSliderId=null" onblur="activeTemperatureSliderId=null" oninput="previewTargetTemperature('${d.id}',this.value,this)" onchange="setTargetTemperature('${d.id}',this.value)" aria-label="Solltemperatur von ${escapeHtml(d.name)}"${disabled}></div>`}
function previewTargetTemperature(id,value,input){activeTemperatureSliderId=id;const output=input?.closest('.temperature-control')?.querySelector('output');if(output)output.textContent=fmt('targetTemperature',Number(value))}
async function setTargetTemperature(id,value){activeTemperatureSliderId=id;try{await cmd(id,'setTargetTemperature',Number(value));notify(`Solltemperatur auf ${fmt('targetTemperature',Number(value))} gesetzt.`)}catch(error){notify(error.message,true)}finally{activeTemperatureSliderId=null}}
async function setThermostatMode(id,mode){const labels={off:'Aus',manual:'Hand',auto:'Automatik'};try{await cmd(id,'setThermostatMode',mode);notify(`Betriebsart auf ${labels[mode]||mode} gesetzt.`)}catch(error){notify(error.message,true)}}
function coverPosition(d){return coverSliderDrafts.has(d.id)?coverSliderDrafts.get(d.id):boundedPosition(d.state?.currentPosition)}
function beginCoverPosition(id,value,input){activeCoverSliderId=id;previewCoverPosition(id,value,input)}
function previewCoverPosition(id,value,input){const position=boundedPosition(value);if(position===null)return;coverSliderDrafts.set(id,position);const output=input?.closest('.cover-control')?.querySelector('output');if(output)output.textContent=`${position} %`}
function endCoverPosition(id){if(activeCoverSliderId===id)activeCoverSliderId=null}
async function setCoverPosition(id,value){const position=boundedPosition(value);if(position===null)return;coverSliderDrafts.set(id,position);activeCoverSliderId=null;try{await api(`/api/devices/${id}/command`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({capability:'setTargetPosition',value:position})});coverSliderDrafts.delete(id);all=await api('/api/devices');renderDevices();updateDashboardSummary();notify(`Rollladen fährt auf ${position} %.`)}catch(error){coverSliderDrafts.delete(id);renderDevices();notify(error.message,true)}}
function coverControl(d,instance=''){if(d.type!=='windowCovering'||!d.capabilities.includes('setTargetPosition'))return'';const position=coverPosition(d);if(position===null)return'<div class="cover-position-unavailable">Positionssteuerung ist erst nach der Kalibrierung verfügbar.</div>';const disabled=d.reachable?'':' disabled';const controlId=`cover-position-${d.id}${instance?`-${instance}`:''}`;return `<div class="cover-control"><div class="cover-control-head"><label for="${escapeHtml(controlId)}">Höhe</label><output for="${escapeHtml(controlId)}">${position} %</output></div><input id="${escapeHtml(controlId)}" type="range" min="0" max="100" step="1" value="${position}" aria-label="Höhe für ${escapeHtml(d.name)}" onfocus="beginCoverPosition('${d.id}',this.value,this)" onpointerdown="beginCoverPosition('${d.id}',this.value,this)" oninput="previewCoverPosition('${d.id}',this.value,this)" onchange="setCoverPosition('${d.id}',this.value)" onblur="endCoverPosition('${d.id}')"${disabled}></div>`}
function shellyWebUrl(d){if(d?.source!=='shelly')return '';const host=String(d.host||'').trim();if(!host)return '';try{const candidate=/^https?:\/\//i.test(host)?host:`http://${host}`;const url=new URL(candidate);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return '';return url.href}catch{return ''}}
function openShellyWeb(id){const device=all.find(item=>item.id===id);const url=shellyWebUrl(device);if(!url){notify('Für dieses Shelly ist keine gültige Geräteadresse verfügbar.',true);return}const opened=window.open(url,'_blank','noopener,noreferrer');if(opened)opened.opener=null}
function deviceShellyWebButton(d){if(!shellyWebUrl(d))return '';return `<button type="button" class="secondary device-web-button" onclick="openShellyWeb('${d.id}')" aria-label="Weboberfläche von ${escapeHtml(d.name)} öffnen" title="Shelly-Weboberfläche öffnen">${iconMarkup('open-in-new')}</button>`}
function deviceConfigButton(d){return `<button type="button" class="secondary device-config-button" onclick="openDevice('${d.id}')" aria-label="${escapeHtml(d.name)} konfigurieren" title="Konfigurieren">${iconMarkup('cog-outline')}</button>`}
function isVirtualButton(d){return d?.source==='virtual'&&d?.adapterData?.virtualType==='button'}
function actions(d){const a=[];if(isVirtualButton(d)&&d.capabilities.includes('turnOn'))return `<button onclick="cmd('${d.id}','turnOn')">${iconMarkup('gesture-tap-button')}<span>Drücken</span></button>`;if(d.capabilities.includes('toggle'))a.push(`<button onclick="cmd('${d.id}','toggle')">${iconMarkup(d.state.on?'power-off':'power')}<span>${d.state.on?'Ausschalten':'Einschalten'}</span></button>`);if(d.capabilities.includes('open'))a.push(`<button onclick="cmd('${d.id}','open')">${iconMarkup('arrow-up')}<span>Öffnen</span></button><button onclick="cmd('${d.id}','stop')">${iconMarkup('stop')}<span>Stopp</span></button><button onclick="cmd('${d.id}','close')">${iconMarkup('arrow-down')}<span>Schließen</span></button>`);return a.join('')}
function deviceControls(d,instance=''){const controls=[brightnessControl(d,instance),thermostatModeControl(d),targetTemperatureControl(d,instance),coverControl(d,instance)].filter(Boolean);return controls.length?`<div class="device-controls">${controls.join('')}</div>`:''}
function openCcuChannelMeta(d){if(d.source!=='openccu')return '';const channelName=String(d.adapterData?.channelName||'').trim();if(!channelName||channelName.toLocaleLowerCase()===String(d.name||'').trim().toLocaleLowerCase())return '';const channelIndex=String(d.adapterData?.channelAddress||'').split(':').at(-1);const generated=channelIndex&&channelName.toLocaleLowerCase()===`${String(d.name||'').trim()}:${channelIndex}`.toLocaleLowerCase();return generated?'':` · ${escapeHtml(channelName)}`}
function deviceCard(d,showSource=false,instance=''){const virtualButton=isVirtualButton(d);const visualType=virtualButton?'button':resolvedPresentationType(d);const stateVisual=!virtualButton&&['switch','light','outlet'].includes(visualType);const stateKnown=stateVisual&&d.reachable&&typeof d.state?.on==='boolean';const stateClass=stateKnown?(d.state.on?' device-state-on':' device-state-off'):'';const stateLabel=stateKnown?`, ${d.state.on?'An':'Aus'}`:'';const hidden=d.source==='phoscon'&&Boolean(d.hidden);const hiddenClass=hidden?' hidden-device':'';const hiddenLabel=hidden?', ausgeblendet':'';const values=displayedState(d).filter(([key])=>!((stateVisual||virtualButton)&&key==='on'));const model=d.model?` · ${escapeHtml(d.model)}`:'';const channel=d.profile==='switch'&&d.channelCount>1?` · Kanal ${Number(d.componentId||0)+1}`:'';const sourceChannel=openCcuChannelMeta(d);const context=showSource?(sourceLabels[d.source]||d.source):(d.room||'Nicht zugeordnet');const actionMarkup=actions(d);return `<article class="device ${d.reachable?'':'offline'}${stateClass}${hiddenClass}"${stateKnown||hidden?` aria-label="${escapeHtml(d.name)}${stateLabel}${hiddenLabel}"`:''}><div class="device-head"><div class="device-head-main"><div class="icon">${iconMarkup(icons[visualType]||'help-circle-outline')}</div><div class="device-title-block"><h3>${escapeHtml(d.name)}</h3><div class="meta">${escapeHtml(context)} · ${escapeHtml(typeLabels[visualType]||visualType)}${channel}${sourceChannel}${model}</div></div></div><div class="device-statuses">${hidden?'<span class="hidden-device-badge">Ausgeblendet</span>':''}${deviceShellyWebButton(d)}${deviceConfigButton(d)}<div class="dot"></div></div></div>${values.length?`<div class="values">${values.map(([k,v])=>`<div class="value"><b>${fmt(k,v)}</b><small>${labels[k]||k}</small></div>`).join('')}</div>`:''}${deviceControls(d,instance)}${actionMarkup?`<div class="actions">${actionMarkup}</div>`:''}</article>`}
function deviceRoomGroup(group,showSource=false,instance=''){return `<section class="device-room-group" data-room-id="${escapeHtml(group.id)}"><div class="device-room-heading"><div class="device-room-title"><span class="device-room-icon" aria-hidden="true">${iconMarkup(group.icon)}</span><div><h2>${escapeHtml(group.name)}</h2><p>${group.devices.length} ${group.devices.length===1?'Gerät':'Geräte'}</p></div></div></div><div class="grid">${group.devices.map(device=>deviceCard(device,showSource,instance)).join('')}</div></section>`}
function renderOverviewDevices(){const groups=roomGrouping.groupAssignedDevicesByRoom(rooms,all);if(!groups.length){overviewDeviceGridElement.innerHTML='<article class="empty-state"><h3>Noch keine Geräte zugeordnet</h3><p class="muted">Auf der Übersicht werden ausschließlich Geräte mit einer gültigen Raumzuordnung angezeigt.</p></article>';return}overviewDeviceGridElement.innerHTML=groups.map(group=>deviceRoomGroup(group,true,'overview')).join('')}
function renderDeviceGrid(source,grid,searchInput,roomSelect){const devices=filtered(source,searchInput,roomSelect);if(!devices.length){const adapter=source==='phoscon'?{connected:phosconSettingsStatus?.gateway?.connected,title:'Phoscon ist nicht verbunden',message:'Verbinde unter Einstellungen eine Phoscon-/deCONZ-Instanz.'}:source==='openccu'?{connected:openCcuSettingsStatus?.gateway?.connected,title:'OpenCCU ist nicht verbunden',message:'Verbinde unter Einstellungen eine OpenCCU-Instanz.'}:{connected:true,title:'Keine Geräte gefunden',message:'Passe Suche oder Raumfilter an.'};grid.innerHTML=`<article class="empty-state"><h3>${adapter.connected?'Keine Geräte gefunden':adapter.title}</h3><p class="muted">${adapter.connected?'Passe Suche oder Raumfilter an.':adapter.message}</p></article>`;return}const knownRoomIds=new Set(rooms.map(room=>room.id));const groups=rooms.map(room=>({id:room.id,name:room.name,icon:room.icon||'home-outline',devices:devices.filter(device=>device.roomId===room.id)})).filter(group=>group.devices.length);const unassigned=devices.filter(device=>!device.roomId||!knownRoomIds.has(device.roomId));if(unassigned.length)groups.push({id:'unassigned',name:'Nicht zugeordnet',icon:'help-circle-outline',devices:unassigned});grid.innerHTML=groups.map(group=>deviceRoomGroup(group)).join('')}
function renderDevices(){renderOverviewDevices();renderDeviceGrid('shelly',deviceGrid,filter,roomFilter);renderDeviceGrid('phoscon',zigbeeGrid,zigbeeFilter,zigbeeRoomFilter);renderDeviceGrid('openccu',openCcuGrid,openCcuFilter,openCcuRoomFilter);renderDeviceGrid('virtual',virtualGrid,virtualFilter,virtualRoomFilter);renderHomeKitDeviceList()}
function currentRoomEditDraft(){
  if(!editingRoomId)return null;
  const row=roomRow(editingRoomId);
  const form=row?.querySelector('.room-edit-form');
  if(!form||form.hidden)return null;
  const activeElement=document.activeElement;
  const activeField=form.contains(activeElement)&&(activeElement instanceof HTMLInputElement||activeElement instanceof HTMLSelectElement)?activeElement.name:null;
  return {
    id:editingRoomId,
    name:form.elements.name.value,
    icon:form.elements.icon.value,
    activeField,
    selectionStart:activeElement instanceof HTMLInputElement?activeElement.selectionStart:null,
    selectionEnd:activeElement instanceof HTMLInputElement?activeElement.selectionEnd:null
  };
}
function restoreRoomEdit(draft,{focus=false}={}){
  if(!draft)return;
  const row=roomRow(draft.id);
  if(!row){editingRoomId=null;return}
  row.querySelector('.room-summary').hidden=true;
  const form=row.querySelector('.room-edit-form');
  form.hidden=false;
  form.elements.name.value=draft.name;
  form.elements.icon.value=draft.icon;
  if(focus){
    const input=form.elements[draft.activeField||'name'];
    input.focus();
    if(input instanceof HTMLInputElement&&draft.activeField&&draft.selectionStart!==null&&draft.selectionEnd!==null)input.setSelectionRange(draft.selectionStart,draft.selectionEnd);
  }
}
function renderRooms(){
  const draft=currentRoomEditDraft();
  roomPageCount.textContent=rooms.length;
  roomList.innerHTML=rooms.map((r,index)=>{const count=all.filter(d=>d.roomId===r.id).length;const first=index===0;const last=index===rooms.length-1;return `<div class="room-row" data-room-id="${r.id}"><div class="room-summary"><div class="room-identity"><div class="room-order-controls"><button class="secondary room-order-button" type="button" onclick="moveRoom('${r.id}',-1)" aria-label="${escapeHtml(r.name)} nach oben verschieben" title="Nach oben"${first?' disabled':''}>${iconMarkup('chevron-up')}</button><button class="secondary room-order-button" type="button" onclick="moveRoom('${r.id}',1)" aria-label="${escapeHtml(r.name)} nach unten verschieben" title="Nach unten"${last?' disabled':''}>${iconMarkup('chevron-down')}</button></div><span class="room-icon" aria-hidden="true">${iconMarkup(r.icon||'home-outline')}</span><div><strong>${escapeHtml(r.name)}</strong><small>${count} ${count===1?'Gerät':'Geräte'}</small></div></div><div class="room-actions"><button class="secondary" type="button" onclick="startRoomEdit('${r.id}')">${iconMarkup('pencil-outline')}<span>Bearbeiten</span></button><button class="danger" type="button" onclick="removeRoom('${r.id}')">${iconMarkup('delete-outline')}<span>Löschen</span></button></div></div><form class="room-edit-form" onsubmit="saveRoomEdit(event,'${r.id}')" hidden><label>Name<input name="name" value="${escapeHtml(r.name)}" required maxlength="80"></label><label>Icon<div class="room-icon-select"><span class="room-icon-preview" aria-hidden="true">${iconMarkup(r.icon||'home-outline')}</span><select name="icon" required onchange="updateRoomIconPreview(this)">${roomIconOptions(r.icon||'home-outline')}</select></div></label><div class="room-actions"><button type="button" class="secondary" onclick="cancelRoomEdit('${r.id}')">${iconMarkup('close')}<span>Abbrechen</span></button><button type="submit">${iconMarkup('content-save-outline')}<span>Speichern</span></button></div></form></div>`}).join('')||'<div class="empty-state compact"><h3>Noch keine Räume</h3><p class="muted">Lege rechts deinen ersten Raum an.</p></div>';
  if(draft)restoreRoomEdit(draft,{focus:Boolean(draft.activeField)});
}
async function moveRoom(id,direction){const index=rooms.findIndex(room=>room.id===id);const target=index+Number(direction);if(index<0||target<0||target>=rooms.length)return;const ordered=[...rooms];[ordered[index],ordered[target]]=[ordered[target],ordered[index]];try{rooms=await api('/api/rooms/order',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({roomIds:ordered.map(room=>room.id)})});renderFilters();renderDevices();renderRooms();notify('Raumreihenfolge wurde gespeichert.')}catch(error){notify(error.message,true)}}
function roomRow(id){return roomList.querySelector(`[data-room-id="${CSS.escape(id)}"]`)}
function startRoomEdit(id){
  if(editingRoomId&&editingRoomId!==id)cancelRoomEdit(editingRoomId);
  editingRoomId=id;
  const room=rooms.find(item=>item.id===id);
  restoreRoomEdit({id,name:room?.name||'',icon:room?.icon||'home-outline',activeField:'name',selectionStart:0,selectionEnd:(room?.name||'').length},{focus:true});
}
function cancelRoomEdit(id){
  const row=roomRow(id);
  if(row){row.querySelector('.room-summary').hidden=false;row.querySelector('.room-edit-form').hidden=true}
  if(editingRoomId===id)editingRoomId=null;
}
async function saveRoomEdit(event,id){
  event.preventDefault();
  const room=rooms.find(r=>r.id===id);
  if(!room)return;
  const form=event.currentTarget;
  const name=form.elements.name.value.trim();
  const icon=form.elements.icon.value.trim()||'home-outline';
  if(!name)return;
  try{
    await api(`/api/rooms/${id}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({name,icon,sortOrder:room.sortOrder||0})});
    editingRoomId=null;
    await load();
    notify('Raum wurde aktualisiert.');
  }catch(error){notify(error.message,true)}
}
async function cmd(id,capability,value){coverSliderDrafts.delete(id);if(activeCoverSliderId===id)activeCoverSliderId=null;await api(`/api/devices/${id}/command`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({capability,value})});await load()}
async function reconcileShelly(){await api('/api/adapters/shelly/reconcile',{method:'POST'});await load();notify('Shelly-Synchronisierung abgeschlossen.')}
async function reconcileZigbee(){try{await api('/api/adapters/phoscon/reconcile',{method:'POST'});await load();notify('Zigbee-Synchronisierung abgeschlossen.')}catch(error){notify(friendlyPhosconError(error),true)}}
async function reconcileOpenCcu(){try{await api('/api/adapters/openccu/reconcile',{method:'POST'});await load();await loadOpenCcuSettings();notify('HomeMatic-Synchronisierung abgeschlossen.')}catch(error){showOpenCcuError(error);await loadOpenCcuSettings().catch(()=>undefined);notify(friendlyOpenCcuError(error),true)}}
async function reconcile(){await Promise.allSettled([api('/api/adapters/shelly/reconcile',{method:'POST'}),api('/api/adapters/phoscon/reconcile',{method:'POST'}),api('/api/adapters/openccu/reconcile',{method:'POST'})]);await load();notify('Synchronisierung abgeschlossen.')}
async function createRoom(){const name=newRoomName.value.trim();if(!name)return;await api('/api/rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,icon:newRoomIcon.value||'home-outline',sortOrder:rooms.reduce((highest,room)=>Math.max(highest,Number(room.sortOrder)||0),-1)+1})});newRoomName.value='';newRoomIcon.value='home-outline';updateRoomIconPreview(newRoomIcon);await load();notify('Raum wurde hinzugefügt.')}
async function removeRoom(id){if(!confirm('Raum löschen? Geräte werden nicht gelöscht.'))return;await api(`/api/rooms/${id}`,{method:'DELETE'});if(editingRoomId===id)editingRoomId=null;await load();notify('Raum wurde gelöscht.')}
function applyShellyEncryptionStatus(s){
  shellySettingsStatus=s;
  const invalid=s.encryptionStatus==='invalid';
  const inherit=document.querySelector('input[name="shellyCredentialMode"][value="inherit"]');
  if(inherit){inherit.disabled=invalid;inherit.closest('.choice-row')?.classList.toggle('disabled',invalid)}
  if(invalid){
    const suffix=s.invalidDeviceCredentials?` Zusätzlich sind ${s.invalidDeviceCredentials} gerätespezifische Zugangsdaten betroffen.`:'';
    shellyCredentialWarning.textContent=`Der aktuelle SALTA_ENCRYPTION_KEY passt nicht zu den gespeicherten Zugangsdaten. Gib das globale Shelly-Passwort erneut ein und speichere es.${suffix}`;
    shellyCredentialWarning.hidden=false;
  }else{
    shellyCredentialWarning.hidden=true;
    shellyCredentialWarning.textContent='';
  }
}
async function loadShellySettings(){const s=await api('/api/settings/shelly');applyShellyEncryptionStatus(s);shellyUsername.value=s.username;shellyPassword.value='';shellyPasswordState.textContent=s.passwordConfigured?(s.encryptionStatus==='invalid'?'Das gespeicherte Passwort kann nicht entschlüsselt werden. Bitte vollständig neu eingeben.':'Ein Passwort ist sicher gespeichert. Leer lassen, um es beizubehalten.'):'Aktuell ist kein globales Passwort gespeichert.';return s}
async function saveShelly(){await api('/api/settings/shelly',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({username:shellyUsername.value,password:shellyPassword.value||undefined})});await loadShellySettings();notify('Shelly-Einstellungen wurden gespeichert.')}
function friendlyPhosconError(error){const rawCode=String(error?.code||'');const code=rawCode.split(':',1)[0];const messages={PHOSCON_URL_REQUIRED:'Trage die Adresse deiner Phoscon-/deCONZ-Instanz ein.',PHOSCON_URL_INVALID:'Die Phoscon-Adresse ist ungültig. Beispiel: http://192.168.178.20:8080',PHOSCON_API_KEY_REQUIRED:'Trage einen API-Schlüssel ein oder fordere nach der Freigabe in Phoscon automatisch einen an.',PHOSCON_NOT_CONFIGURED:'Verbinde zuerst unter Einstellungen eine Phoscon-/deCONZ-Instanz.',PHOSCON_GATEWAY_LOCKED:'Die App-Freigabe ist nicht aktiv. Öffne in Phoscon Einstellungen → Gateway → Erweitert und erlaube innerhalb von 60 Sekunden eine neue App.',PHOSCON_AUTHENTICATION_FAILED:'Der API-Schlüssel wurde von Phoscon abgelehnt.',PHOSCON_UNREACHABLE:'Die Phoscon-/deCONZ-Instanz ist unter dieser Adresse nicht erreichbar.',PHOSCON_TIMEOUT:'Die Phoscon-/deCONZ-Instanz antwortet nicht rechtzeitig.',ENCRYPTION_KEY_MISMATCH:'Der gespeicherte Phoscon-API-Schlüssel kann mit dem aktuellen SALTA_ENCRYPTION_KEY nicht entschlüsselt werden.',PHOSCON_REQUEST_FAILED:'Die Verbindung zu Phoscon konnte nicht hergestellt werden.'};if(rawCode.startsWith('PHOSCON_API_ERROR:'))return rawCode.slice('PHOSCON_API_ERROR:'.length);return messages[code]||error?.message||'Die Phoscon-Anfrage ist fehlgeschlagen.'}
function renderPhosconConnectionNotice(){if(!phosconSettingsStatus)return;const gateway=phosconSettingsStatus.gateway||{};if(gateway.connected){zigbeeConnectionNotice.hidden=true;zigbeeConnectionNotice.textContent='';return}zigbeeConnectionNotice.hidden=false;zigbeeConnectionNotice.textContent=phosconSettingsStatus.apiKeyConfigured?(gateway.lastError?`Phoscon ist derzeit nicht erreichbar: ${friendlyPhosconError({code:gateway.lastError})}`:'Phoscon ist konfiguriert, aber derzeit nicht verbunden.'):'Verbinde zuerst unter Einstellungen eine Phoscon-/deCONZ-Instanz.'}
function renderPhosconGatewayStatus(settings){const gateway=settings?.gateway||{};const connected=Boolean(gateway.connected);phosconGatewayStatus.className=`gateway-status ${connected?'connected':'disconnected'}`;const realtime=gateway.realtimeConnected?'Realtime: WebSocket verbunden':gateway.realtimeFallbackPolling?'Realtime: Fallback-Abfrage aktiv':'Realtime: nicht verbunden';const details=connected?[gateway.deviceName||gateway.name,gateway.softwareVersion?`deCONZ ${gateway.softwareVersion}`:'',gateway.apiVersion?`API ${gateway.apiVersion}`:'',gateway.zigbeeChannel?`Zigbee-Kanal ${gateway.zigbeeChannel}`:'',realtime,gateway.realtimeLastEvent?`Letztes Tasterevent ${new Date(gateway.realtimeLastEvent).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:''].filter(Boolean).join(' · '):(gateway.lastError?friendlyPhosconError({code:gateway.lastError}):'Keine aktive Verbindung.');phosconGatewayStatus.innerHTML=`<span class="gateway-status-dot" aria-hidden="true"></span><div><strong>${connected?'Verbunden':'Nicht verbunden'}</strong><small>${escapeHtml(details)}</small></div>`;phosconDisconnectButton.hidden=!settings?.apiKeyConfigured}
async function loadPhosconSettings(){const settings=await api('/api/settings/phoscon');phosconSettingsStatus=settings;phosconBaseUrl.value=settings.baseUrl||'';phosconApiKey.value='';phosconApiKeyState.textContent=settings.apiKeyConfigured?(settings.encryptionStatus==='invalid'?'Der gespeicherte API-Schlüssel kann nicht entschlüsselt werden. Gib ihn neu ein oder kopple SALTA erneut.':'Ein API-Schlüssel ist verschlüsselt gespeichert. Leer lassen, um ihn beizubehalten.'):'Noch kein API-Schlüssel gespeichert.';phosconCredentialWarning.hidden=settings.encryptionStatus!=='invalid';phosconCredentialWarning.textContent=settings.encryptionStatus==='invalid'?'Der aktuelle SALTA_ENCRYPTION_KEY passt nicht zum gespeicherten Phoscon-API-Schlüssel. Kopple die Instanz erneut oder trage den Schlüssel neu ein.':'';renderPhosconGatewayStatus(settings);renderPhosconConnectionNotice();return settings}
async function savePhoscon(){try{const settings=await api('/api/settings/phoscon',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl:phosconBaseUrl.value.trim(),apiKey:phosconApiKey.value.trim()||undefined})});phosconSettingsStatus=settings;await load();await loadPhosconSettings();notify('Phoscon-Verbindung wurde gespeichert und geprüft.')}catch(error){notify(friendlyPhosconError(error),true)}}
async function pairPhoscon(){const baseUrl=phosconBaseUrl.value.trim();if(!baseUrl){phosconBaseUrl.focus();return}const original=phosconPairButton.textContent;phosconPairButton.disabled=true;phosconPairButton.textContent='Schlüssel wird angefordert …';try{const settings=await api('/api/settings/phoscon/pair',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl})});phosconSettingsStatus=settings;await load();await loadPhosconSettings();notify('SALTA wurde mit Phoscon verbunden.')}catch(error){notify(friendlyPhosconError(error),true)}finally{phosconPairButton.disabled=false;phosconPairButton.textContent=original}}
async function disconnectPhoscon(){if(!confirm('Phoscon-Verbindung trennen? Die synchronisierten Zigbee-Geräte werden aus SALTA entfernt, aber nicht aus Phoscon gelöscht.'))return;await api('/api/settings/phoscon',{method:'DELETE'});phosconSettingsStatus=null;await load();await loadPhosconSettings();notify('Phoscon-Verbindung wurde getrennt.')}
function friendlyOpenCcuError(error){const rawCode=String(error?.code||'');const code=rawCode.split(':',1)[0];const messages={OPENCCU_URL_REQUIRED:'Trage die Adresse deiner OpenCCU-Instanz ein.',OPENCCU_URL_INVALID:'Die OpenCCU-Adresse ist ungültig. Beispiel: http://192.168.178.30',OPENCCU_CREDENTIALS_REQUIRED:'Trage OpenCCU-Benutzername und Passwort ein.',OPENCCU_NOT_CONFIGURED:'Verbinde zuerst unter Einstellungen eine OpenCCU-Instanz.',OPENCCU_AUTHENTICATION_FAILED:'Benutzername oder Passwort wurden von OpenCCU abgelehnt.',OPENCCU_AUTH_OR_SESSION_LIMIT:'OpenCCU kann keine neue Sitzung anlegen. Die Zugangsdaten sind ungültig oder das Sitzungslimit ist erreicht. SALTA wartet vor dem nächsten automatischen Versuch eine Minute.',OPENCCU_UNREACHABLE:'Die OpenCCU-Instanz ist unter dieser Adresse nicht erreichbar.',OPENCCU_TIMEOUT:'Die OpenCCU-Instanz antwortet nicht rechtzeitig.',OPENCCU_TLS_ERROR:'Das HTTPS-Zertifikat der OpenCCU-Instanz kann nicht verifiziert werden.',OPENCCU_INVALID_RESPONSE:'OpenCCU hat keine gültige JSON-RPC-Antwort geliefert.',OPENCCU_CATALOG_UNAVAILABLE:'OpenCCU hat über keine unterstützte Schnittstelle einen nutzbaren Gerätekatalog geliefert.',OPENCCU_CHANNELS_UNAVAILABLE:'OpenCCU hat keine Kanalwerte geliefert. SALTA verwirft die alte Sitzung und verbindet sich automatisch neu.',ENCRYPTION_KEY_MISMATCH:'Das gespeicherte OpenCCU-Passwort kann mit dem aktuellen SALTA_ENCRYPTION_KEY nicht entschlüsselt werden.',OPENCCU_REQUEST_FAILED:'Die Verbindung zu OpenCCU konnte nicht hergestellt werden.'};const method=error?.details?.method;const remoteCode=error?.details?.remoteCode;const remote=error?.details?.remoteMessage;const base=messages[code]||error?.message||'Die OpenCCU-Anfrage ist fehlgeschlagen.';return [method?`Methode ${method}`:'',remoteCode?`Remote-Code ${remoteCode}`:'',base,remote&&remote!==base?remote:''].filter(Boolean).join(': ')}
function showOpenCcuError(error){const message=friendlyOpenCcuError(error);openCcuDiagnosticFeedback.textContent=error?.requestId?`${message} Referenz: ${error.requestId}`:message;openCcuDiagnosticFeedback.hidden=false}
function clearOpenCcuError(){openCcuDiagnosticFeedback.hidden=true;openCcuDiagnosticFeedback.textContent=''}
function renderOpenCcuConnectionNotice(){if(!openCcuSettingsStatus)return;const gateway=openCcuSettingsStatus.gateway||{};if(gateway.connected){openCcuConnectionNotice.hidden=true;openCcuConnectionNotice.textContent='';return}openCcuConnectionNotice.hidden=false;const error=gateway.lastError?friendlyOpenCcuError({code:gateway.lastError,details:{method:gateway.lastErrorMethod,remoteCode:gateway.lastErrorRemoteCode,remoteMessage:gateway.lastErrorMessage}}):'';openCcuConnectionNotice.textContent=openCcuSettingsStatus.passwordConfigured?(error?`OpenCCU ist derzeit nicht erreichbar: ${error}`:'OpenCCU ist konfiguriert, aber derzeit nicht verbunden.'):'Verbinde zuerst unter Einstellungen eine OpenCCU-Instanz.'}
function renderOpenCcuDiagnosticReport(report){if(!report?.steps?.length){openCcuDiagnosticReport.hidden=true;openCcuDiagnosticReport.innerHTML='';return}const icon={ok:'mdi-check-circle-outline',warning:'mdi-alert-outline',error:'mdi-close-circle-outline'};openCcuDiagnosticReport.hidden=false;openCcuDiagnosticReport.innerHTML=`<div class="diagnostic-report-head"><strong>${report.ok?'Diagnose abgeschlossen':'Diagnose mit Fehlern'}</strong><small>${new Date(report.completedAt).toLocaleString()}</small></div><div class="diagnostic-report-list">${report.steps.map(step=>{const detail=[step.interfaceName?`Schnittstelle ${step.interfaceName}`:'',step.resultCount!==undefined?`${step.resultCount} Einträge`:'',step.remoteCode?`Remote-Code ${step.remoteCode}`:'',step.message||step.code||''].filter(Boolean).join(' · ');return `<div class="diagnostic-step ${escapeHtml(step.status)}"><span class="mdi ${icon[step.status]||icon.error}" aria-hidden="true"></span><div><strong>${escapeHtml(step.method)}</strong><small>${escapeHtml(detail||'Erfolgreich')}</small></div><time>${Number(step.durationMs||0)} ms</time></div>`}).join('')}</div>`}
function renderOpenCcuGatewayStatus(settings){const gateway=settings?.gateway||{};const connected=Boolean(gateway.connected);openCcuGatewayStatus.className=`gateway-status ${connected?'connected':'disconnected'}`;const error=gateway.lastError?friendlyOpenCcuError({code:gateway.lastError,details:{method:gateway.lastErrorMethod,remoteCode:gateway.lastErrorRemoteCode,remoteMessage:gateway.lastErrorMessage}}):'';const details=connected?[gateway.interfaces?.length?gateway.interfaces.join(', '):'',`${Number(gateway.devices||0)} Geräte`,gateway.lastSync?`Synchronisiert ${new Date(gateway.lastSync).toLocaleString()}`:''].filter(Boolean).join(' · '):(error||'Keine aktive Verbindung.');openCcuGatewayStatus.innerHTML=`<span class="gateway-status-dot" aria-hidden="true"></span><div><strong>${connected?'Verbunden':'Nicht verbunden'}</strong><small>${escapeHtml(details)}</small></div>`;openCcuDisconnectButton.hidden=!settings?.passwordConfigured;renderOpenCcuDiagnosticReport(gateway.lastDiagnostic);if(error){openCcuDiagnosticFeedback.textContent=error;openCcuDiagnosticFeedback.hidden=false}}
async function loadOpenCcuSettings(){const settings=await api('/api/settings/openccu');openCcuSettingsStatus=settings;openCcuBaseUrl.value=settings.baseUrl||'';openCcuUsername.value=settings.username||'';openCcuPassword.value='';openCcuPasswordState.textContent=settings.passwordConfigured?(settings.encryptionStatus==='invalid'?'Das gespeicherte Passwort kann nicht entschlüsselt werden. Gib es vollständig neu ein.':'Ein Passwort ist verschlüsselt gespeichert. Leer lassen, um es beizubehalten.'):'Noch kein Passwort gespeichert.';openCcuCredentialWarning.hidden=settings.encryptionStatus!=='invalid';openCcuCredentialWarning.textContent=settings.encryptionStatus==='invalid'?'Der aktuelle SALTA_ENCRYPTION_KEY passt nicht zum gespeicherten OpenCCU-Passwort. Gib das Passwort neu ein.':'';if(!settings.gateway?.lastError)clearOpenCcuError();renderOpenCcuGatewayStatus(settings);renderOpenCcuConnectionNotice();return settings}
async function saveOpenCcu(){clearOpenCcuError();try{const settings=await api('/api/settings/openccu',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl:openCcuBaseUrl.value.trim(),username:openCcuUsername.value.trim(),password:openCcuPassword.value||undefined})});openCcuSettingsStatus=settings;await load();await loadOpenCcuSettings();if(settings.gateway?.lastError){const error={code:settings.gateway.lastError,details:{method:settings.gateway.lastErrorMethod,remoteCode:settings.gateway.lastErrorRemoteCode,remoteMessage:settings.gateway.lastErrorMessage}};showOpenCcuError(error);notify('OpenCCU wurde gespeichert, die Gerätesynchronisierung enthält aber einen Fehler.',true)}else if(settings.gateway?.lastDiagnostic?.steps?.some(step=>step.status==='warning'))notify('OpenCCU wurde gespeichert. Die Diagnose enthält Warnungen; Details stehen im Bericht und im Systemprotokoll.',true);else notify('OpenCCU-Verbindung wurde gespeichert und geprüft.')}catch(error){showOpenCcuError(error);notify(friendlyOpenCcuError(error),true)}}
async function diagnoseOpenCcu(){const original=openCcuDiagnoseButton.textContent;openCcuDiagnoseButton.disabled=true;openCcuDiagnoseButton.textContent='Diagnose läuft …';clearOpenCcuError();try{const result=await api('/api/settings/openccu/diagnose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl:openCcuBaseUrl.value.trim()||undefined,username:openCcuUsername.value.trim()||undefined,password:openCcuPassword.value||undefined})});renderOpenCcuDiagnosticReport(result.report);await loadOpenCcuSettings();if(result.report.ok&&result.report.steps.some(step=>step.status==='warning'))notify('OpenCCU-Diagnose abgeschlossen. Es gibt Warnungen im Bericht.',true);else if(result.report.ok)notify('OpenCCU-Diagnose erfolgreich abgeschlossen.');else{const failed=result.report.steps.find(step=>step.status==='error');showOpenCcuError({code:failed?.code||'OPENCCU_REQUEST_FAILED',details:{method:failed?.method,remoteCode:failed?.remoteCode,remoteMessage:failed?.message}});notify('Die OpenCCU-Diagnose hat einen Fehler gefunden.',true)}}catch(error){showOpenCcuError(error);notify(friendlyOpenCcuError(error),true)}finally{openCcuDiagnoseButton.disabled=false;openCcuDiagnoseButton.textContent=original}}
async function disconnectOpenCcu(){if(!confirm('OpenCCU-Verbindung trennen? Die synchronisierten HomeMatic-Geräte werden aus SALTA entfernt, aber nicht aus OpenCCU gelöscht.'))return;await api('/api/settings/openccu',{method:'DELETE'});openCcuSettingsStatus=null;clearOpenCcuError();renderOpenCcuDiagnosticReport(null);await load();await loadOpenCcuSettings();notify('OpenCCU-Verbindung wurde getrennt.')}
async function showSettingsPanel(panel){const target=['general','shelly','phoscon','openccu','homekit','climate','notifications','backup'].includes(panel)?panel:'general';document.querySelectorAll('[data-settings-content]').forEach(content=>content.hidden=content.dataset.settingsContent!==target);document.querySelectorAll('[data-settings-panel]').forEach(button=>{const active=button.dataset.settingsPanel===target;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')});if(target==='general')await loadGeneralSettings();else if(target==='phoscon')await loadPhosconSettings();else if(target==='openccu')await loadOpenCcuSettings();else if(target==='homekit')await loadHomeKitSettings();else if(target==='climate')await loadClimateSettings();else if(target==='notifications')await loadNotificationSettings();else if(target==='shelly')await loadShellySettings()}
function openAddVirtualDevice(){addVirtualDeviceForm.reset();virtualDeviceType.value='button';virtualDeviceRoom.innerHTML='<option value="">Nicht zugeordnet</option>'+rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');addVirtualDeviceDialog.showModal();virtualDeviceName.focus()}
async function addVirtualDevice(){const name=virtualDeviceName.value.trim();if(!name){virtualDeviceName.focus();return}const type=virtualDeviceType.value==='button'?'button':'switch';const original=addVirtualDeviceButton.textContent;addVirtualDeviceButton.disabled=true;addVirtualDeviceButton.textContent=type==='button'?'Taster wird angelegt …':'Schalter wird angelegt …';try{await api('/api/adapters/virtual/devices',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,type,roomId:virtualDeviceRoom.value||null})});addVirtualDeviceDialog.close();await load();notify(type==='button'?'Virtueller Taster wurde angelegt und an HomeKit übergeben.':'Virtueller Schalter wurde angelegt und an HomeKit übergeben.')}catch(error){notify(error.message,true)}finally{addVirtualDeviceButton.disabled=false;addVirtualDeviceButton.textContent=original}}
function deviceInfoTimestamp(value){if(!value)return '–';const date=new Date(value);return Number.isNaN(date.getTime())?'–':date.toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'})}
function deviceCredentialLabel(d){const modes={inherit:'Globale Shelly-Zugangsdaten',custom:'Eigene Zugangsdaten',none:'Keine Authentifizierung'};return modes[d.credentialMode]||d.credentialMode||'–'}
function deviceGenerationLabel(value){const labels={gen1:'Gen 1',gen2:'Gen 2',gen3:'Gen 3',gen4:'Gen 4',rpc:'RPC'};return labels[value]||value||'–'}
function deviceInfoRow(label,value,{copy=false}={}){const text=value===undefined||value===null||value===''?'–':String(value);const encodedText=encodeURIComponent(text).replace(/'/g,'%27');const encodedLabel=encodeURIComponent(label).replace(/'/g,'%27');const copyButton=copy&&text!=='–'?`<button type="button" class="device-info-copy" onclick="copyDeviceInfoValue('${encodedText}','${encodedLabel}')" aria-label="${escapeHtml(label)} kopieren" title="${escapeHtml(label)} kopieren">${iconMarkup('content-copy')}</button>`:'';return `<div class="device-info-item"><span>${escapeHtml(label)}</span><div><strong title="${escapeHtml(text)}">${escapeHtml(text)}</strong>${copyButton}</div></div>`}
async function copyDeviceInfoValue(encodedValue,encodedLabel){const value=decodeURIComponent(encodedValue);const label=decodeURIComponent(encodedLabel);try{await navigator.clipboard.writeText(value);notify(`${label} wurde kopiert.`)}catch{notify(`${label} konnte nicht kopiert werden.`,true)}}
function renderDeviceDialogInfo(d){const adapter=d.adapterData||{};const rows=[];const add=(label,value,options)=>{if(value!==undefined&&value!==null&&String(value)!=='')rows.push(deviceInfoRow(label,value,options))};add('Quelle',sourceLabels[d.source]||d.source);add('Gerätetyp',isVirtualButton(d)?'Taster':(typeLabels[d.type]||d.type));if(resolvedPresentationType(d)!==d.type)add('Darstellung',typeLabels[resolvedPresentationType(d)]||resolvedPresentationType(d));add('Status',d.reachable?'Online':'Offline');add('Raum',d.room||rooms.find(room=>room.id===d.roomId)?.name||'Nicht zugeordnet');add('Modell',d.model);add('Firmware',d.firmwareVersion);add('Host / Adresse',d.host,{copy:true});add('Hostname',d.hostname,{copy:true});add('MAC / Geräteadresse',d.macAddress,{copy:true});if(d.generation)add('Generation',deviceGenerationLabel(d.generation));add('Profil',d.profile);if(d.channelCount)add('Kanäle',d.channelCount);if(d.source==='shelly'){if(d.componentKind)add('Komponente',`${d.componentKind}${Number.isInteger(Number(d.componentId))?` ${Number(d.componentId)}`:''}`);add('Zugangsdaten',deviceCredentialLabel(d));add('Passwort gespeichert',d.passwordConfigured?'Ja':'Nein')}
if(d.source==='phoscon'){add('Ressource',d.sourceId,{copy:true});add('Sensor-Ressourcen',adapter.sensorResourceIds,{copy:true});add('Sichtbarkeit',d.hidden?'Ausgeblendet':'Sichtbar')}
if(d.source==='openccu'){add('Interface',adapter.interfaceName);add('Geräteadresse',d.macAddress,{copy:true});add('Kanaladresse',adapter.channelAddress,{copy:true});add('Kanaltyp',adapter.channelType);add('OpenCCU-Gerätename',adapter.deviceName||adapter.sourceName);add('OpenCCU-Kanalname',adapter.channelName)}
if(d.source==='virtual')add('Virtueller Typ',adapter.virtualType==='button'?'Taster (Impuls)':'Schalter');
const homekitSupported=homeKitSupportedDevice(d);add('HomeKit',homekitSupported?(d.homekitEnabled?'Freigegeben':'Nicht freigegeben'):'Nicht unterstützt');if(homekitSupported){add('HomeKit-Name',d.homekitName||d.name);add('HomeKit-Zielraum',homeKitTargetRoomName(d))}if(d.capabilities?.length)add('Funktionen',d.capabilities.join(', '));add('Zuletzt gesehen',deviceInfoTimestamp(d.lastSeen));add('Letztes Ereignis',deviceInfoTimestamp(d.lastEvent));add('SALTA-ID',d.id,{copy:true});add('Quell-ID',d.sourceId,{copy:true});deviceInfoGrid.innerHTML=rows.join('');const actions=[];if(shellyWebUrl(d))actions.push(`<button type="button" class="secondary" onclick="openShellyWeb('${d.id}')">${iconMarkup('open-in-new')}<span>Weboberfläche öffnen</span></button>`);deviceInfoActions.innerHTML=actions.join('')}
function renumberDeviceConfigSections(){let number=0;deviceDialog.querySelectorAll('[data-device-config-section]').forEach(section=>{if(section.hidden)return;number+=1;const badge=section.querySelector('.section-label>span');if(badge)badge.textContent=String(number)})}
function openDevice(id){
  selectedDevice=all.find(d=>d.id===id);if(!selectedDevice)return;
  const shelly=selectedDevice.source==='shelly';const zigbee=selectedDevice.source==='phoscon';const openccu=selectedDevice.source==='openccu';const virtual=selectedDevice.source==='virtual';
  deviceDialogTitle.textContent=selectedDevice.name;
  deviceDialogDescription.textContent=shelly?'Shelly-Gerät konfigurieren und technische Geräteinformationen prüfen.':zigbee?'Zigbee-Gerät konfigurieren und Phoscon-Geräteinformationen prüfen.':openccu?'HomeMatic-Gerät konfigurieren und OpenCCU-Geräteinformationen prüfen.':'Virtuelles SALTA-Gerät konfigurieren und technische Informationen prüfen.';
  deviceDialogStatus.textContent=selectedDevice.reachable?'Online':'Offline';deviceDialogStatus.className=`device-dialog-status ${selectedDevice.reachable?'online':'offline'}`;
  const visualType=isVirtualButton(selectedDevice)?'button':resolvedPresentationType(selectedDevice);const lastSeenMeta=shelly?`<span class="device-dialog-last-seen">Zuletzt gesehen: ${escapeHtml(deviceInfoTimestamp(selectedDevice.lastSeen))}</span>`:'';
  deviceDialogMeta.innerHTML=`<span>${escapeHtml(sourceLabels[selectedDevice.source]||selectedDevice.source)}</span><span>${escapeHtml(typeLabels[visualType]||visualType)}</span><span>${escapeHtml(selectedDevice.room||'Nicht zugeordnet')}</span>${lastSeenMeta}`;
  deviceName.value=selectedDevice.name;
  const roomOptions='<option value="">Nicht zugeordnet</option>'+rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  deviceRoom.innerHTML=roomOptions;deviceRoom.value=selectedDevice.roomId||'';
  deviceVirtualTypeSection.hidden=!virtual;if(virtual)deviceVirtualType.value=selectedDevice.adapterData?.virtualType==='button'?'button':'switch';const configurable=!virtual&&supportsPresentationOverride(selectedDevice);devicePresentationSection.hidden=!configurable;devicePresentationType.value=selectedDevice.presentationType||'auto';devicePresentationType.options[0].textContent=`Automatisch (${typeLabels[selectedDevice.type]||selectedDevice.type})`;
  devicePresentationHint.textContent=shelly?'Die Auswahl ändert nur die logische Verwendung, nicht die physische Shelly-Konfiguration.':openccu?'Die Auswahl ändert nur die Darstellung in SALTA; das HomeMatic-Gerät in OpenCCU bleibt unverändert.':'Die Auswahl ändert nur die Darstellung in SALTA; die Zigbee-Ressource in Phoscon bleibt unverändert.';
  deviceVisibilitySection.hidden=!zigbee;deviceHidden.checked=Boolean(selectedDevice.hidden);
  deviceCredentialSection.hidden=!shelly;credentialMode.value=selectedDevice.credentialMode||'inherit';deviceUsername.value=selectedDevice.credentialUsername||'';devicePassword.value='';
  deviceHomeKitName.value=selectedDevice.homekitName||'';deviceHomeKitName.placeholder=`${selectedDevice.name} (SALTA)`;
  deviceHomeKitRoom.innerHTML=roomOptions;deviceHomeKitUseSaltaRoom.checked=selectedDevice.homekitUseSaltaRoom!==false;deviceHomeKitRoom.value=deviceHomeKitUseSaltaRoom.checked?(selectedDevice.roomId||''):(selectedDevice.homekitRoomId||'');
  deviceHomeKitEnabled.checked=Boolean(selectedDevice.homekitEnabled);syncDeviceHomeKitRoomControls();renderDeviceHomeKitCompatibility();
  deviceDeleteSection.hidden=!(shelly||virtual);if(!deviceDeleteSection.hidden){deviceDeleteDescription.textContent=virtual?'Das virtuelle Gerät wird aus SALTA entfernt und verschwindet automatisch aus der HomeKit-Bridge.':'Das Shelly-Gerät selbst wird nicht zurückgesetzt oder ausgeschaltet. Es kann später erneut hinzugefügt werden.';deleteDeviceButton.textContent=virtual?'Virtuelles Gerät löschen':'Gerät aus SALTA löschen'}
  renderDeviceDialogInfo(selectedDevice);renumberDeviceConfigSections();toggleDeviceCredentials();deviceDialog.showModal()
}
async function saveDeviceConfig(){
  if(!selectedDevice)return;const name=deviceName.value.trim();if(!name){deviceName.focus();return}
  const presentationType=devicePresentationSection.hidden?(selectedDevice.presentationType||'auto'):devicePresentationType.value;
  const candidate={...selectedDevice,presentationType};const homekitSupported=homeKitSupportedDevice(candidate);const useSaltaRoom=deviceHomeKitUseSaltaRoom.checked;
  const config={name,roomId:deviceRoom.value||null,presentationType,...(selectedDevice.source==='virtual'?{virtualType:deviceVirtualType.value==='button'?'button':'switch'}:{}),homekitEnabled:homekitSupported&&deviceHomeKitEnabled.checked,homekitName:deviceHomeKitName.value.trim()||null,homekitUseSaltaRoom:useSaltaRoom,homekitRoomId:useSaltaRoom?null:(deviceHomeKitRoom.value||null)};
  if(selectedDevice.source==='phoscon')config.hidden=deviceHidden.checked;
  await api(`/api/devices/${encodeURIComponent(selectedDevice.id)}/config`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(config)});
  if(selectedDevice.source==='shelly')await api(`/api/devices/${encodeURIComponent(selectedDevice.id)}/credentials`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({credentialMode:credentialMode.value,username:deviceUsername.value||undefined,password:devicePassword.value||undefined})});
  deviceDialog.close();await load();notify(selectedDevice.source==='phoscon'&&deviceHidden.checked?'Zigbee-Gerät wurde ausgeblendet.':'Gerätekonfiguration gespeichert.')
}
async function removeSelectedDevice(){if(!selectedDevice)return;const device=selectedDevice;const virtual=device.source==='virtual';const detail=virtual?'Das virtuelle Gerät wird auch aus der HomeKit-Bridge entfernt.':'Das Shelly-Gerät selbst bleibt unverändert und kann später erneut hinzugefügt werden.';if(!confirm(`„${device.name}“ wirklich aus SALTA löschen?\n\n${detail}`))return;const original=deleteDeviceButton.textContent;deleteDeviceButton.disabled=true;deleteDeviceButton.textContent='Gerät wird gelöscht …';try{await api(`/api/devices/${encodeURIComponent(device.id)}`,{method:'DELETE'});deviceDialog.close();selectedDevice=null;await load();notify(virtual?'Virtuelles Gerät wurde gelöscht.':'Shelly-Gerät wurde aus SALTA gelöscht.')}finally{deleteDeviceButton.disabled=false;deleteDeviceButton.textContent=original}}

let shellyMode='manual';
function clearAddShellyFeedback(){
  addShellyFeedback.hidden=true;
  addShellyFeedback.textContent='';
  addShellyFeedback.classList.remove('success');
}
function friendlyShellyError(error){
  const messages={
    AUTHENTICATION_FAILED:'Authentifizierung fehlgeschlagen. Prüfe den ausgewählten Zugangsmodus sowie Benutzername und Passwort.',
    DEVICE_UNREACHABLE:'Das Shelly-Gerät ist unter dieser Adresse nicht erreichbar. Prüfe IP-Adresse, Netzwerk und Stromversorgung.',
    DETECTION_TIMEOUT:'Die Geräteerkennung hat zu lange gedauert. Prüfe die Verbindung und versuche es erneut.',
    UNSUPPORTED_DEVICE:'Unter dieser Adresse wurde keine unterstützte Shelly-Schnittstelle erkannt.',
    INVALID_REQUEST:'Die eingegebenen Gerätedaten sind unvollständig oder ungültig.',
    USERNAME_REQUIRED:'Für eigene Zugangsdaten ist ein Benutzername erforderlich.',
    SHELLY_HTTP_ERROR:'Das Shelly-Gerät hat mit einem unerwarteten HTTP-Fehler geantwortet.',
    DEVICE_ADD_FAILED:'Das Gerät konnte nicht in SALTA gespeichert werden.',
    ENCRYPTION_KEY_MISMATCH:'Die gespeicherten Shelly-Zugangsdaten können mit dem aktuellen SALTA_ENCRYPTION_KEY nicht entschlüsselt werden. Bitte unter Einstellungen neu speichern.'
  };
  const code=error?.code||'';
  const message=messages[code]||error?.message||'Das Shelly-Gerät konnte nicht hinzugefügt werden.';
  return error?.requestId?`${message} Referenz: ${error.requestId}`:message;
}
function showAddShellyError(error){
  addShellyFeedback.textContent=friendlyShellyError(error);
  addShellyFeedback.hidden=false;
  addShellyFeedback.classList.remove('success');
  addShellyFeedback.scrollIntoView({block:'nearest',behavior:'smooth'});
  addShellyFeedback.focus({preventScroll:true});
}
async function openAddShelly(){
  shellyRoom.innerHTML='<option value="">Nicht zugeordnet</option>'+rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  addShellyForm.reset();
  clearAddShellyFeedback();
  setShellyMode('manual');
  try{applyShellyEncryptionStatus(await api('/api/settings/shelly'))}catch{/* The add request will still provide a readable API error. */}
  const inherit=document.querySelector('input[name="shellyCredentialMode"][value="inherit"]');
  const none=document.querySelector('input[name="shellyCredentialMode"][value="none"]');
  if(shellySettingsStatus?.encryptionStatus==='invalid'){none.checked=true}else{inherit.checked=true}
  toggleCustomShellyCredentials();
  addShellyDialog.showModal();
  if(shellySettingsStatus?.encryptionStatus==='invalid')showAddShellyError({code:'ENCRYPTION_KEY_MISMATCH'});
  shellyHost.focus();
}
function setShellyMode(mode){shellyMode=mode;clearAddShellyFeedback();manualShellyFields.hidden=mode!=='manual';discoveryShellyFields.hidden=mode!=='discovery';manualTab.classList.toggle('active',mode==='manual');discoveryTab.classList.toggle('active',mode==='discovery');manualTab.setAttribute('aria-selected',String(mode==='manual'));discoveryTab.setAttribute('aria-selected',String(mode==='discovery'));shellyHost.required=mode==='manual';if(mode==='discovery')shellySubnet.focus()}
function selectedShellyCredentialMode(){return document.querySelector('input[name="shellyCredentialMode"]:checked')?.value||'inherit'}
function toggleCustomShellyCredentials(){customShellyCredentials.hidden=selectedShellyCredentialMode()!=='custom'}
function toggleDeviceCredentials(){deviceCredentialFields.hidden=credentialMode.value!=='custom'}
async function addShelly(){
  const original=addShellyButton.textContent;
  clearAddShellyFeedback();
  addShellyButton.disabled=true;
  addShellyButton.textContent='Verbindung wird geprüft …';
  try{
    const body={host:shellyHost.value.trim(),name:shellyDeviceName.value.trim()||undefined,roomId:shellyRoom.value||null,credentialMode:selectedShellyCredentialMode(),username:shellyDeviceUsername.value||undefined,password:shellyDevicePassword.value||undefined};
    const result=await api('/api/adapters/shelly/devices',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    addShellyDialog.close();
    await load();
    notify(result.addedDevices>1?`${result.addedDevices} Shelly-Kanäle wurden als getrennte Geräte hinzugefügt.`:'Shelly-Gerät wurde hinzugefügt.');
  }catch(error){
    showAddShellyError(error);
  }finally{
    addShellyButton.disabled=false;
    addShellyButton.textContent=original;
  }
}
async function discoverShellys(){const subnet=shellySubnet.value.trim();if(!subnet)return;const original=discoverShellyButton.textContent;clearAddShellyFeedback();discoverShellyButton.disabled=true;discoverShellyButton.textContent='Netzwerk wird durchsucht …';discoveryResults.innerHTML='<p class="muted">Die Suche läuft. Bitte einen Moment warten …</p>';try{const result=await api('/api/adapters/shelly/discover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subnet})});discoveryResults.innerHTML=result.devices.length?result.devices.map(d=>`<div class="discovery-item"><div><strong>${escapeHtml(d.name)}</strong><small>${escapeHtml(d.model)} · ${escapeHtml(d.host)} · ${escapeHtml(d.generation)}</small></div><button type="button" onclick="useDiscoveredHost('${escapeHtml(d.host)}','${escapeHtml(d.name)}')">Auswählen</button></div>`).join(''):'<div class="empty-state compact"><strong>Keine Shelly-Geräte gefunden</strong><p class="muted">Prüfe das Netzwerk und versuche es erneut.</p></div>'}catch(error){discoveryResults.innerHTML='';showAddShellyError(error)}finally{discoverShellyButton.disabled=false;discoverShellyButton.textContent=original}}
function useDiscoveredHost(host,name){shellyHost.value=host;shellyDeviceName.value=name;setShellyMode('manual')}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function presenceFriendlyError(error){const messages={FRITZBOX_URL_INVALID:'Die TR-064-Verbindung ist ungültig. Wähle HTTP oder HTTPS, einen gültigen Host und Port 49000 oder 49443.',FRITZBOX_TLS_CERTIFICATE:'Das HTTPS-Zertifikat der FRITZ!Box konnte nicht geprüft werden. Aktiviere „Zertifikatsprüfung deaktivieren“ nur, wenn du dieser lokalen FRITZ!Box vertraust.',FRITZBOX_AUTHENTICATION_REQUIRED:'TR-064 ist erreichbar, aber der Hosts-Dienst benötigt eine Anmeldung. Bitte FRITZ!Box-Benutzername und Passwort eintragen.',FRITZBOX_AUTHENTICATION_FAILED:'TR-064 ist erreichbar, aber Benutzername oder Passwort wurden von der FRITZ!Box abgelehnt.',FRITZBOX_AUTHORIZATION_FAILED:'Die Anmeldung an der FRITZ!Box war erfolgreich, aber dem Benutzer fehlen die benötigten TR-064-Berechtigungen.',FRITZBOX_UNREACHABLE:'Die FRITZ!Box-TR-064-Schnittstelle ist nicht erreichbar.',FRITZBOX_TIMEOUT:'Die FRITZ!Box antwortet nicht rechtzeitig.',FRITZBOX_HTTP_411:'Die FRITZ!Box hat den TR-064-SOAP-Aufruf mit HTTP 411 (Length Required) abgelehnt.',FRITZBOX_INVALID_RESPONSE:'Die FRITZ!Box hat eine unerwartete TR-064-Antwort geliefert.',PRESENCE_MAC_INVALID:'Die MAC-Adresse ist ungültig. Erwartet wird AA:BB:CC:DD:EE:FF.',PRESENCE_MAC_EXISTS:'Diese MAC-Adresse wird bereits überwacht.',ENCRYPTION_KEY_MISMATCH:'Das gespeicherte FRITZ!Box-Passwort kann mit dem aktuellen SALTA_ENCRYPTION_KEY nicht entschlüsselt werden.'};return messages[error?.code]||error?.message||'Die Präsenzerkennung konnte nicht aktualisiert werden.'}
function presenceTransportFromBaseUrl(value){try{const parsed=new URL(value||'http://fritz.box:49000');return{protocol:parsed.protocol==='https:'?'https':'http',host:parsed.hostname||'fritz.box',port:parsed.port||(parsed.protocol==='https:'?'49443':'49000')}}catch{return{protocol:'http',host:'fritz.box',port:'49000'}}}
function presenceBaseUrlFromForm(){const protocol=presenceProtocol.value==='https'?'https':'http';const host=presenceHost.value.trim();const bracketed=host.includes(':')&&!host.startsWith('[')?`[${host}]`:host;return `${protocol}://${bracketed}:${presencePort.value}`}
function updatePresenceTlsControl(){const https=presenceProtocol.value==='https';presenceTlsInsecure.disabled=!https;presenceTlsInsecure.closest('.presence-tls-row')?.classList.toggle('disabled',!https)}
function presenceDeviceForTarget(target){return presenceData?.devices?.find(device=>device.id===`presence:${target.id}`)}
function presenceDelayLabel(seconds){const value=Number(seconds);if(value===0)return 'sofort';if(value===60)return '1 Minute';if(value%60===0)return `${value/60} Minuten`;return `${value} Sekunden`}
function presenceLastSeen(device){if(!device?.lastSeen)return 'Noch nicht erkannt';const value=new Date(device.lastSeen);return Number.isNaN(value.getTime())?'Noch nicht erkannt':value.toLocaleString('de-DE')}
function renderPresenceStatus(){if(!presenceData)return;const settings=presenceData.settings||{};const status=presenceData.status||{};const connected=Boolean(status.connected);let tone='';let title='Verbindung noch nicht geprüft';let parts=[];if(connected){tone='connected';title='FRITZ!Box erreichbar';parts=[status.hostCount!==undefined?`${status.hostCount} Heimnetzgeräte`:'','Automatische TR-064-Abfrage aktiv',status.lastSync?`zuletzt geprüft ${new Date(status.lastSync).toLocaleTimeString('de-DE')}`:''];}else if(status.lastTestSuccess===true){tone='connected';title='FRITZ!Box erreichbar';parts=['Verbindungstest erfolgreich',status.lastTestHostCount!==undefined?`${status.lastTestHostCount} Heimnetzgeräte`:'',status.lastTestAt?`getestet ${new Date(status.lastTestAt).toLocaleTimeString('de-DE')}`:'',status.lastTestBaseUrl||''];}else if(status.lastTestSuccess===false){tone='failed';const errorCode=status.lastTestError||status.lastError||'';title=errorCode==='FRITZBOX_AUTHENTICATION_REQUIRED'?'TR-064 erreichbar · Anmeldung erforderlich':errorCode==='FRITZBOX_AUTHENTICATION_FAILED'?'TR-064 erreichbar · Anmeldung fehlgeschlagen':errorCode==='FRITZBOX_AUTHORIZATION_FAILED'?'TR-064 erreichbar · Berechtigung fehlt':'Verbindung fehlgeschlagen';parts=[presenceFriendlyError({code:errorCode}),status.lastTestAt?`getestet ${new Date(status.lastTestAt).toLocaleTimeString('de-DE')}`:'',status.lastTestBaseUrl||''];}else if(status.lastError&&settings.enabled){tone='failed';const errorCode=status.lastError;title=errorCode==='FRITZBOX_AUTHENTICATION_REQUIRED'?'TR-064 erreichbar · Anmeldung erforderlich':errorCode==='FRITZBOX_AUTHENTICATION_FAILED'?'TR-064 erreichbar · Anmeldung fehlgeschlagen':errorCode==='FRITZBOX_AUTHORIZATION_FAILED'?'TR-064 erreichbar · Berechtigung fehlt':'FRITZ!Box nicht erreichbar';parts=[presenceFriendlyError({code:errorCode})];}else if(settings.enabled){tone='pending';title='Verbindung wird aufgebaut';parts=['Noch keine erfolgreiche automatische TR-064-Abfrage.'];}else{parts=['Mit „Verbindung testen“ kannst du TR-064 unabhängig von der aktivierten Präsenzerkennung prüfen.'];}const details=parts.filter(Boolean).join(' · ');const logLink=tone==='failed'?'<a class="gateway-status-log-link" href="#logs">Systemprotokoll öffnen</a>':'';presenceGatewayStatus.className=`gateway-status ${tone}`.trim();presenceGatewayStatus.innerHTML=`<span class="gateway-status-dot" aria-hidden="true"></span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(details)}</small>${logLink}</div>`;presenceCredentialWarning.hidden=settings.encryptionStatus!=='invalid';presenceCredentialWarning.textContent=settings.encryptionStatus==='invalid'?'Der aktuelle SALTA_ENCRYPTION_KEY passt nicht zum gespeicherten FRITZ!Box-Passwort. Bitte das Passwort neu eingeben.':''}
function renderPresenceHouse(){if(!presenceData)return;const house=presenceData.devices?.find(device=>device.id==='presence:house');const count=Number(house?.state?.presentCount||0);const any=Boolean(house?.state?.anyHome);const members=Number(house?.adapterData?.memberCount||presenceData.targets?.length||0);presenceHouseSummary.innerHTML=`<div class="presence-house-state ${any?'home':'away'}"><span class="mdi ${any?'mdi-home-account':'mdi-home-export-outline'}" aria-hidden="true"></span><div><strong>${any?'Jemand zuhause':'Niemand zuhause'}</strong><small>${count} von ${members} ${members===1?'Person':'Personen'} anwesend</small></div></div><div class="presence-house-values"><div><b>${count}</b><small>Anwesend</small></div><div><b>${any?'Ja':'Nein'}</b><small>Jemand zuhause</small></div><div><b>${any?'Nein':'Ja'}</b><small>Niemand zuhause</small></div></div>`}
function renderPresenceTargets(){if(!presenceData)return;const targets=presenceData.targets||[];presenceTargetCount.textContent=String(targets.length);if(!targets.length){presenceTargetList.innerHTML='<article class="empty-state compact"><strong>Noch keine Personen</strong><p class="muted">Füge rechts die erste bekannte Handy-MAC-Adresse hinzu.</p></article>';return}presenceTargetList.innerHTML=targets.map(target=>{const device=presenceDeviceForTarget(target);const present=Boolean(device?.state?.present);const reachable=Boolean(device?.reachable);const delay=target.absenceDelaySeconds??presenceData.settings?.absenceDelaySeconds??300;const ip=device?.state?.ipAddress||'–';const iface=device?.state?.interfaceType||'–';return `<article class="presence-target-card ${present?'present':'absent'} ${reachable?'':'unreachable'}"><div class="presence-target-main"><span class="presence-avatar"><span class="mdi mdi-cellphone" aria-hidden="true"></span></span><div><div class="presence-target-title"><h3>${escapeHtml(target.name)}</h3><span class="presence-pill ${present?'present':'absent'}">${present?'Anwesend':'Abwesend'}</span></div><code>${escapeHtml(target.macAddress)}</code><small>${reachable?`IP ${escapeHtml(ip)} · ${escapeHtml(iface)} · zuletzt gesehen ${escapeHtml(presenceLastSeen(device))}`:'FRITZ!Box-Abfrage aktuell nicht verfügbar'}</small></div></div><div class="presence-target-side"><small>Abwesend nach <strong>${escapeHtml(presenceDelayLabel(delay))}</strong></small><div class="presence-target-actions"><button type="button" class="secondary" onclick="editPresenceTarget('${target.id}')"><span class="mdi mdi-pencil-outline" aria-hidden="true"></span>Bearbeiten</button><button type="button" class="danger" onclick="deletePresenceTarget('${target.id}')"><span class="mdi mdi-delete-outline" aria-hidden="true"></span>Löschen</button></div></div></article>`}).join('')}
function applyPresenceSettingsToForm(){if(!presenceData)return;const settings=presenceData.settings||{};const transport=presenceTransportFromBaseUrl(settings.baseUrl);presenceEnabled.checked=Boolean(settings.enabled);presenceProtocol.value=transport.protocol;presenceHost.value=transport.host;presencePort.value=transport.port;presenceTlsInsecure.checked=Boolean(settings.tlsInsecure);updatePresenceTlsControl();presenceUsername.value=settings.username||'';presencePassword.value='';presencePollInterval.value=String(settings.pollIntervalSeconds||30);if(![...presencePollInterval.options].some(option=>option.value===String(settings.pollIntervalSeconds)))presencePollInterval.insertAdjacentHTML('beforeend',`<option value="${Number(settings.pollIntervalSeconds)}">${Number(settings.pollIntervalSeconds)} Sekunden</option>`);presencePollInterval.value=String(settings.pollIntervalSeconds||30);if(![...presenceAbsenceDelay.options].some(option=>option.value===String(settings.absenceDelaySeconds)))presenceAbsenceDelay.insertAdjacentHTML('beforeend',`<option value="${Number(settings.absenceDelaySeconds)}">${presenceDelayLabel(settings.absenceDelaySeconds)}</option>`);presenceAbsenceDelay.value=String(settings.absenceDelaySeconds??300);presencePasswordState.textContent=settings.passwordConfigured?(settings.encryptionStatus==='invalid'?'Das gespeicherte Passwort kann nicht entschlüsselt werden. Bitte neu eingeben.':'Ein Passwort ist verschlüsselt gespeichert. Leer lassen, um es beizubehalten.'):'Kein Passwort gespeichert. Die Hosts-Abfrage kann je nach FRITZ!Box-Konfiguration auch ohne Anmeldung verfügbar sein.'}
async function loadPresence({applySettings=true}={}){try{presenceData=await api('/api/presence');renderPresenceStatus();renderPresenceHouse();renderPresenceTargets();if(applySettings&&!presenceSettingsDirty)applyPresenceSettingsToForm();return presenceData}catch(error){notify(presenceFriendlyError(error),true)}}
async function savePresenceSettings(){const body={baseUrl:presenceBaseUrlFromForm(),username:presenceUsername.value.trim(),password:presencePassword.value||undefined,enabled:presenceEnabled.checked,pollIntervalSeconds:Number(presencePollInterval.value),absenceDelaySeconds:Number(presenceAbsenceDelay.value),tlsInsecure:presenceProtocol.value==='https'&&presenceTlsInsecure.checked};try{await api('/api/presence/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});presenceSettingsDirty=false;await loadPresence();all=await api('/api/devices');automationDevicesChanged();updateDashboardSummary();notify('Präsenzeinstellungen wurden gespeichert.')}catch(error){notify(presenceFriendlyError(error),true)}}
async function testPresenceConnection(){const original=presenceTestButton.innerHTML;presenceTestButton.disabled=true;presenceTestButton.textContent='Verbindung wird geprüft …';try{const result=await api('/api/presence/test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseUrl:presenceBaseUrlFromForm(),username:presenceUsername.value.trim(),password:presencePassword.value||undefined,tlsInsecure:presenceProtocol.value==='https'&&presenceTlsInsecure.checked})});await loadPresence({applySettings:false});notify(`FRITZ!Box erreichbar · ${Number(result.hostCount||0)} Heimnetzgeräte gefunden.`)}catch(error){await loadPresence({applySettings:false}).catch(()=>undefined);notify(presenceFriendlyError(error),true)}finally{presenceTestButton.disabled=false;presenceTestButton.innerHTML=original}}
async function refreshPresence(){try{await api('/api/presence/refresh',{method:'POST'});await loadPresence();all=await api('/api/devices');automationDevicesChanged();updateDashboardSummary();notify('Präsenz wurde aktualisiert.')}catch(error){notify(presenceFriendlyError(error),true)}}
function resetPresenceTargetForm(){editingPresenceTargetId=null;presenceTargetForm.reset();presenceTargetFormTitle.textContent='Person hinzufügen';presenceTargetSaveButton.textContent='Person hinzufügen';presenceTargetCancelButton.hidden=true}
function editPresenceTarget(id){const target=presenceData?.targets?.find(item=>item.id===id);if(!target)return;editingPresenceTargetId=id;presenceTargetFormTitle.textContent='Person bearbeiten';presenceTargetSaveButton.textContent='Änderungen speichern';presenceTargetCancelButton.hidden=false;presenceTargetName.value=target.name;presenceTargetMac.value=target.macAddress;presenceTargetDelay.value=target.absenceDelaySeconds==null?'':String(target.absenceDelaySeconds);presenceTargetName.focus();window.scrollTo({top:document.querySelector('.presence-devices-layout')?.offsetTop||0,behavior:'smooth'})}
function cancelPresenceTargetEdit(){resetPresenceTargetForm()}
async function savePresenceTarget(){const delay=presenceTargetDelay.value===''?null:Number(presenceTargetDelay.value);const body={name:presenceTargetName.value.trim(),macAddress:presenceTargetMac.value.trim(),absenceDelaySeconds:delay};const editing=Boolean(editingPresenceTargetId);try{await api(editing?`/api/presence/devices/${editingPresenceTargetId}`:'/api/presence/devices',{method:editing?'PUT':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});resetPresenceTargetForm();await loadPresence();all=await api('/api/devices');automationDevicesChanged();updateDashboardSummary();notify(editing?'Präsenzgerät wurde aktualisiert.':'Person wurde zur Präsenzerkennung hinzugefügt.')}catch(error){notify(presenceFriendlyError(error),true)}}
async function deletePresenceTarget(id){const target=presenceData?.targets?.find(item=>item.id===id);if(!target||!confirm(`„${target.name}“ aus der Präsenzerkennung löschen?`))return;try{await api(`/api/presence/devices/${id}`,{method:'DELETE'});if(editingPresenceTargetId===id)resetPresenceTargetForm();await loadPresence();all=await api('/api/devices');automationDevicesChanged();updateDashboardSummary();notify('Präsenzgerät wurde gelöscht.')}catch(error){notify(presenceFriendlyError(error),true)}}
function readableLogDetails(details){if(!details||typeof details!=='object'||!Object.keys(details).length)return '';return Object.entries(details).filter(([,value])=>value!==undefined&&value!==null&&value!=='').map(([key,value])=>`${key}: ${typeof value==='object'?JSON.stringify(value):value}`).join('\n')}
function systemLogLevelMeta(level){return level==='error'?{label:'Fehler',icon:'mdi-alert-circle-outline'}:level==='warning'?{label:'Warnung',icon:'mdi-alert-outline'}:{label:'Info',icon:'mdi-information-outline'}}
function systemLogSourceLabel(source){const names={system:'System',openccu:'OpenCCU',virtual:'Virtuell',presence:'Präsenz',automation:'Automationen',notification:'Benachrichtigungen',homekit:'HomeKit'};return names[source]||source}
function systemLogTime(value){const date=new Date(value);return Number.isNaN(date.getTime())?'–':date.toLocaleString('de-DE',{dateStyle:'short',timeStyle:'medium'})}
function renderSystemLogs(){systemLogCount.textContent=String(systemLogs.length);if(!systemLogs.length){systemLogList.innerHTML='<article class="empty-state compact"><h3>Keine Protokolleinträge</h3><p class="muted">Für die gewählten Filter sind keine Ereignisse vorhanden.</p></article>';return}systemLogList.innerHTML=systemLogs.map(entry=>{const details=readableLogDetails(entry.details);const level=systemLogLevelMeta(entry.level);const code=entry.code?`<code class="system-log-code">${escapeHtml(entry.code)}</code>`:'';const detailMarkup=details?`<details class="system-log-details"><summary>Details</summary><pre>${escapeHtml(details)}</pre></details>`:'';return `<article class="system-log-entry ${escapeHtml(entry.level)}"><div class="system-log-entry-head"><span class="system-log-level"><span class="mdi ${level.icon}" aria-hidden="true"></span>${level.label}</span><span class="system-log-source">${escapeHtml(systemLogSourceLabel(entry.source))}</span><time class="system-log-time">${escapeHtml(systemLogTime(entry.createdAt))}</time></div><div class="system-log-message"><div class="system-log-message-line"><strong>${escapeHtml(entry.message)}</strong>${code}</div>${detailMarkup}</div></article>`}).join('')}
async function loadSystemLogs(){const query=new URLSearchParams({limit:'100'});if(logSourceFilter.value)query.set('source',logSourceFilter.value);if(logLevelFilter.value)query.set('level',logLevelFilter.value);const result=await api(`/api/logs?${query}`);systemLogs=(result.entries||[]).slice(0,100);renderSystemLogs()}
async function clearSystemLog(){if(!confirm('Systemprotokoll wirklich vollständig leeren?'))return;await api('/api/logs',{method:'DELETE'});systemLogs=[];renderSystemLogs();notify('Systemprotokoll wurde geleert.')}
function routeFromHash(){const value=location.hash.replace('#','');return pages.includes(value)?value:defaultPage}
function setActiveNavigation(page){document.querySelectorAll('[data-nav]').forEach(item=>{const active=item.dataset.nav===page;item.classList.toggle('active',active);if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current')})}
async function showPage(page,{focus=false}={}){const target=pages.includes(page)?page:defaultPage;document.querySelectorAll('[data-page]').forEach(section=>section.hidden=section.dataset.page!==target);setActiveNavigation(target);if(target==='settings'){const active=document.querySelector('[data-settings-panel].active')?.dataset.settingsPanel||'shelly';await showSettingsPanel(active)}else if(target==='logs')await loadSystemLogs();else if(target==='presence')await loadPresence();if(focus){document.querySelector(`[data-page="${target}"] h1`)?.focus({preventScroll:true})}window.scrollTo({top:0,behavior:'instant'})}
function openMenu(){document.body.classList.add('menu-open');sidebarBackdrop.hidden=false;menuToggle.setAttribute('aria-expanded','true');menuClose.focus()}
function closeMenu({restoreFocus=false}={}){document.body.classList.remove('menu-open');sidebarBackdrop.hidden=true;menuToggle.setAttribute('aria-expanded','false');if(restoreFocus)menuToggle.focus()}
function navigate(){showPage(routeFromHash());closeMenu()}
function showUnavailable(name){notify(`${name} folgt in einer kommenden SALTA-Version.`)}
function notify(message,error=false){toast.textContent=message;toast.classList.toggle('error',error);toast.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),2600)}

filter.addEventListener('input',renderDevices);roomFilter.addEventListener('change',renderDevices);zigbeeFilter.addEventListener('input',renderDevices);zigbeeRoomFilter.addEventListener('change',renderDevices);openCcuFilter.addEventListener('input',renderDevices);openCcuRoomFilter.addEventListener('change',renderDevices);virtualFilter.addEventListener('input',renderDevices);virtualRoomFilter.addEventListener('change',renderDevices);logSourceFilter.addEventListener('change',()=>loadSystemLogs().catch(error=>notify(error.message,true)));logLevelFilter.addEventListener('change',()=>loadSystemLogs().catch(error=>notify(error.message,true)));
roomForm.addEventListener('submit',event=>{event.preventDefault();createRoom().catch(e=>notify(e.message,true))});
shellyForm.addEventListener('submit',event=>{event.preventDefault();saveShelly().catch(e=>notify(e.message,true))});
phosconForm.addEventListener('submit',event=>{event.preventDefault();savePhoscon().catch(e=>notify(friendlyPhosconError(e),true))});
openCcuForm.addEventListener('submit',event=>{event.preventDefault();saveOpenCcu().catch(e=>notify(friendlyOpenCcuError(e),true))});
homeKitForm.addEventListener('submit',event=>{event.preventDefault();saveHomeKitSettings().catch(e=>notify(e.message,true))});
climateSettingsForm.addEventListener('submit',event=>{event.preventDefault();saveClimateSettings().catch(e=>notify(e.message,true))});
generalSettingsForm.addEventListener('submit',event=>{event.preventDefault();saveGeneralSettings().catch(e=>notify(e.message,true))});
notificationForm.addEventListener('submit',event=>{event.preventDefault();saveNotificationSettings().catch(e=>notify(e.message,true))});
recoveryBackupFile.addEventListener('change',()=>inspectDisasterRecoveryBackupFile(recoveryBackupFile.files?.[0]).catch(e=>notify(e.message,true)));
presenceSettingsForm.addEventListener('submit',event=>{event.preventDefault();savePresenceSettings().catch(e=>notify(presenceFriendlyError(e),true))});
presenceSettingsForm.addEventListener('input',()=>{presenceSettingsDirty=true});
presenceSettingsForm.addEventListener('change',()=>{presenceSettingsDirty=true});
presenceProtocol.addEventListener('change',updatePresenceTlsControl);
presenceTargetForm.addEventListener('submit',event=>{event.preventDefault();savePresenceTarget().catch(e=>notify(presenceFriendlyError(e),true))});
addShellyForm.addEventListener('submit',event=>{event.preventDefault();addShelly().catch(e=>notify(e.message,true))});
addVirtualDeviceForm.addEventListener('submit',event=>{event.preventDefault();addVirtualDevice().catch(e=>notify(e.message,true))});
document.querySelectorAll('input[name="shellyCredentialMode"]').forEach(input=>input.addEventListener('change',toggleCustomShellyCredentials));
credentialMode.addEventListener('change',toggleDeviceCredentials);
deviceHomeKitUseSaltaRoom.addEventListener('change',syncDeviceHomeKitRoomControls);
deviceRoom.addEventListener('change',syncDeviceHomeKitRoomControls);
devicePresentationType.addEventListener('change',renderDeviceHomeKitCompatibility);
deviceHidden.addEventListener('change',renderDeviceHomeKitCompatibility);
window.addEventListener('hashchange',navigate);
menuToggle.addEventListener('click',openMenu);
menuClose.addEventListener('click',()=>closeMenu({restoreFocus:true}));
sidebarBackdrop.addEventListener('click',()=>closeMenu({restoreFocus:true}));
themeToggleElement?.addEventListener('click',toggleTheme);
document.getElementById('logoutButton')?.addEventListener('click',()=>logout().catch(()=>location.replace('/login')));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('menu-open'))closeMenu({restoreFocus:true})});
document.querySelectorAll('#sidebar [data-nav]').forEach(item=>item.addEventListener('click',()=>{if(matchMedia('(max-width: 1000px)').matches)closeMenu()}));
deviceDialog.addEventListener('close',()=>{selectedDevice=null;setActiveNavigation(routeFromHash())});

newRoomIcon.innerHTML=roomIconOptions('home-outline');
newRoomIcon.addEventListener('change',()=>updateRoomIconPreview(newRoomIcon));
updateRoomIconPreview(newRoomIcon);
initializeTheme();
initializeSession().then(()=>{navigate();load();setInterval(refreshLiveData,5000)}).catch(()=>undefined);
