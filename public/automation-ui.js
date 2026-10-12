let automationRules=[];
let editingAutomationId=null;
let automationAdditionalTriggers=[];
let automationAdditionalTriggerSequence=0;
let automationAdditionalConditions=[];
let automationAdditionalConditionSequence=0;
let automationAdditionalActions=[];
let automationAdditionalActionSequence=0;
let automationPrimaryEventValues=[];
function automationLocale(){return globalThis.SaltaI18n?.locale?.()||'de-DE'}

const automationElements={
  list:document.getElementById('automationList'),
  count:document.getElementById('automationCount'),
  form:document.getElementById('automationForm'),
  title:document.getElementById('automationFormTitle'),
  name:document.getElementById('automationName'),
  room:document.getElementById('automationRoom'),
  enabled:document.getElementById('automationEnabled'),
  scheduleEnabled:document.getElementById('automationScheduleEnabled'),
  scheduleFields:document.getElementById('automationScheduleFields'),
  weekendEnabled:document.getElementById('automationWeekendEnabled'),
  triggerType:document.getElementById('automationTriggerType'),
  deviceTriggerFields:document.getElementById('automationDeviceTriggerFields'),
  triggerTimeField:document.getElementById('automationTriggerTimeField'),
  triggerTime:document.getElementById('automationTriggerTime'),
  triggerDevice:document.getElementById('automationTriggerDevice'),
  triggerSearch:document.getElementById('automationTriggerDeviceSearch'),
  triggerCount:document.getElementById('automationTriggerDeviceCount'),
  triggerState:document.getElementById('automationTriggerState'),
  triggerValue:document.getElementById('automationTriggerValue'),
  triggerEventPicker:document.getElementById('automationTriggerEventPicker'),
  triggerEventSummary:document.getElementById('automationTriggerEventSummary'),
  triggerEventOptions:document.getElementById('automationTriggerEventOptions'),
  triggerEventHint:document.getElementById('automationTriggerEventHint'),
  additionalTriggers:document.getElementById('automationAdditionalTriggers'),
  addTrigger:document.getElementById('automationAddTriggerButton'),
  conditionEnabled:document.getElementById('automationConditionEnabled'),
  conditionFields:document.getElementById('automationConditionFields'),
  conditionDevice:document.getElementById('automationConditionDevice'),
  conditionSearch:document.getElementById('automationConditionDeviceSearch'),
  conditionCount:document.getElementById('automationConditionDeviceCount'),
  conditionState:document.getElementById('automationConditionState'),
  conditionValue:document.getElementById('automationConditionValue'),
  additionalConditions:document.getElementById('automationAdditionalConditions'),
  addCondition:document.getElementById('automationAddConditionButton'),
  additionalActions:document.getElementById('automationAdditionalActions'),
  addAction:document.getElementById('automationAddActionButton'),
  addWait:document.getElementById('automationAddWaitButton'),
  cancel:document.getElementById('automationCancelButton'),
  save:document.getElementById('automationSaveButton')
};

const automationStatePriority=['on','vacationActive','present','anyHome','nobodyHome','motion','open','water','fire','alarm','vibration','dark','daylight','tampered','lowBattery'];
const automationActionLabels={turnOn:'An',turnOnForSeconds:'An für Sekunden',turnOff:'Aus',toggle:'Toggle',open:'Öffnen',close:'Schließen',thermostatOff:'Thermostat Aus',thermostatAuto:'Thermostat Automatik',thermostatManual:'Thermostat Manuell',setTargetTemperature:'Solltemperatur setzen',climateSummer:'Sommermodus',climateWinter:'Wintermodus',wait:'Warten'};
const automationButtonEventMarker='event:buttonEvent';
const automationHeldContactClosed10Value='false:10';
const automationCommonButtonEvents=[1000,1001,1002,1003,1004,1005,1006,1007,1010];
const automationModelButtonEvents={
  'lumi.remote.b1acn01':[1002,1004,1001,1003],
  'lumi.sensor_switch.aq2':[1002,1004,1005,1006],
  'lumi.sensor_switch':[1000,1002,1003,1004,1005,1006,1010],
  'hm-pb-6-wm55':[1002,1001,1003]
};
const automationAllExecutionDays=[1,2,3,4,5,6,7];
const automationWeekdayLabelsDe={1:'Mo',2:'Di',3:'Mi',4:'Do',5:'Fr',6:'Sa',7:'So'};
const automationWeekdayLabelsEn={1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat',7:'Sun'};


function automationBooleanStateKeys(device){
  const keys=Object.entries(device?.state||{}).filter(([,value])=>typeof value==='boolean').map(([key])=>key);
  return keys.sort((a,b)=>{const ai=automationStatePriority.indexOf(a),bi=automationStatePriority.indexOf(b);if(ai>=0||bi>=0){if(ai<0)return 1;if(bi<0)return -1;return ai-bi}return a.localeCompare(b)});
}
function automationEventStateKeys(device){return device&&(device.type==='button'||typeof device.state?.buttonEvent==='number'||device.adapterData?.buttonEventProtocol==='deconz')?['buttonEvent']:[]}
function automationStateLabel(key){return key===automationButtonEventMarker?'Tasterereignis':key==='winterActive'?'Heizmodus':key==='vacationActive'?'Urlaubsmodus':labels?.[key]||key}
function automationValueLabel(key,value){
  if(key==='open'&&value===automationHeldContactClosed10Value)return 'Geschlossen für 10 Sekunden';
  const states={on:['An','Aus'],motion:['Bewegung erkannt','Keine Bewegung'],open:['Offen','Geschlossen'],water:['Wasser erkannt','Trocken'],fire:['Alarm','Normal'],alarm:['Alarm','Normal'],vibration:['Erkannt','Ruhe'],lowBattery:['Niedrig','OK'],tampered:['Erkannt','OK'],dark:['Dunkel','Hell'],daylight:['Tageslicht','Kein Tageslicht'],present:['Anwesend','Abwesend'],anyHome:['Jemand zuhause','Niemand zuhause'],nobodyHome:['Niemand zuhause','Jemand zuhause'],winterActive:['Wintermodus','Sommermodus'],vacationActive:['Aktiv','Inaktiv']};
  const pair=states[key]||['Aktiv','Inaktiv'];
  return value===true||value==='true'?pair[0]:pair[1];
}
function automationButtonEventLabel(value){
  const numeric=Number(value);if(!Number.isFinite(numeric))return String(value);
  const button=Math.trunc(numeric/1000);const suffix=numeric%1000;
  const actions={0:'Drücken',1:'Hold',2:'Einfachklick',3:'Losgelassen',4:'Doppelklick',5:'Dreifachklick',6:'Vierfachklick',7:'Sonderereignis',10:'Mehrfachklick'};
  const action=actions[suffix]||`Event ${numeric}`;
  return `${numeric} · ${button>1?`Taste ${button} · `:''}${action}`;
}
function automationButtonEventValues(device){
  const model=String(device?.model||'').trim().toLowerCase();
  const configured=automationModelButtonEvents[model]||automationCommonButtonEvents;
  const values=[...configured];
  const current=Number(device?.state?.buttonEvent);
  if(Number.isSafeInteger(current)&&!values.includes(current))values.unshift(current);
  return values;
}
function automationParseStoredEventTrigger(value){const match=/^event:buttonEvent:(-?\d+)$/.exec(String(value||''));if(!match)return null;const eventValue=Number(match[1]);return Number.isSafeInteger(eventValue)?{key:'buttonEvent',value:eventValue}:null}
function automationParseStoredHeldTrigger(value){const match=/^hold:([a-zA-Z][a-zA-Z0-9_-]{0,63}):(\d+)$/.exec(String(value||''));if(!match)return null;const seconds=Number(match[2]);return Number.isSafeInteger(seconds)&&seconds>=1&&seconds<=86400?{key:match[1],seconds}:null}
function automationTriggerBooleanValue(value){return value===true||value==='true'}
function automationStoredTriggerStateKey(deviceId,stateKey,value){const device=automationDeviceById(deviceId);return device?.type==='contactSensor'&&stateKey==='open'&&value===automationHeldContactClosed10Value?'hold:open:10':stateKey}
function automationAdditionalEventValues(trigger){
  const device=automationDeviceById(trigger?.deviceId);const allowed=automationButtonEventValues(device);
  const raw=Array.isArray(trigger?.eventValues)?trigger.eventValues:[trigger?.value];
  const unique=[...new Set(raw.map(Number).filter(value=>Number.isSafeInteger(value)&&allowed.includes(value)))];
  return unique.length?unique:[allowed[0]??1000];
}
function automationTimeTriggerActive(){return automationElements.triggerType?.value==='time'}
function automationAdditionalTriggerDefinitionCount(trigger){return trigger?.stateKey===automationButtonEventMarker?Math.max(1,automationAdditionalEventValues(trigger).length):1}
function automationAdditionalDefinitionCount(excludedId=null){return automationAdditionalTriggers.filter(trigger=>trigger.id!==excludedId).reduce((sum,trigger)=>sum+automationAdditionalTriggerDefinitionCount(trigger),0)}
function automationPrimaryTriggerDefinitionCount(){if(automationTimeTriggerActive())return 1;return automationElements.triggerState?.value===automationButtonEventMarker?Math.max(1,automationPrimaryEventValues.length):1}
function automationTotalTriggerDefinitionCount(){return automationPrimaryTriggerDefinitionCount()+automationAdditionalDefinitionCount()}
function automationPrimaryEventCapacity(){return Math.max(1,8-automationAdditionalDefinitionCount())}
function automationAdditionalEventCapacity(id){return Math.max(1,8-automationPrimaryTriggerDefinitionCount()-automationAdditionalDefinitionCount(id))}
function refreshAutomationAddTriggerAvailability(){const timeTrigger=automationTimeTriggerActive();const triggerLimitReached=automationAdditionalTriggers.length>=7||automationTotalTriggerDefinitionCount()>=8;if(automationElements.addTrigger){automationElements.addTrigger.hidden=timeTrigger||triggerLimitReached;automationElements.addTrigger.disabled=timeTrigger||triggerLimitReached}}
function automationSetPrimaryEventValues(values){
  const unique=[...new Set(values.map(Number).filter(Number.isSafeInteger))];
  automationPrimaryEventValues=unique.slice(0,automationPrimaryEventCapacity());
}
function automationTogglePrimaryEvent(value,checked){
  const numeric=Number(value);if(!Number.isSafeInteger(numeric))return;
  const current=new Set(automationPrimaryEventValues);
  if(checked){
    if(current.size>=automationPrimaryEventCapacity()){notify('Maximal acht Auslöser insgesamt.',true);renderAutomationPrimaryEventPicker();return}
    current.add(numeric);
  }else{
    current.delete(numeric);
    if(!current.size)current.add(numeric);
  }
  automationSetPrimaryEventValues([...current]);renderAutomationPrimaryEventPicker();
}
function renderAutomationPrimaryEventPicker(){
  const isEvent=automationElements.triggerState?.value===automationButtonEventMarker;
  if(!automationElements.triggerEventPicker)return;
  automationElements.triggerValue.hidden=isEvent;
  automationElements.triggerEventPicker.hidden=!isEvent;
  automationElements.triggerEventHint.hidden=!isEvent;
  if(!isEvent){refreshAutomationAddTriggerAvailability();return}
  const device=automationDeviceById(automationElements.triggerDevice.value);
  const values=automationButtonEventValues(device);
  if(!automationPrimaryEventValues.length)automationSetPrimaryEventValues([values[0]]);
  automationPrimaryEventValues=automationPrimaryEventValues.filter(value=>values.includes(value));
  if(!automationPrimaryEventValues.length)automationSetPrimaryEventValues([values[0]]);
  automationElements.triggerEventOptions.innerHTML=values.map(value=>`<label class="automation-event-option"><input type="checkbox" value="${value}" ${automationPrimaryEventValues.includes(value)?'checked':''} onchange="automationTogglePrimaryEvent(${value},this.checked)"><span>${escapeHtml(automationButtonEventLabel(value))}</span></label>`).join('');
  const labelsSelected=automationPrimaryEventValues.map(automationButtonEventLabel);
  automationElements.triggerEventSummary.textContent=labelsSelected.length===1?labelsSelected[0]:`${labelsSelected.length} Ereignisse ausgewählt`;refreshAutomationAddTriggerAvailability();
}
function automationDeviceLabel(device){return `${device.name} · ${sourceLabels?.[device.source]||device.source}${device.room?` · ${device.room}`:''}`}
function automationDeviceById(id){return all.find(device=>device.id===id)}
function automationIsClimateModeDevice(device){return device?.source==='system'&&device.adapterData?.systemKind==='climateMode'}
function automationIsVacationModeDevice(device){return device?.source==='system'&&device.adapterData?.systemKind==='vacationMode'}
function automationTriggerDevices(){return all.filter(device=>device.source!=='system'&&(automationBooleanStateKeys(device).length>0||automationEventStateKeys(device).length>0))}
function automationConditionDevices(){return all.filter(device=>automationBooleanStateKeys(device).length>0)}
function automationActionDevices(){return all.filter(device=>automationActionsForDevice(device.id).length>0)}
function automationAllTriggerDeviceIds(){if(automationTimeTriggerActive())return new Set();return new Set([automationElements.triggerDevice?.value,...automationAdditionalTriggers.map(trigger=>trigger.deviceId)].filter(Boolean))}
function automationAllActionDeviceIds(excludedId=null){return new Set(automationAdditionalActions.filter(step=>step.id!==excludedId&&step.action!=='wait').map(step=>step.deviceId).filter(Boolean))}
function automationCurrentTriggerDefinitions(){
  if(automationTimeTriggerActive())return [];
  const definitions=[];const primaryDeviceId=automationElements.triggerDevice?.value;const primaryStateKey=automationElements.triggerState?.value;
  if(primaryDeviceId&&primaryStateKey){const rawValue=automationElements.triggerValue?.value;definitions.push({deviceId:primaryDeviceId,stateKey:primaryStateKey===automationButtonEventMarker?primaryStateKey:automationStoredTriggerStateKey(primaryDeviceId,primaryStateKey,rawValue),value:primaryStateKey===automationButtonEventMarker?true:automationTriggerBooleanValue(rawValue)})}
  for(const trigger of automationAdditionalTriggers)definitions.push({deviceId:trigger.deviceId,stateKey:automationStoredTriggerStateKey(trigger.deviceId,trigger.stateKey,trigger.value),value:automationTriggerBooleanValue(trigger.value)});
  return definitions;
}
function automationVirtualSelfResetAction(deviceId){
  const device=automationDeviceById(deviceId);if(device?.source!=='virtual'||device.adapterData?.virtualType==='button')return '';const matching=automationCurrentTriggerDefinitions().filter(trigger=>trigger.deviceId===deviceId);
  if(!matching.length||matching.some(trigger=>trigger.stateKey!=='on'))return '';const values=new Set(matching.map(trigger=>trigger.value));if(values.size!==1)return '';return matching[0].value?'turnOff':'turnOn';
}
function automationTargetDeviceAllowed(device){const triggerConflict=automationAllTriggerDeviceIds().has(device.id);return !triggerConflict||Boolean(automationVirtualSelfResetAction(device.id))}
function normalizedAutomationSearch(value){return String(value||'').trim().toLocaleLowerCase(automationLocale())}
function automationDeviceSearchText(device){return [device.name,device.room,sourceLabels?.[device.source]||device.source,device.model,typeLabels?.[device.type]||device.type].filter(Boolean).join(' ').toLocaleLowerCase(automationLocale())}
function automationDeviceMatchesSearch(device,query){const terms=normalizedAutomationSearch(query).split(/\s+/).filter(Boolean);if(!terms.length)return true;const haystack=automationDeviceSearchText(device);return terms.every(term=>haystack.includes(term))}
function sortedAutomationDevices(devices){return [...devices].sort((a,b)=>String(a.room||'ZZZ').localeCompare(String(b.room||'ZZZ'),automationLocale(),{sensitivity:'base'})||String(a.name||'').localeCompare(String(b.name||''),automationLocale(),{sensitivity:'base'})||String(a.source||'').localeCompare(String(b.source||''),automationLocale(),{sensitivity:'base'}))}
function fillAutomationSelect(select,devices,selected,placeholder='Gerät wählen',query='',countElement=null){
  const sorted=sortedAutomationDevices(devices);
  const matches=sorted.filter(device=>automationDeviceMatchesSearch(device,query));
  const current=selected?sorted.find(device=>device.id===selected):null;
  const visible=current&&!matches.some(device=>device.id===current.id)?[current,...matches]:matches;
  const emptyLabel=normalizedAutomationSearch(query)&&!matches.length?'Keine passenden Geräte gefunden':placeholder;
  const options=[`<option value="">${escapeHtml(emptyLabel)}</option>`,...visible.map(device=>{const label=automationDeviceLabel(device);const retained=current?.id===device.id&&!matches.some(match=>match.id===device.id);return `<option value="${escapeHtml(device.id)}"${device.id===selected?' selected':''} title="${escapeHtml(label)}">${escapeHtml(label)}${retained?' · aktuelle Auswahl':''}</option>`})];
  select.innerHTML=options.join('');
  if(selected&&visible.some(device=>device.id===selected))select.value=selected;
  if(countElement)countElement.textContent=normalizedAutomationSearch(query)?`${matches.length} von ${sorted.length} Geräten gefunden`:`${sorted.length} Geräte verfügbar`;
}
function clearAutomationDeviceSearches(){for(const input of [automationElements.triggerSearch,automationElements.conditionSearch])if(input)input.value=''}
function refreshAutomationDeviceSearch(kind){
  const triggerIds=automationAllTriggerDeviceIds();
  if(kind==='trigger')fillAutomationSelect(automationElements.triggerDevice,automationTriggerDevices(),automationElements.triggerDevice.value,'Triggergerät wählen',automationElements.triggerSearch?.value,automationElements.triggerCount);
  if(kind==='condition')fillAutomationSelect(automationElements.conditionDevice,automationConditionDevices().filter(device=>!triggerIds.has(device.id)),automationElements.conditionDevice.value,'Anderes Bedingungsgerät wählen',automationElements.conditionSearch?.value,automationElements.conditionCount);
}
function fillAutomationStateSelect(select,deviceId,selected,includeEvents=false){
  const device=automationDeviceById(deviceId);const keys=device?automationBooleanStateKeys(device):[];
  const options=keys.map(key=>({value:key,label:automationStateLabel(key)}));
  if(includeEvents&&device&&automationEventStateKeys(device).includes('buttonEvent'))options.push({value:automationButtonEventMarker,label:'Tasterereignis'});
  select.innerHTML=options.length?options.map(option=>`<option value="${escapeHtml(option.value)}"${option.value===selected?' selected':''}>${escapeHtml(option.label)}</option>`).join(''):'<option value="">Kein Trigger verfügbar</option>';
  if(!options.some(option=>option.value===select.value)&&options.length)select.value=options[0].value;
}
function fillAutomationValueSelect(select,stateKey,selected,deviceId=automationElements.triggerDevice.value){
  if(stateKey===automationButtonEventMarker){
    const device=automationDeviceById(deviceId);const values=automationButtonEventValues(device);const numeric=Number(selected);const current=Number.isSafeInteger(numeric)&&values.includes(numeric)?numeric:values[0];
    select.innerHTML=values.map(value=>`<option value="${value}"${value===current?' selected':''}>${escapeHtml(automationButtonEventLabel(value))}</option>`).join('');return;
  }
  const device=automationDeviceById(deviceId);const options=[true,false];if(device?.type==='contactSensor'&&stateKey==='open')options.push(automationHeldContactClosed10Value);
  const current=selected===automationHeldContactClosed10Value?automationHeldContactClosed10Value:selected===undefined?true:automationTriggerBooleanValue(selected);
  select.innerHTML=options.map(value=>`<option value="${value}"${value===current?' selected':''}>${escapeHtml(automationValueLabel(stateKey,value))}</option>`).join('');
}
function automationThermostatRange(device){
  const metadata=device?.adapterData||{};const min=Number(metadata.targetTemperatureMin??4.5);const max=Number(metadata.targetTemperatureMax??30);const step=Number(metadata.targetTemperatureStep??0.5);
  return {min:Number.isFinite(min)?min:4.5,max:Number.isFinite(max)?max:30,step:Number.isFinite(step)&&step>0?step:0.5};
}
function automationDefaultTargetTemperature(device){
  const range=automationThermostatRange(device);const current=Number(device?.state?.targetTemperature);const fallback=Number.isFinite(current)?current:21;return Math.min(range.max,Math.max(range.min,fallback));
}
function automationNormalizeTemperature(device,value){
  const range=automationThermostatRange(device);const numeric=Number(value);const base=Number.isFinite(numeric)?numeric:automationDefaultTargetTemperature(device);const rounded=Math.round(base/range.step)*range.step;return Math.min(range.max,Math.max(range.min,Number(rounded.toFixed(2))));
}
function automationNormalizeSeconds(value){const numeric=Number(value);return Number.isFinite(numeric)?Math.min(86400,Math.max(1,Math.round(numeric))):10}
function automationActionValueLabel(target){
  if(target?.action==='setTargetTemperature'&&Number.isFinite(Number(target?.value)))return `${Number(target.value).toLocaleString(automationLocale(),{minimumFractionDigits:1,maximumFractionDigits:1})} °C`;
  if(target?.action==='turnOnForSeconds'&&Number.isFinite(Number(target?.value)))return `${automationNormalizeSeconds(target.value).toLocaleString(automationLocale())} s`;
  return '';
}
function automationActionsForDevice(deviceId){
  const device=automationDeviceById(deviceId);if(!device)return [];
  const capabilities=new Set(Array.isArray(device.capabilities)?device.capabilities:[]);const actions=[];
  if(device.source==='system'&&device.adapterData?.systemKind==='climateMode'&&capabilities.has('setClimateMode'))return ['climateSummer','climateWinter'];
  const binaryFallback=device.source==='virtual'||(device.source==='openccu'&&['switch','light','outlet'].includes(device.type)&&typeof device.state?.on==='boolean');
  for(const action of ['turnOn','turnOff','toggle'])if(capabilities.has(action)||binaryFallback)actions.push(action);
  if(device.source==='shelly'&&device.componentKind==='switch'&&capabilities.has('turnOn'))actions.splice(Math.max(0,actions.indexOf('turnOn')+1),0,'turnOnForSeconds');
  if(capabilities.has('open'))actions.push('open');
  if(capabilities.has('close'))actions.push('close');
  const thermostatModes=capabilities.has('setThermostatMode')||(device.source==='openccu'&&device.type==='thermostat'&&capabilities.has('setTargetTemperature')&&typeof device.state?.controlMode==='string');
  if(thermostatModes)actions.push('thermostatOff','thermostatAuto','thermostatManual');
  if(capabilities.has('setTargetTemperature'))actions.push('setTargetTemperature');
  return actions;
}
function automationActionsForTargetDevice(deviceId){const actions=automationActionsForDevice(deviceId);const resetAction=automationVirtualSelfResetAction(deviceId);return automationAllTriggerDeviceIds().has(deviceId)?(resetAction&&actions.includes(resetAction)?[resetAction]:[]):actions}
function fillAutomationActionSelectElement(select,deviceId,selected){
  const actions=automationActionsForTargetDevice(deviceId);
  select.innerHTML=actions.length?actions.map(action=>`<option value="${action}"${action===selected?' selected':''}>${automationActionLabels[action]}</option>`).join(''):'<option value="">Keine Schaltaktion verfügbar</option>';
  if(selected&&actions.includes(selected))select.value=selected;else if(actions.length)select.value=actions[0];
}
function updateAutomationTriggerMode(values={}){
  if(!automationElements.triggerType)return;
  const type=values.triggerType==='time'?'time':values.triggerType==='device'?'device':automationElements.triggerType.value||'device';
  automationElements.triggerType.value=type;
  const timeTrigger=type==='time';
  if(automationElements.deviceTriggerFields)automationElements.deviceTriggerFields.hidden=timeTrigger;
  if(automationElements.additionalTriggers)automationElements.additionalTriggers.hidden=timeTrigger;
  if(automationElements.triggerTimeField)automationElements.triggerTimeField.hidden=!timeTrigger;
  if(automationElements.triggerTime){automationElements.triggerTime.required=timeTrigger;if(values.triggerTime)automationElements.triggerTime.value=values.triggerTime}
  if(automationElements.triggerDevice)automationElements.triggerDevice.required=!timeTrigger;
  if(automationElements.triggerState)automationElements.triggerState.required=!timeTrigger;
  if(automationElements.triggerValue)automationElements.triggerValue.required=!timeTrigger;
  if(timeTrigger){automationElements.triggerEventPicker.hidden=true;automationElements.triggerEventHint.hidden=true}
  refreshAutomationAddTriggerAvailability();
}
function updateAutomationFormOptions(values={}){
  updateAutomationTriggerMode(values);
  const storedEvent=automationTimeTriggerActive()?null:automationParseStoredEventTrigger(values.triggerStateKey);
  const storedHeld=automationTimeTriggerActive()?null:automationParseStoredHeldTrigger(values.triggerStateKey);
  const triggerSelected=values.triggerDeviceId??automationElements.triggerDevice.value;
  fillAutomationSelect(automationElements.triggerDevice,automationTriggerDevices(),triggerSelected,'Triggergerät wählen',automationElements.triggerSearch?.value,automationElements.triggerCount);
  const triggerId=automationElements.triggerDevice.value||triggerSelected;
  const triggerState=storedEvent?automationButtonEventMarker:(storedHeld?.key??values.triggerStateKey??automationElements.triggerState.value);
  fillAutomationStateSelect(automationElements.triggerState,triggerId,triggerState,true);
  const triggerValue=storedEvent?.value??(storedHeld?.seconds===10&&values.triggerValue===false?automationHeldContactClosed10Value:values.triggerValue??automationElements.triggerValue.value);
  fillAutomationValueSelect(automationElements.triggerValue,automationElements.triggerState.value,triggerValue,triggerId);
  if(automationElements.triggerState.value===automationButtonEventMarker&&!automationPrimaryEventValues.length)automationSetPrimaryEventValues([Number(triggerValue)]);
  renderAutomationPrimaryEventPicker();

  const triggerIds=automationAllTriggerDeviceIds();
  const conditionSelected=values.conditionDeviceId??automationElements.conditionDevice.value;
  fillAutomationSelect(automationElements.conditionDevice,automationConditionDevices().filter(device=>!triggerIds.has(device.id)),conditionSelected,'Anderes Bedingungsgerät wählen',automationElements.conditionSearch?.value,automationElements.conditionCount);
  const conditionId=automationElements.conditionDevice.value||conditionSelected;
  fillAutomationStateSelect(automationElements.conditionState,conditionId,values.conditionStateKey??automationElements.conditionState.value,false);
  fillAutomationValueSelect(automationElements.conditionValue,automationElements.conditionState.value,values.conditionValue??automationElements.conditionValue.value,conditionId);
  renderAutomationAdditionalConditions();

  renderAutomationAdditionalTriggers();
  renderAutomationAdditionalActions();
  updateAutomationTriggerMode(values);
}
function automationStoredAdditionalTrigger(trigger){
  const storedEvent=automationParseStoredEventTrigger(trigger?.stateKey);const storedHeld=automationParseStoredHeldTrigger(trigger?.stateKey);
  const eventValues=storedEvent?[storedEvent.value]:[];
  return {id:++automationAdditionalTriggerSequence,deviceId:String(trigger?.deviceId||''),stateKey:storedEvent?automationButtonEventMarker:storedHeld?.key??String(trigger?.stateKey||''),value:storedEvent?.value??(storedHeld?.seconds===10&&trigger?.value===false?automationHeldContactClosed10Value:trigger?.value??true),eventValues,query:'',expanded:false};
}
function automationStoredAdditionalTriggers(triggers){
  const grouped=[];const eventGroups=new Map();
  for(const trigger of triggers||[]){
    const storedEvent=automationParseStoredEventTrigger(trigger?.stateKey);
    if(storedEvent){
      const key=String(trigger?.deviceId||'');const existing=eventGroups.get(key);
      if(existing){existing.eventValues=[...new Set([...existing.eventValues,storedEvent.value])];existing.value=existing.eventValues[0];continue}
      const mapped=automationStoredAdditionalTrigger(trigger);grouped.push(mapped);eventGroups.set(key,mapped);continue;
    }
    grouped.push(automationStoredAdditionalTrigger(trigger));
  }
  return grouped;
}
function automationAdditionalTriggerSummary(trigger){
  const device=automationDeviceById(trigger.deviceId);if(!device)return 'Auslöser noch nicht vollständig';
  if(trigger.stateKey===automationButtonEventMarker){const values=automationAdditionalEventValues(trigger);return values.length===1?`${device.name} · ${automationButtonEventLabel(values[0])}`:`${device.name} · ${values.length} Ereignisse`}
  return `${device.name} · ${automationStateLabel(trigger.stateKey)} = ${automationValueLabel(trigger.stateKey,trigger.value)}`;
}
function refreshAutomationAdditionalTriggerSummary(trigger){const summary=document.getElementById(`automationExtraSummary-${trigger.id}`);if(summary)summary.textContent=automationAdditionalTriggerSummary(trigger)}
function renderAutomationAdditionalEventPicker(trigger){
  const valueSelect=document.getElementById(`automationExtraValue-${trigger.id}`);const picker=document.getElementById(`automationExtraEventPicker-${trigger.id}`);const summary=document.getElementById(`automationExtraEventSummary-${trigger.id}`);const options=document.getElementById(`automationExtraEventOptions-${trigger.id}`);const hint=document.getElementById(`automationExtraEventHint-${trigger.id}`);
  if(!valueSelect||!picker||!summary||!options||!hint)return;
  const isEvent=trigger.stateKey===automationButtonEventMarker;valueSelect.hidden=isEvent;picker.hidden=!isEvent;hint.hidden=!isEvent;if(!isEvent)return;
  const device=automationDeviceById(trigger.deviceId);const values=automationButtonEventValues(device);const selected=automationAdditionalEventValues(trigger).slice(0,automationAdditionalEventCapacity(trigger.id));trigger.eventValues=selected;trigger.value=selected[0];
  options.innerHTML=values.map(value=>`<label class="automation-event-option"><input type="checkbox" value="${value}" ${selected.includes(value)?'checked':''} onchange="automationToggleAdditionalEvent(${trigger.id},${value},this.checked)"><span>${escapeHtml(automationButtonEventLabel(value))}</span></label>`).join('');
  const selectedLabels=selected.map(automationButtonEventLabel);summary.textContent=selectedLabels.length===1?selectedLabels[0]:`${selectedLabels.length} Ereignisse ausgewählt`;refreshAutomationAdditionalTriggerSummary(trigger);
}
function automationToggleAdditionalEvent(id,value,checked){
  const trigger=automationAdditionalTriggers.find(item=>item.id===id);if(!trigger||trigger.stateKey!==automationButtonEventMarker)return;const numeric=Number(value);if(!Number.isSafeInteger(numeric))return;
  const current=new Set(automationAdditionalEventValues(trigger));
  if(checked){if(current.size>=automationAdditionalEventCapacity(id)){notify('Maximal acht Auslöser insgesamt.',true);renderAutomationAdditionalEventPicker(trigger);return}current.add(numeric)}else{current.delete(numeric);if(!current.size)current.add(numeric)}
  trigger.eventValues=[...current];trigger.value=trigger.eventValues[0];renderAutomationAdditionalEventPicker(trigger);refreshAutomationAddTriggerAvailability();
}
function renderAutomationAdditionalTriggers(){
  if(!automationElements.additionalTriggers)return;
  automationElements.additionalTriggers.innerHTML=automationAdditionalTriggers.map((trigger,index)=>`<article class="automation-or-trigger ${trigger.expanded?'expanded':''}" data-trigger-id="${trigger.id}"><div class="automation-or-trigger-head"><button class="automation-or-trigger-summary" type="button" onclick="toggleAutomationAdditionalTrigger(${trigger.id})" aria-expanded="${trigger.expanded}"><span class="automation-or-badge">ODER</span><span><small>Auslöser ${index+2}</small><strong id="automationExtraSummary-${trigger.id}">${escapeHtml(automationAdditionalTriggerSummary(trigger))}</strong></span><span class="mdi ${trigger.expanded?'mdi-chevron-up':'mdi-chevron-down'}" aria-hidden="true"></span></button><button class="automation-or-trigger-remove" type="button" onclick="removeAutomationAdditionalTrigger(${trigger.id})" aria-label="Auslöser ${index+2} entfernen" title="Auslöser entfernen"><span class="mdi mdi-close" aria-hidden="true"></span></button></div><div class="automation-or-trigger-body" ${trigger.expanded?'':'hidden'}><div class="automation-device-field"><label for="automationExtraDevice-${trigger.id}">Gerät</label><div class="automation-device-picker"><div class="search automation-device-search"><span class="mdi mdi-magnify" aria-hidden="true"></span><input id="automationExtraSearch-${trigger.id}" type="search" value="${escapeHtml(trigger.query)}" placeholder="Gerät suchen …" autocomplete="off" oninput="searchAutomationAdditionalTrigger(${trigger.id},this.value)" aria-label="Weiteres Triggergerät suchen"></div><select id="automationExtraDevice-${trigger.id}" onchange="changeAutomationAdditionalTriggerDevice(${trigger.id},this.value)"></select><small id="automationExtraCount-${trigger.id}" class="automation-device-match-count" aria-live="polite"></small></div></div><div class="automation-field-row"><label>Trigger<select id="automationExtraState-${trigger.id}" onchange="changeAutomationAdditionalTriggerState(${trigger.id},this.value)"></select></label><label>Wert / Ereignis<select id="automationExtraValue-${trigger.id}" onchange="changeAutomationAdditionalTriggerValue(${trigger.id},this.value)"></select><details id="automationExtraEventPicker-${trigger.id}" class="automation-event-picker" hidden><summary id="automationExtraEventSummary-${trigger.id}">Ereignisse auswählen</summary><div id="automationExtraEventOptions-${trigger.id}" class="automation-event-options"></div></details><small id="automationExtraEventHint-${trigger.id}" class="automation-event-hint" hidden>Mehrere Ereignisse werden ODER-verknüpft.</small></label></div></div></article>`).join('');
  for(const trigger of automationAdditionalTriggers){
    const deviceSelect=document.getElementById(`automationExtraDevice-${trigger.id}`);if(!deviceSelect)continue;
    const count=document.getElementById(`automationExtraCount-${trigger.id}`);
    const actionIds=automationAllActionDeviceIds();const triggerCandidates=automationTriggerDevices().filter(device=>!actionIds.has(device.id)||device.id===trigger.deviceId);fillAutomationSelect(deviceSelect,triggerCandidates,trigger.deviceId,'Triggergerät wählen',trigger.query,count);
    const selectedDevice=deviceSelect.value||trigger.deviceId;if(selectedDevice!==trigger.deviceId)trigger.deviceId=selectedDevice;
    const stateSelect=document.getElementById(`automationExtraState-${trigger.id}`);const valueSelect=document.getElementById(`automationExtraValue-${trigger.id}`);
    fillAutomationStateSelect(stateSelect,trigger.deviceId,trigger.stateKey,true);trigger.stateKey=stateSelect.value;
    fillAutomationValueSelect(valueSelect,trigger.stateKey,trigger.value,trigger.deviceId);
    if(trigger.stateKey===automationButtonEventMarker){trigger.eventValues=automationAdditionalEventValues(trigger);trigger.value=trigger.eventValues[0]}else{trigger.eventValues=[];trigger.value=valueSelect.value===automationHeldContactClosed10Value?automationHeldContactClosed10Value:valueSelect.value==='true'}
    renderAutomationAdditionalEventPicker(trigger);
  }
  refreshAutomationAddTriggerAvailability();
}
function addAutomationAdditionalTrigger(){
  if(automationAdditionalTriggers.length>=7||automationTotalTriggerDefinitionCount()>=8){notify('Maximal acht ODER-Auslöser pro Automation.',true);return}
  const excluded=new Set([automationElements.triggerDevice?.value,...automationAllActionDeviceIds()].filter(Boolean));const candidates=automationTriggerDevices().filter(device=>!excluded.has(device.id));const first=candidates.find(device=>!excluded.has(device.id))||candidates[0];const state=first?(automationBooleanStateKeys(first)[0]||(automationEventStateKeys(first).length?automationButtonEventMarker:'')):'';
  const value=state===automationButtonEventMarker?(automationButtonEventValues(first)[0]??1000):true;
  automationAdditionalTriggers.push({id:++automationAdditionalTriggerSequence,deviceId:first?.id||'',stateKey:state,value,eventValues:state===automationButtonEventMarker?[value]:[],query:'',expanded:true});
  updateAutomationFormOptions();
}
function removeAutomationAdditionalTrigger(id){automationAdditionalTriggers=automationAdditionalTriggers.filter(trigger=>trigger.id!==id);updateAutomationFormOptions()}
function toggleAutomationAdditionalTrigger(id){const trigger=automationAdditionalTriggers.find(item=>item.id===id);if(!trigger)return;trigger.expanded=!trigger.expanded;renderAutomationAdditionalTriggers()}
function searchAutomationAdditionalTrigger(id,query){const trigger=automationAdditionalTriggers.find(item=>item.id===id);if(!trigger)return;trigger.query=query;const select=document.getElementById(`automationExtraDevice-${id}`);const count=document.getElementById(`automationExtraCount-${id}`);const actionIds=automationAllActionDeviceIds();const candidates=automationTriggerDevices().filter(device=>!actionIds.has(device.id)||device.id===trigger.deviceId);if(select)fillAutomationSelect(select,candidates,trigger.deviceId,'Triggergerät wählen',query,count)}
function changeAutomationAdditionalTriggerDevice(id,deviceId){const trigger=automationAdditionalTriggers.find(item=>item.id===id);if(!trigger)return;trigger.deviceId=deviceId;trigger.query='';const device=automationDeviceById(deviceId);trigger.stateKey=automationBooleanStateKeys(device)[0]||(automationEventStateKeys(device).length?automationButtonEventMarker:'');trigger.value=trigger.stateKey===automationButtonEventMarker?(automationButtonEventValues(device)[0]??1000):true;trigger.eventValues=trigger.stateKey===automationButtonEventMarker?[trigger.value]:[];updateAutomationFormOptions()}
function changeAutomationAdditionalTriggerState(id,stateKey){const trigger=automationAdditionalTriggers.find(item=>item.id===id);if(!trigger)return;trigger.stateKey=stateKey;const device=automationDeviceById(trigger.deviceId);trigger.value=stateKey===automationButtonEventMarker?(automationButtonEventValues(device)[0]??1000):true;trigger.eventValues=stateKey===automationButtonEventMarker?[trigger.value]:[];renderAutomationAdditionalTriggers()}
function changeAutomationAdditionalTriggerValue(id,value){const trigger=automationAdditionalTriggers.find(item=>item.id===id);if(!trigger)return;trigger.value=trigger.stateKey===automationButtonEventMarker?Number(value):value===automationHeldContactClosed10Value?automationHeldContactClosed10Value:value==='true';if(trigger.stateKey===automationButtonEventMarker)trigger.eventValues=[trigger.value];renderAutomationAdditionalTriggers()}
function automationAdditionalTriggerPayload(){return automationAdditionalTriggers.flatMap(trigger=>trigger.stateKey===automationButtonEventMarker?automationAdditionalEventValues(trigger).map(value=>({deviceId:trigger.deviceId,stateKey:`event:buttonEvent:${value}`,value:true})):[{deviceId:trigger.deviceId,stateKey:automationStoredTriggerStateKey(trigger.deviceId,trigger.stateKey,trigger.value),value:automationTriggerBooleanValue(trigger.value)}])}
function automationStoredAdditionalConditions(conditions){return (conditions||[]).map(condition=>({id:++automationAdditionalConditionSequence,deviceId:String(condition?.deviceId||''),stateKey:String(condition?.stateKey||''),value:condition?.value===true,query:'',expanded:false}))}
function automationAdditionalConditionSummary(condition){const device=automationDeviceById(condition.deviceId);if(!device)return 'Bedingung noch nicht vollständig';return automationIsClimateModeDevice(device)?`Heizmodus = ${automationValueLabel(condition.stateKey,condition.value)}`:automationIsVacationModeDevice(device)?`Urlaubsmodus = ${automationValueLabel(condition.stateKey,condition.value)}`:`${device.name} · ${automationStateLabel(condition.stateKey)} = ${automationValueLabel(condition.stateKey,condition.value)}`}
function refreshAutomationAddConditionAvailability(){if(!automationElements.addCondition)return;const enabled=automationElements.conditionEnabled?.checked;automationElements.addCondition.hidden=!enabled||automationAdditionalConditions.length>=7;automationElements.addCondition.disabled=!enabled||automationAdditionalConditions.length>=7||automationConditionDevices().filter(device=>!automationAllTriggerDeviceIds().has(device.id)).length===0}
function renderAutomationAdditionalConditions(){
  if(!automationElements.additionalConditions)return;
  automationElements.additionalConditions.innerHTML=automationAdditionalConditions.map((condition,index)=>`<article class="automation-extra-condition ${condition.expanded?'expanded':''}" data-condition-id="${condition.id}"><div class="automation-extra-condition-head"><button class="automation-extra-condition-summary" type="button" onclick="toggleAutomationAdditionalCondition(${condition.id})" aria-expanded="${condition.expanded}"><span class="automation-and-badge">UND</span><span><small>Bedingung ${index+2}</small><strong>${escapeHtml(automationAdditionalConditionSummary(condition))}</strong></span><span class="mdi ${condition.expanded?'mdi-chevron-up':'mdi-chevron-down'}" aria-hidden="true"></span></button><button class="automation-extra-condition-remove" type="button" onclick="removeAutomationAdditionalCondition(${condition.id})" aria-label="Bedingung ${index+2} entfernen" title="Bedingung entfernen"><span class="mdi mdi-close" aria-hidden="true"></span></button></div><div class="automation-extra-condition-body" ${condition.expanded?'':'hidden'}><div class="automation-device-field"><label for="automationExtraConditionDevice-${condition.id}">Gerät / SALTA-Funktion</label><div class="automation-device-picker"><div class="search automation-device-search"><span class="mdi mdi-magnify" aria-hidden="true"></span><input id="automationExtraConditionSearch-${condition.id}" type="search" value="${escapeHtml(condition.query)}" placeholder="Gerät oder SALTA-Funktion suchen …" autocomplete="off" oninput="searchAutomationAdditionalCondition(${condition.id},this.value)" aria-label="Weitere Bedingung suchen"></div><select id="automationExtraConditionDevice-${condition.id}" onchange="changeAutomationAdditionalConditionDevice(${condition.id},this.value)"></select><small id="automationExtraConditionCount-${condition.id}" class="automation-device-match-count" aria-live="polite"></small></div></div><div class="automation-field-row"><label>Zustand<select id="automationExtraConditionState-${condition.id}" onchange="changeAutomationAdditionalConditionState(${condition.id},this.value)"></select></label><label>Ist<select id="automationExtraConditionValue-${condition.id}" onchange="changeAutomationAdditionalConditionValue(${condition.id},this.value)"></select></label></div></div></article>`).join('');
  const triggerIds=automationAllTriggerDeviceIds();
  for(const condition of automationAdditionalConditions){
    const select=document.getElementById(`automationExtraConditionDevice-${condition.id}`);const count=document.getElementById(`automationExtraConditionCount-${condition.id}`);
    const candidates=automationConditionDevices().filter(device=>!triggerIds.has(device.id));
    if(select)fillAutomationSelect(select,candidates,condition.deviceId,'Bedingungsgerät wählen',condition.query,count);
    const stateSelect=document.getElementById(`automationExtraConditionState-${condition.id}`);if(stateSelect)fillAutomationStateSelect(stateSelect,condition.deviceId,condition.stateKey,false);
    if(stateSelect?.value)condition.stateKey=stateSelect.value;
    const valueSelect=document.getElementById(`automationExtraConditionValue-${condition.id}`);if(valueSelect)fillAutomationValueSelect(valueSelect,condition.stateKey,condition.value,condition.deviceId);
  }
  refreshAutomationAddConditionAvailability();
}
function addAutomationAdditionalCondition(){
  if(automationAdditionalConditions.length>=7){notify('Maximal acht UND-Bedingungen pro Automation.',true);return}
  const triggerIds=automationAllTriggerDeviceIds();const candidates=automationConditionDevices().filter(device=>!triggerIds.has(device.id));const first=candidates[0];
  if(!first){notify('Kein weiteres geeignetes Bedingungsgerät verfügbar.',true);return}
  const stateKey=automationBooleanStateKeys(first)[0]||'';automationAdditionalConditions.push({id:++automationAdditionalConditionSequence,deviceId:first.id,stateKey,value:true,query:'',expanded:true});renderAutomationAdditionalConditions();
}
function removeAutomationAdditionalCondition(id){automationAdditionalConditions=automationAdditionalConditions.filter(condition=>condition.id!==id);renderAutomationAdditionalConditions()}
function toggleAutomationAdditionalCondition(id){const condition=automationAdditionalConditions.find(item=>item.id===id);if(!condition)return;condition.expanded=!condition.expanded;renderAutomationAdditionalConditions()}
function searchAutomationAdditionalCondition(id,query){const condition=automationAdditionalConditions.find(item=>item.id===id);if(!condition)return;condition.query=query;renderAutomationAdditionalConditions()}
function changeAutomationAdditionalConditionDevice(id,deviceId){const condition=automationAdditionalConditions.find(item=>item.id===id);if(!condition)return;condition.deviceId=deviceId;condition.query='';condition.stateKey=automationBooleanStateKeys(automationDeviceById(deviceId))[0]||'';condition.value=true;renderAutomationAdditionalConditions()}
function changeAutomationAdditionalConditionState(id,stateKey){const condition=automationAdditionalConditions.find(item=>item.id===id);if(!condition)return;condition.stateKey=stateKey;condition.value=true;renderAutomationAdditionalConditions()}
function changeAutomationAdditionalConditionValue(id,value){const condition=automationAdditionalConditions.find(item=>item.id===id);if(!condition)return;condition.value=value==='true';renderAutomationAdditionalConditions()}
function automationAdditionalConditionPayload(){return automationAdditionalConditions.map(condition=>({deviceId:condition.deviceId,stateKey:condition.stateKey,value:condition.value===true||condition.value==='true'}))}
function automationStoredSequence(rule){
  const source=Array.isArray(rule?.sequence)&&rule.sequence.length
    ? rule.sequence
    : [{deviceId:rule?.actionDeviceId,action:rule?.action,value:rule?.actionValue},...(rule?.additionalActions||[])];
  return source.filter(Boolean).map(step=>step?.action==='wait'
    ? {id:++automationAdditionalActionSequence,action:'wait',value:automationNormalizeSeconds(step?.value),expanded:false}
    : {id:++automationAdditionalActionSequence,deviceId:String(step?.deviceId||''),action:String(step?.action||''),value:['setTargetTemperature','turnOnForSeconds'].includes(step?.action)?Number(step?.value):undefined,query:'',expanded:false});
}
function automationAdditionalActionSummary(step){if(step?.action==='wait')return `Warten · ${automationNormalizeSeconds(step.value).toLocaleString(automationLocale())} s`;const device=automationDeviceById(step.deviceId);if(!device)return 'Ziel noch nicht vollständig';const valueLabel=automationActionValueLabel(step);return `${device.name} → ${automationActionLabels[step.action]||step.action}${valueLabel?` · ${valueLabel}`:''}`}
function automationActionStepCount(){return automationAdditionalActions.filter(step=>step.action!=='wait').length}
function refreshAutomationAddActionAvailability(){const limitReached=automationAdditionalActions.length>=8;const noActionCandidates=automationActionDevices().every(device=>!automationTargetDeviceAllowed(device));if(automationElements.addAction){automationElements.addAction.hidden=limitReached;automationElements.addAction.disabled=limitReached||noActionCandidates}if(automationElements.addWait){automationElements.addWait.hidden=limitReached;automationElements.addWait.disabled=limitReached}}
function renderAutomationAdditionalActions(){
  if(!automationElements.additionalActions)return;
  const actionCount=automationActionStepCount();
  automationElements.additionalActions.innerHTML=automationAdditionalActions.map((step,index)=>{
    const number=index+1;const wait=step.action==='wait';const summary=automationAdditionalActionSummary(step);
    const moveUp=index>0?`<button class="automation-extra-action-move" type="button" onclick="moveAutomationAdditionalAction(${step.id},-1)" aria-label="Schritt ${number} nach oben" title="Nach oben"><span class="mdi mdi-arrow-up" aria-hidden="true"></span></button>`:'<span class="automation-extra-action-move-spacer" aria-hidden="true"></span>';
    const moveDown=index<automationAdditionalActions.length-1?`<button class="automation-extra-action-move" type="button" onclick="moveAutomationAdditionalAction(${step.id},1)" aria-label="Schritt ${number} nach unten" title="Nach unten"><span class="mdi mdi-arrow-down" aria-hidden="true"></span></button>`:'<span class="automation-extra-action-move-spacer" aria-hidden="true"></span>';
    const canRemove=wait||actionCount>1;
    const remove=`<button class="automation-extra-action-remove" type="button" onclick="removeAutomationAdditionalAction(${step.id})" aria-label="Schritt ${number} entfernen" title="${canRemove?'Schritt entfernen':'Mindestens eine Aktion ist erforderlich'}" ${canRemove?'':'disabled'}><span class="mdi mdi-close" aria-hidden="true"></span></button>`;
    const body=wait?`<label class="automation-action-value-field"><span>Wartezeit in Sekunden</span><input id="automationExtraWaitValue-${step.id}" type="number" inputmode="numeric" min="1" max="86400" step="1" value="${automationNormalizeSeconds(step.value)}" onchange="changeAutomationAdditionalWaitValue(${step.id},this.value)" aria-label="Wartezeit für Schritt ${number}"></label>`:`<div class="automation-device-field"><label for="automationExtraActionDevice-${step.id}">Ziel</label><div class="automation-device-picker"><div class="search automation-device-search"><span class="mdi mdi-magnify" aria-hidden="true"></span><input id="automationExtraActionSearch-${step.id}" type="search" value="${escapeHtml(step.query||'')}" placeholder="Gerät oder SALTA-Funktion suchen …" autocomplete="off" oninput="searchAutomationAdditionalAction(${step.id},this.value)" aria-label="Ziel für Schritt ${number} suchen"></div><select id="automationExtraActionDevice-${step.id}" onchange="changeAutomationAdditionalActionDevice(${step.id},this.value)"></select><small id="automationExtraActionCount-${step.id}" class="automation-device-match-count" aria-live="polite"></small></div></div><label>Aktion<select id="automationExtraAction-${step.id}" onchange="changeAutomationAdditionalAction(${step.id},this.value)"></select></label><label id="automationExtraActionValueField-${step.id}" class="automation-action-value-field" hidden><span>${step.action==='turnOnForSeconds'?'Sekunden':'Solltemperatur'}</span><input id="automationExtraActionValue-${step.id}" type="number" inputmode="decimal" min="${step.action==='turnOnForSeconds'?1:4.5}" max="${step.action==='turnOnForSeconds'?86400:30}" step="${step.action==='turnOnForSeconds'?1:0.5}" value="${step.value??(step.action==='turnOnForSeconds'?10:21)}" onchange="changeAutomationAdditionalActionValue(${step.id},this.value)" aria-label="Wert für Schritt ${number}"></label>`;
    return `<article class="automation-extra-action ${step.expanded?'expanded':''} ${wait?'automation-wait-step':''}" data-action-id="${step.id}"><div class="automation-extra-action-head"><button class="automation-extra-action-summary" type="button" onclick="toggleAutomationAdditionalAction(${step.id})" aria-expanded="${step.expanded}"><span class="automation-step-number">${number}</span><span><small>${wait?'Wartezeit':'Aktion'}</small><strong>${escapeHtml(summary)}</strong></span><span class="mdi ${step.expanded?'mdi-chevron-up':'mdi-chevron-down'}" aria-hidden="true"></span></button>${moveUp}${moveDown}${remove}</div><div class="automation-extra-action-body" ${step.expanded?'':'hidden'}>${body}</div></article>`;
  }).join('');
  for(const step of automationAdditionalActions){
    if(step.action==='wait'){step.value=automationNormalizeSeconds(step.value);continue}
    const deviceSelect=document.getElementById(`automationExtraActionDevice-${step.id}`);const actionSelect=document.getElementById(`automationExtraAction-${step.id}`);if(!deviceSelect||!actionSelect)continue;
    const candidates=automationActionDevices().filter(device=>automationTargetDeviceAllowed(device));const count=document.getElementById(`automationExtraActionCount-${step.id}`);
    fillAutomationSelect(deviceSelect,candidates,step.deviceId,'Ziel wählen',step.query||'',count);
    if(!deviceSelect.value&&candidates.length)deviceSelect.value=candidates[0].id;
    step.deviceId=deviceSelect.value;fillAutomationActionSelectElement(actionSelect,step.deviceId,step.action);step.action=actionSelect.value;
    const valueField=document.getElementById(`automationExtraActionValueField-${step.id}`);const valueInput=document.getElementById(`automationExtraActionValue-${step.id}`);
    const needsTemperature=step.action==='setTargetTemperature';const needsSeconds=step.action==='turnOnForSeconds';const needsValue=needsTemperature||needsSeconds;if(valueField)valueField.hidden=!needsValue;
    if(needsTemperature&&valueInput){const device=automationDeviceById(step.deviceId);const range=automationThermostatRange(device);step.value=automationNormalizeTemperature(device,step.value);valueInput.min=String(range.min);valueInput.max=String(range.max);valueInput.step=String(range.step);valueInput.value=String(step.value)}
    else if(needsSeconds&&valueInput){step.value=automationNormalizeSeconds(step.value);valueInput.min='1';valueInput.max='86400';valueInput.step='1';valueInput.value=String(step.value)}
    else step.value=undefined;
  }
  refreshAutomationAddActionAvailability();
}
function addAutomationAdditionalAction(){
  if(automationAdditionalActions.length>=8){notify('Maximal acht Schritte pro Automation.',true);return}
  const candidates=automationActionDevices().filter(device=>automationTargetDeviceAllowed(device));const first=candidates[0];
  if(!first){notify('Kein weiteres geeignetes Ziel verfügbar.',true);return}
  const action=automationActionsForTargetDevice(first.id)[0]||'';automationAdditionalActions.push({id:++automationAdditionalActionSequence,deviceId:first.id,action,value:action==='setTargetTemperature'?automationDefaultTargetTemperature(first):action==='turnOnForSeconds'?10:undefined,query:'',expanded:true});renderAutomationAdditionalActions();
}
function addAutomationWaitStep(){if(automationAdditionalActions.length>=8){notify('Maximal acht Schritte pro Automation.',true);return}automationAdditionalActions.push({id:++automationAdditionalActionSequence,action:'wait',value:30,expanded:true});renderAutomationAdditionalActions()}
function removeAutomationAdditionalAction(id){const step=automationAdditionalActions.find(item=>item.id===id);if(!step)return;if(step.action!=='wait'&&automationActionStepCount()<=1){notify('Mindestens eine Aktion muss in „Dann“ erhalten bleiben.',true);return}automationAdditionalActions=automationAdditionalActions.filter(item=>item.id!==id);updateAutomationFormOptions()}
function moveAutomationAdditionalAction(id,delta){const index=automationAdditionalActions.findIndex(step=>step.id===id);const target=index+Number(delta);if(index<0||target<0||target>=automationAdditionalActions.length)return;const [step]=automationAdditionalActions.splice(index,1);automationAdditionalActions.splice(target,0,step);renderAutomationAdditionalActions()}
function toggleAutomationAdditionalAction(id){const step=automationAdditionalActions.find(item=>item.id===id);if(!step)return;step.expanded=!step.expanded;renderAutomationAdditionalActions()}
function searchAutomationAdditionalAction(id,query){const step=automationAdditionalActions.find(item=>item.id===id);if(!step||step.action==='wait')return;step.query=query;const candidates=automationActionDevices().filter(device=>automationTargetDeviceAllowed(device));const select=document.getElementById(`automationExtraActionDevice-${id}`);const count=document.getElementById(`automationExtraActionCount-${id}`);if(select)fillAutomationSelect(select,candidates,step.deviceId,'Ziel wählen',query,count)}
function changeAutomationAdditionalActionDevice(id,deviceId){const step=automationAdditionalActions.find(item=>item.id===id);if(!step||step.action==='wait')return;step.deviceId=deviceId;step.query='';step.action=automationActionsForTargetDevice(deviceId)[0]||'';step.value=step.action==='setTargetTemperature'?automationDefaultTargetTemperature(automationDeviceById(deviceId)):step.action==='turnOnForSeconds'?10:undefined;updateAutomationFormOptions()}
function changeAutomationAdditionalAction(id,action){const step=automationAdditionalActions.find(item=>item.id===id);if(!step||step.action==='wait')return;step.action=action;step.value=action==='setTargetTemperature'?automationNormalizeTemperature(automationDeviceById(step.deviceId),step.value):action==='turnOnForSeconds'?automationNormalizeSeconds(step.value):undefined;renderAutomationAdditionalActions()}
function changeAutomationAdditionalActionValue(id,value){const step=automationAdditionalActions.find(item=>item.id===id);if(!step||step.action==='wait')return;step.value=step.action==='turnOnForSeconds'?automationNormalizeSeconds(value):automationNormalizeTemperature(automationDeviceById(step.deviceId),value);renderAutomationAdditionalActions()}
function changeAutomationAdditionalWaitValue(id,value){const step=automationAdditionalActions.find(item=>item.id===id);if(!step||step.action!=='wait')return;step.value=automationNormalizeSeconds(value);renderAutomationAdditionalActions()}
function automationActionSequencePayload(){return automationAdditionalActions.map(step=>step.action==='wait'?{action:'wait',value:automationNormalizeSeconds(step.value)}:{deviceId:step.deviceId,action:step.action,...(step.action==='setTargetTemperature'?{value:automationNormalizeTemperature(automationDeviceById(step.deviceId),step.value)}:step.action==='turnOnForSeconds'?{value:automationNormalizeSeconds(step.value)}:{})})}
function automationLegacyPrimaryAction(){return automationActionSequencePayload().find(step=>step.action!=='wait')}
function automationLegacyAdditionalActions(){const payload=automationActionSequencePayload();const primaryIndex=payload.findIndex(step=>step.action!=='wait');return primaryIndex<0?[]:payload.filter((_step,index)=>index!==primaryIndex)}


function automationRoomById(id){return rooms.find(room=>room.id===id)}
function fillAutomationRoomSelect(selected=''){
  const current=selected||automationElements.room?.value||'';
  const options=['<option value="">Keinem Raum zugeordnet</option>',...rooms.map(room=>`<option value="${escapeHtml(room.id)}" data-i18n-skip${room.id===current?' selected':''}>${escapeHtml(room.name)}</option>`)]
  if(automationElements.room){automationElements.room.innerHTML=options.join('');automationElements.room.value=rooms.some(room=>room.id===current)?current:''}
}
function automationWeekdayInputs(){return [...document.querySelectorAll('input[name="automationWeekday"]')]}
function automationSelectedExecutionDays(){return automationWeekdayInputs().filter(input=>input.checked).map(input=>Number(input.value)).filter(day=>Number.isInteger(day)&&day>=1&&day<=7)}
function syncAutomationWeekendToggle(){
  if(!automationElements.weekendEnabled)return;const weekend=automationWeekdayInputs().filter(input=>input.value==='6'||input.value==='7');const selected=weekend.filter(input=>input.checked).length;automationElements.weekendEnabled.checked=selected===2;automationElements.weekendEnabled.indeterminate=selected===1;
}
function setAutomationExecutionDays(days){
  const selected=new Set(Array.isArray(days)&&days.length?days:automationAllExecutionDays);for(const input of automationWeekdayInputs())input.checked=selected.has(Number(input.value));syncAutomationWeekendToggle();
}
function automationScheduleRestricted(rule){const days=Array.isArray(rule?.executionDays)&&rule.executionDays.length?rule.executionDays:automationAllExecutionDays;return days.length!==7||automationAllExecutionDays.some(day=>!days.includes(day))}
function automationScheduleSummary(rule){if(!automationScheduleRestricted(rule))return null;const labels=automationLocale().startsWith('en')?automationWeekdayLabelsEn:automationWeekdayLabelsDe;const days=(rule.executionDays||[]).filter(day=>labels[day]);return `Ausführung: ${days.map(day=>labels[day]).join(', ')}`}
function automationLastEventLabel(value,now=new Date()){
  if(!value)return 'Letztes Event: noch nicht ausgeführt';
  const eventDate=new Date(value);if(Number.isNaN(eventDate.getTime()))return 'Letztes Event: unbekannt';
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const eventDay=new Date(eventDate.getFullYear(),eventDate.getMonth(),eventDate.getDate());
  const days=Math.max(0,Math.round((today.getTime()-eventDay.getTime())/86400000));
  const dayLabel=days===0?'Heute':days===1?'Gestern':`vor ${days} Tagen`;
  const time=eventDate.toLocaleTimeString(automationLocale(),{hour:'2-digit',minute:'2-digit'});
  return `Letztes Event: ${dayLabel} · ${time} Uhr`;
}
function automationTriggerSummaryItems(rule){
  if(rule.triggerType==='time')return [`${automationScheduleRestricted(rule)?'Uhrzeit':'Täglich'} · ${rule.triggerTime||'–'} Uhr`];
  const definitions=[{deviceId:rule.triggerDeviceId,stateKey:rule.triggerStateKey,value:rule.triggerValue},...(rule.additionalTriggers||[])];
  const groups=[];const eventGroups=new Map();
  for(const definition of definitions){
    const device=automationDeviceById(definition.deviceId);const name=device?.name||'Unbekannt';const event=automationParseStoredEventTrigger(definition.stateKey);const held=automationParseStoredHeldTrigger(definition.stateKey);
    if(event){
      const key=String(definition.deviceId||'');let group=eventGroups.get(key);
      if(!group){group={kind:'event',name,values:[]};eventGroups.set(key,group);groups.push(group)}
      if(!group.values.includes(event.value))group.values.push(event.value);
      continue;
    }
    groups.push({kind:'state',name,stateKey:held?.key??definition.stateKey,value:held?.seconds===10&&definition.value===false?automationHeldContactClosed10Value:definition.value});
  }
  return groups.map(group=>group.kind==='event'?`${group.name} · ${group.values.map(automationButtonEventLabel).join(' / ')}`:`${group.name} · ${automationStateLabel(group.stateKey)} = ${automationValueLabel(group.stateKey,group.value)}`);
}
function automationActionSummaryItems(rule){return ((Array.isArray(rule.sequence)&&rule.sequence.length)?rule.sequence:[{deviceId:rule.actionDeviceId,action:rule.action,value:rule.actionValue},...(rule.additionalActions||[])]).map(step=>step?.action==='wait'?`Warten · ${automationNormalizeSeconds(step.value).toLocaleString(automationLocale())} s`:(()=>{const device=automationDeviceById(step.deviceId);const valueLabel=automationActionValueLabel(step);return `${device?.name||'Unbekannt'} → ${automationActionLabels[step.action]||step.action}${valueLabel?` · ${valueLabel}`:''}`})())}
function automationConditionSummaryItems(rule){
  const conditions=rule.conditionDeviceId?[{deviceId:rule.conditionDeviceId,stateKey:rule.conditionStateKey,value:rule.conditionValue},...(rule.additionalConditions||[])]:[];
  return conditions.map(condition=>{const device=automationDeviceById(condition.deviceId);if(!device)return 'Unbekannte Bedingung';return automationIsClimateModeDevice(device)?`Heizmodus = ${automationValueLabel(condition.stateKey,condition.value)}`:automationIsVacationModeDevice(device)?`Urlaubsmodus = ${automationValueLabel(condition.stateKey,condition.value)}`:`${device.name} · ${automationStateLabel(condition.stateKey)} = ${automationValueLabel(condition.stateKey,condition.value)}`});
}
function automationSummary(rule){
  const triggerItems=automationTriggerSummaryItems(rule);const conditionItems=automationConditionSummaryItems(rule);const actionItems=automationActionSummaryItems(rule);
  const triggerText=`Wenn ${triggerItems.join(' ODER ')}`;
  const scheduleText=automationScheduleSummary(rule);
  const conditionText=conditionItems.length?`Nur wenn ${conditionItems.join(' UND ')}`:null;
  const actionText=`Dann ${actionItems.join(' → ')}`;
  return {triggerItems,triggerText,scheduleText,conditionItems,conditionText,actionItems,actionText};
}
function automationTriggerSummaryMarkup(items){return items.map((item,index)=>`${index?'<span class="automation-or-separator">ODER</span>':''}<span class="automation-trigger-chip">${escapeHtml(item)}</span>`).join('')}
function automationActionSummaryMarkup(items){return items.map((item,index)=>`${index?'<span class="automation-and-separator">→</span>':''}<span class="automation-action-chip">${escapeHtml(item)}</span>`).join('')}
function automationRoomGroups(){
  const groups=rooms.map(room=>({room,rules:automationRules.filter(rule=>rule.roomId===room.id)})).filter(group=>group.rules.length);
  const unassigned=automationRules.filter(rule=>!automationRoomById(rule.roomId));
  if(unassigned.length)groups.push({room:null,rules:unassigned});
  return groups;
}
function renderAutomations(){
  automationElements.count.textContent=automationRules.length;
  if(!automationRules.length){automationElements.list.innerHTML='<div class="empty-state compact"><h3>Noch keine Automationen</h3><p class="muted">Lege über „Neue Automation“ deine erste lokale Regel an.</p><button type="button" onclick="openAutomationEditor()"><span class="mdi mdi-plus" aria-hidden="true"></span>Neue Automation</button></div>';return}
  automationElements.list.innerHTML=automationRoomGroups().map(group=>{const room=group.room;const title=room?.name||'Ohne Raum';return `<section class="automation-room-group"><div class="automation-room-group-head"><span class="automation-room-group-icon">${iconMarkup(room?.icon||'home-outline')}</span><h2 ${room?'data-i18n-skip':''}>${escapeHtml(title)}</h2><span class="automation-room-group-count">${group.rules.length}</span></div><div class="automation-room-group-items">${group.rules.map(rule=>{const summary=automationSummary(rule);const room=automationRoomById(rule.roomId);return `<article class="automation-card ${rule.enabled?'':'disabled'}"><div class="automation-card-head"><div class="automation-card-title"><h3>${escapeHtml(rule.name)}</h3><div class="automation-card-meta"><span>${rule.enabled?'Aktiv':'Deaktiviert'}</span>${room?`<span class="automation-room-badge">${iconMarkup(room.icon||'home-outline')} ${escapeHtml(room.name)}</span>`:''}<span class="automation-last-event">${escapeHtml(automationLastEventLabel(rule.lastTriggeredAt).replace('Letztes Event: ',''))}</span></div></div><div class="automation-card-controls"><label class="automation-switch" title="Automation ${rule.enabled?'deaktivieren':'aktivieren'}"><input type="checkbox" ${rule.enabled?'checked':''} onchange="toggleAutomation('${rule.id}',this.checked)"><span aria-hidden="true"></span></label><button class="automation-card-icon-action secondary" type="button" onclick="triggerAutomation('${rule.id}')" aria-label="Automation manuell auslösen" title="Jetzt auslösen">${iconMarkup('play-outline')}</button><button class="automation-card-icon-action secondary" type="button" onclick="duplicateAutomation('${rule.id}')" aria-label="Automation duplizieren" title="Duplizieren">${iconMarkup('content-copy')}</button><button class="automation-card-icon-action secondary" type="button" onclick="copyAutomationWorkflow('${rule.id}')" aria-label="Automation-Workflow in die Zwischenablage kopieren" title="Workflow kopieren">${iconMarkup('clipboard-text-outline')}</button><button class="automation-card-icon-action secondary" type="button" onclick="editAutomation('${rule.id}')" aria-label="Automation bearbeiten" title="Bearbeiten">${iconMarkup('pencil-outline')}</button><button class="automation-card-icon-action danger" type="button" onclick="deleteAutomation('${rule.id}')" aria-label="Automation löschen" title="Löschen">${iconMarkup('delete-outline')}</button></div></div><div class="automation-flow"><div class="automation-trigger-flow"><span class="automation-step-icon">${iconMarkup('flash-outline')}</span><strong class="automation-flow-label">Wenn</strong><div class="automation-trigger-list">${automationTriggerSummaryMarkup(summary.triggerItems)}</div></div>${summary.scheduleText?`<div><span class="automation-step-icon">${iconMarkup('calendar-week')}</span><p>${escapeHtml(summary.scheduleText)}</p></div>`:''}${summary.conditionText?`<div><span class="automation-step-icon">${iconMarkup('filter-outline')}</span><p>${escapeHtml(summary.conditionText)}</p></div>`:''}<div class="automation-action-flow"><span class="automation-step-icon">${iconMarkup('arrow-right-bold-outline')}</span><strong class="automation-flow-label">Dann</strong><div class="automation-action-list">${automationActionSummaryMarkup(summary.actionItems)}</div></div></div></article>`}).join('')}</div></section>`}).join('');
}
async function loadAutomations(){const payload=await api('/api/automations');automationRules=payload?.automations||[];fillAutomationRoomSelect();renderAutomations();updateAutomationFormOptions()}
function resetAutomationForm(){editingAutomationId=null;automationAdditionalTriggers=[];automationAdditionalConditions=[];automationAdditionalActions=[];automationPrimaryEventValues=[];automationElements.form.reset();clearAutomationDeviceSearches();fillAutomationRoomSelect('');automationElements.enabled.checked=true;automationElements.scheduleEnabled.checked=false;automationElements.scheduleFields.hidden=true;setAutomationExecutionDays(automationAllExecutionDays);automationElements.conditionEnabled.checked=false;automationElements.conditionFields.hidden=true;automationElements.title.textContent='Neue Automation';automationElements.save.textContent='Automation speichern';automationElements.cancel.hidden=false;const first=automationActionDevices().find(device=>automationTargetDeviceAllowed(device));if(first){const action=automationActionsForTargetDevice(first.id)[0]||'';automationAdditionalActions=[{id:++automationAdditionalActionSequence,deviceId:first.id,action,value:action==='setTargetTemperature'?automationDefaultTargetTemperature(first):action==='turnOnForSeconds'?10:undefined,query:'',expanded:true}]}updateAutomationFormOptions()}
function automationNavigateToEditor(){if(location.hash!=='#automation-editor')location.hash='automation-editor';else if(typeof showPage==='function')showPage('automation-editor')}
function openAutomationEditor(){resetAutomationForm();automationNavigateToEditor();setTimeout(()=>automationElements.name?.focus(),0)}
function cancelAutomationEdit(){resetAutomationForm();location.hash='automations'}
function editAutomation(id){
  clearAutomationDeviceSearches();const rule=automationRules.find(item=>item.id===id);if(!rule)return;editingAutomationId=id;const primaryEvent=automationParseStoredEventTrigger(rule.triggerStateKey);const primaryEventValues=primaryEvent?[primaryEvent.value]:[];const visibleAdditional=[];for(const trigger of (rule.additionalTriggers||[])){const event=automationParseStoredEventTrigger(trigger.stateKey);if(primaryEvent&&trigger.deviceId===rule.triggerDeviceId&&event){primaryEventValues.push(event.value)}else visibleAdditional.push(trigger)}automationAdditionalTriggers=automationStoredAdditionalTriggers(visibleAdditional);automationAdditionalConditions=automationStoredAdditionalConditions(rule.additionalConditions||[]);automationAdditionalActions=automationStoredSequence(rule);automationPrimaryEventValues=[];automationSetPrimaryEventValues(primaryEventValues);automationElements.title.textContent='Automation bearbeiten';automationElements.save.textContent='Änderungen speichern';automationElements.cancel.hidden=false;automationElements.name.value=rule.name;fillAutomationRoomSelect(rule.roomId||'');automationElements.enabled.checked=rule.enabled;const restrictedDays=automationScheduleRestricted(rule);automationElements.scheduleEnabled.checked=restrictedDays;automationElements.scheduleFields.hidden=!restrictedDays;setAutomationExecutionDays(rule.executionDays);automationElements.conditionEnabled.checked=Boolean(rule.conditionDeviceId);automationElements.conditionFields.hidden=!rule.conditionDeviceId;updateAutomationFormOptions(rule);automationNavigateToEditor();setTimeout(()=>automationElements.name?.focus(),0);
}
function automationPayload(){
  const useCondition=automationElements.conditionEnabled.checked;const timeTrigger=automationTimeTriggerActive();const eventTrigger=!timeTrigger&&automationElements.triggerState.value===automationButtonEventMarker;
  const eventValues=eventTrigger?(automationPrimaryEventValues.length?automationPrimaryEventValues:[Number(automationElements.triggerValue.value)]):[];
  const eventValue=eventValues[0];const sameDeviceEventTriggers=eventValues.slice(1).map(value=>({deviceId:automationElements.triggerDevice.value,stateKey:`event:buttonEvent:${value}`,value:true}));
  const sequence=automationActionSequencePayload();const primary=sequence.find(step=>step.action!=='wait');
  if(!primary||primary.action==='wait')throw new Error('AUTOMATION_ACTION_REQUIRED');
  const primaryDevice=automationDeviceById(primary.deviceId);
  const primaryValue=primary.action==='setTargetTemperature'?automationNormalizeTemperature(primaryDevice,primary.value):primary.action==='turnOnForSeconds'?automationNormalizeSeconds(primary.value):undefined;
  const additionalActions=automationLegacyAdditionalActions();
  return {name:automationElements.name.value.trim(),enabled:automationElements.enabled.checked,roomId:automationElements.room?.value||null,executionDays:automationElements.scheduleEnabled.checked?automationSelectedExecutionDays():automationAllExecutionDays,triggerType:timeTrigger?'time':'device',...(timeTrigger?{triggerTime:automationElements.triggerTime.value}:{triggerDeviceId:automationElements.triggerDevice.value,triggerStateKey:eventTrigger?`event:buttonEvent:${eventValue}`:automationStoredTriggerStateKey(automationElements.triggerDevice.value,automationElements.triggerState.value,automationElements.triggerValue.value),triggerValue:eventTrigger?true:automationTriggerBooleanValue(automationElements.triggerValue.value)}),additionalTriggers:timeTrigger?[]:[...sameDeviceEventTriggers,...automationAdditionalTriggerPayload()],conditionDeviceId:useCondition?automationElements.conditionDevice.value:null,conditionStateKey:useCondition?automationElements.conditionState.value:null,conditionValue:useCondition?automationElements.conditionValue.value==='true':null,additionalConditions:useCondition?automationAdditionalConditionPayload():[],actionDeviceId:primary.deviceId,action:primary.action,...(primaryValue!==undefined?{actionValue:primaryValue}:{}),additionalActions,sequence};
}

function friendlyAutomationError(error){const messages={AUTOMATION_MANUAL_TRIGGER_FAILED:'Automation konnte nicht manuell ausgelöst werden.',AUTOMATION_ROOM_NOT_FOUND:'Der ausgewählte Raum existiert nicht mehr.',AUTOMATION_CYCLE_NOT_ALLOWED:'Diese Regel würde einen Schaltkreis zwischen Automationen erzeugen. Zyklische Regeln sind nicht erlaubt.',AUTOMATION_TRIGGER_ACTION_SAME_DEVICE:'Trigger- und Zielgerät müssen unterschiedlich sein. Ausnahme: Ein virtueller Schalter darf sich mit An → Aus bzw. Aus → An selbst zurücksetzen.',AUTOMATION_CONDITION_TRIGGER_SAME_DEVICE:'Das Bedingungsgerät muss sich vom Triggergerät unterscheiden.',AUTOMATION_TRIGGER_STATE_UNSUPPORTED:'Der ausgewählte Triggerzustand ist für dieses Gerät nicht verfügbar.',AUTOMATION_TRIGGER_EVENT_UNSUPPORTED:'Das ausgewählte Tasterereignis ist für dieses Gerät nicht verfügbar.',AUTOMATION_TRIGGER_LIMIT:'Maximal acht ODER-Auslöser sind pro Automation möglich.',AUTOMATION_TRIGGER_DUPLICATE:'Derselbe Auslöser ist mehrfach eingetragen.',AUTOMATION_TRIGGER_TIME_INVALID:'Bitte eine gültige Uhrzeit im Format HH:MM auswählen.',AUTOMATION_EXECUTION_DAYS_REQUIRED:'Bitte mindestens einen Ausführungstag auswählen.',AUTOMATION_TIME_TRIGGER_OR_NOT_SUPPORTED:'Ein Uhrzeittrigger kann in dieser Version nicht mit zusätzlichen ODER-Gerätetriggern kombiniert werden.',AUTOMATION_CONDITION_STATE_UNSUPPORTED:'Der ausgewählte Bedingungszustand ist für dieses Gerät nicht verfügbar.',AUTOMATION_CONDITION_LIMIT:'Maximal acht UND-Bedingungen sind pro Automation möglich.',AUTOMATION_CONDITION_DUPLICATE:'Dieselbe UND-Bedingung ist mehrfach eingetragen.',AUTOMATION_ACTION_LIMIT:'Maximal acht Schritte sind pro Automation möglich.',AUTOMATION_ACTION_REQUIRED:'Mindestens eine Aktion ist im Dann-Ablauf erforderlich.',AUTOMATION_WAIT_INVALID:'Wartezeiten müssen ganze Sekunden zwischen 1 und 86400 sein.',AUTOMATION_SYSTEM_ACTION_UNAVAILABLE:'Die SALTA-Systemaktion Heizmodus ist derzeit nicht verfügbar.',AUTOMATION_ACTION_UNSUPPORTED:'Das ausgewählte Ziel unterstützt diese Aktion nicht.',AUTOMATION_ACTION_TEMPERATURE_INVALID:'Die Solltemperatur liegt außerhalb des unterstützten Bereichs dieses Thermostats.',AUTOMATION_ACTION_TIMER_INVALID:'Für „An für Sekunden“ sind bei Shelly-Schaltausgängen ganze Sekunden von 1 bis 86400 erlaubt.'};return messages[error?.code]||error?.message||'Automation konnte nicht gespeichert werden.'}
async function saveAutomation(){if(automationElements.scheduleEnabled.checked&&!automationSelectedExecutionDays().length){notify('Bitte mindestens einen Ausführungstag auswählen.',true);return}const payload=automationPayload();const wasEditing=Boolean(editingAutomationId);const method=wasEditing?'PUT':'POST';const url=wasEditing?`/api/automations/${editingAutomationId}`:'/api/automations';const original=automationElements.save.innerHTML;automationElements.save.disabled=true;automationElements.save.textContent='Wird gespeichert …';try{await api(url,{method,headers:{'content-type':'application/json'},body:JSON.stringify(payload)});await loadAutomations();resetAutomationForm();location.hash='automations';notify(wasEditing?'Automation wurde aktualisiert.':'Automation wurde angelegt.')}catch(error){notify(friendlyAutomationError(error),true)}finally{automationElements.save.disabled=false;automationElements.save.innerHTML=original}}
function automationDuplicatePayload(rule){const suffix=automationLocale().toLowerCase().startsWith('en')?'Copy':'Kopie';const sequence=(Array.isArray(rule?.sequence)&&rule.sequence.length?rule.sequence:[{deviceId:rule?.actionDeviceId,action:rule?.action,value:rule?.actionValue},...(rule?.additionalActions||[])]).filter(Boolean).map(step=>step.action==='wait'?{action:'wait',value:Number(step.value)}:{deviceId:step.deviceId,action:step.action,...(step.value!==undefined?{value:Number(step.value)}:{})});const payload={name:`${rule.name} (${suffix})`,enabled:false,roomId:rule.roomId??null,executionDays:Array.isArray(rule.executionDays)&&rule.executionDays.length?[...rule.executionDays]:[...automationAllExecutionDays],triggerType:rule.triggerType==='time'?'time':'device',additionalTriggers:(rule.additionalTriggers||[]).map(item=>({...item})),conditionDeviceId:rule.conditionDeviceId??null,conditionStateKey:rule.conditionStateKey??null,conditionValue:typeof rule.conditionValue==='boolean'?rule.conditionValue:null,additionalConditions:(rule.additionalConditions||[]).map(item=>({...item})),actionDeviceId:rule.actionDeviceId,action:rule.action,...(rule.actionValue!==undefined?{actionValue:Number(rule.actionValue)}:{}),sequence};if(payload.triggerType==='time')payload.triggerTime=rule.triggerTime;else{payload.triggerDeviceId=rule.triggerDeviceId;payload.triggerStateKey=rule.triggerStateKey;payload.triggerValue=rule.triggerValue}return payload}

const automationDiagnosticAdapterKeys=['interfaceName','channelAddress','channelType','targetTemperatureParameter','targetTemperatureValueType','targetTemperatureMin','targetTemperatureMax','targetTemperatureStep','thermostatOffTemperature','autoModeParameter','autoModeValueType','manualModeParameter','manualModeValueType','modeParameter','modeValueType','modeAutoValue','modeManualValue','modeOffValue'];
function automationCanonicalSequence(rule){return ((Array.isArray(rule?.sequence)&&rule.sequence.length)?rule.sequence:[{deviceId:rule?.actionDeviceId,action:rule?.action,value:rule?.actionValue},...(rule?.additionalActions||[])]).filter(Boolean).map((step,index)=>step.action==='wait'?{step:index+1,action:'wait',seconds:Number(step.value)}:{step:index+1,deviceId:String(step.deviceId||''),action:String(step.action||''),...(step.value!==undefined?{value:Number(step.value)}:{})})}
function automationDiagnosticDevice(device){if(!device)return null;const adapterData={};for(const key of automationDiagnosticAdapterKeys){const value=device.adapterData?.[key];if(value!==undefined)adapterData[key]=value}return {id:device.id,name:device.name,source:device.source,type:device.type,model:device.model??null,room:device.room??null,reachable:Boolean(device.reachable),capabilities:[...(device.capabilities||[])],state:{...(device.state||{})},adapterData}}
function automationWorkflowDiagnostic(rule){
  const triggers=rule.triggerType==='time'?[]:[{deviceId:rule.triggerDeviceId,stateKey:rule.triggerStateKey,value:rule.triggerValue},...(rule.additionalTriggers||[])];
  const conditions=rule.conditionDeviceId?[{deviceId:rule.conditionDeviceId,stateKey:rule.conditionStateKey,value:rule.conditionValue},...(rule.additionalConditions||[])]:[];
  const sequence=automationCanonicalSequence(rule);
  const deviceIds=[...new Set([...triggers.map(item=>item.deviceId),...conditions.map(item=>item.deviceId),...sequence.filter(step=>step.action!=='wait').map(step=>step.deviceId)].filter(Boolean))];
  return {format:'salta-automation-workflow-diagnostic',formatVersion:1,exportedAt:new Date().toISOString(),workflow:{id:rule.id,name:rule.name,enabled:Boolean(rule.enabled),roomId:rule.roomId??null,triggerType:rule.triggerType==='time'?'time':'device',triggerTime:rule.triggerTime??null,executionDays:Array.isArray(rule.executionDays)?[...rule.executionDays]:[],triggers,conditions,sequence,lastTriggeredAt:rule.lastTriggeredAt??null,summary:automationSummary(rule)},devices:deviceIds.map(id=>automationDiagnosticDevice(automationDeviceById(id))||{id,name:'Unbekannt',missing:true})};
}
async function automationWriteClipboard(text){if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return true}catch{}}const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.focus();area.select();let copied=false;try{copied=document.execCommand('copy')}catch{copied=false}area.remove();return copied}
async function copyAutomationWorkflow(id){const rule=automationRules.find(item=>item.id===id);if(!rule)return;const copied=await automationWriteClipboard(JSON.stringify(automationWorkflowDiagnostic(rule),null,2));notify(copied?'Automation-Workflow wurde in die Zwischenablage kopiert.':'Zwischenablage konnte nicht beschrieben werden.',!copied)}
async function copyAllAutomationWorkflows(){if(!automationRules.length){notify('Es sind keine Automationsworkflows zum Kopieren vorhanden.',true);return}const payload={format:'salta-automation-workflows-diagnostic',formatVersion:1,exportedAt:new Date().toISOString(),automationCount:automationRules.length,automations:automationRules.map(automationWorkflowDiagnostic)};const copied=await automationWriteClipboard(JSON.stringify(payload,null,2));notify(copied?'Automationsworkflows wurden in die Zwischenablage kopiert.':'Zwischenablage konnte nicht beschrieben werden.',!copied)}

async function triggerAutomation(id){const rule=automationRules.find(item=>item.id===id);if(!rule)return;try{await api(`/api/automations/${id}/trigger`,{method:'POST'});notify('Automation wurde manuell ausgelöst.');setTimeout(()=>loadAutomations().catch(()=>undefined),250)}catch(error){notify(friendlyAutomationError(error),true)}}
async function duplicateAutomation(id){const rule=automationRules.find(item=>item.id===id);if(!rule)return;try{await api('/api/automations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(automationDuplicatePayload(rule))});await loadAutomations();notify('Automation wurde dupliziert und deaktiviert angelegt.')}catch(error){notify(friendlyAutomationError(error),true)}}
async function toggleAutomation(id,enabled){try{await api(`/api/automations/${id}/enabled`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({enabled})});await loadAutomations();notify(enabled?'Automation aktiviert.':'Automation deaktiviert.')}catch(error){notify(friendlyAutomationError(error),true);await loadAutomations().catch(()=>undefined)}}
async function deleteAutomation(id){const rule=automationRules.find(item=>item.id===id);if(!rule)return;if(!confirm(`Automation „${rule.name}“ wirklich löschen?`))return;try{await api(`/api/automations/${id}`,{method:'DELETE'});if(editingAutomationId===id)resetAutomationForm();await loadAutomations();notify('Automation wurde gelöscht.')}catch(error){notify(friendlyAutomationError(error),true)}}

function automationDevicesChanged(){fillAutomationRoomSelect();updateAutomationFormOptions();renderAutomations()}

automationElements.scheduleEnabled?.addEventListener('change',()=>{automationElements.scheduleFields.hidden=!automationElements.scheduleEnabled.checked;if(automationElements.scheduleEnabled.checked&&!automationSelectedExecutionDays().length)setAutomationExecutionDays(automationAllExecutionDays)});
automationElements.weekendEnabled?.addEventListener('change',()=>{for(const input of automationWeekdayInputs().filter(input=>input.value==='6'||input.value==='7'))input.checked=automationElements.weekendEnabled.checked;automationElements.weekendEnabled.indeterminate=false});
for(const input of automationWeekdayInputs())input.addEventListener('change',syncAutomationWeekendToggle);
automationElements.triggerType?.addEventListener('change',()=>{updateAutomationTriggerMode();updateAutomationFormOptions()});
automationElements.triggerSearch?.addEventListener('input',()=>refreshAutomationDeviceSearch('trigger'));
automationElements.conditionSearch?.addEventListener('input',()=>refreshAutomationDeviceSearch('condition'));
automationElements.triggerDevice?.addEventListener('change',()=>{automationPrimaryEventValues=[];if(automationElements.triggerSearch)automationElements.triggerSearch.value='';fillAutomationStateSelect(automationElements.triggerState,automationElements.triggerDevice.value,undefined,true);fillAutomationValueSelect(automationElements.triggerValue,automationElements.triggerState.value,undefined,automationElements.triggerDevice.value);updateAutomationFormOptions()});
automationElements.triggerState?.addEventListener('change',()=>{automationPrimaryEventValues=[];fillAutomationValueSelect(automationElements.triggerValue,automationElements.triggerState.value);renderAutomationPrimaryEventPicker()});
automationElements.conditionEnabled?.addEventListener('change',()=>{automationElements.conditionFields.hidden=!automationElements.conditionEnabled.checked;if(automationElements.conditionEnabled.checked)updateAutomationFormOptions();else refreshAutomationAddConditionAvailability()});
automationElements.conditionDevice?.addEventListener('change',()=>{if(automationElements.conditionSearch)automationElements.conditionSearch.value='';fillAutomationStateSelect(automationElements.conditionState,automationElements.conditionDevice.value,undefined,false);fillAutomationValueSelect(automationElements.conditionValue,automationElements.conditionState.value)});
automationElements.conditionState?.addEventListener('change',()=>fillAutomationValueSelect(automationElements.conditionValue,automationElements.conditionState.value));
automationElements.form?.addEventListener('submit',event=>{event.preventDefault();saveAutomation().catch(error=>notify(friendlyAutomationError(error),true))});
