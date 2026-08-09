let automationRules=[];
let editingAutomationId=null;
let automationAdditionalTriggers=[];
let automationAdditionalTriggerSequence=0;
let automationPrimaryEventValues=[];

const automationElements={
  list:document.getElementById('automationList'),
  count:document.getElementById('automationCount'),
  form:document.getElementById('automationForm'),
  title:document.getElementById('automationFormTitle'),
  name:document.getElementById('automationName'),
  room:document.getElementById('automationRoom'),
  enabled:document.getElementById('automationEnabled'),
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
  actionDevice:document.getElementById('automationActionDevice'),
  actionSearch:document.getElementById('automationActionDeviceSearch'),
  actionCount:document.getElementById('automationActionDeviceCount'),
  action:document.getElementById('automationAction'),
  cancel:document.getElementById('automationCancelButton'),
  save:document.getElementById('automationSaveButton')
};

const automationStatePriority=['on','present','anyHome','nobodyHome','motion','open','water','fire','alarm','vibration','dark','daylight','tampered','lowBattery'];
const automationActionLabels={turnOn:'An',turnOff:'Aus',toggle:'Toggle'};
const automationButtonEventMarker='event:buttonEvent';
const automationCommonButtonEvents=[1000,1001,1002,1003,1004,1005,1006,1007,1010];
const automationModelButtonEvents={
  'lumi.remote.b1acn01':[1002,1004,1001,1003],
  'lumi.sensor_switch.aq2':[1002,1004,1005,1006],
  'lumi.sensor_switch':[1000,1002,1003,1004,1005,1006,1010]
};

function automationBooleanStateKeys(device){
  const keys=Object.entries(device?.state||{}).filter(([,value])=>typeof value==='boolean').map(([key])=>key);
  return keys.sort((a,b)=>{const ai=automationStatePriority.indexOf(a),bi=automationStatePriority.indexOf(b);if(ai>=0||bi>=0){if(ai<0)return 1;if(bi<0)return -1;return ai-bi}return a.localeCompare(b)});
}
function automationEventStateKeys(device){return device&&(device.type==='button'||typeof device.state?.buttonEvent==='number'||device.adapterData?.buttonEventProtocol==='deconz')?['buttonEvent']:[]}
function automationStateLabel(key){return key===automationButtonEventMarker?'Tasterereignis':labels?.[key]||key}
function automationValueLabel(key,value){
  const states={on:['An','Aus'],motion:['Bewegung erkannt','Keine Bewegung'],open:['Offen','Geschlossen'],water:['Wasser erkannt','Trocken'],fire:['Alarm','Normal'],alarm:['Alarm','Normal'],vibration:['Erkannt','Ruhe'],lowBattery:['Niedrig','OK'],tampered:['Erkannt','OK'],dark:['Dunkel','Hell'],daylight:['Tageslicht','Kein Tageslicht'],present:['Anwesend','Abwesend'],anyHome:['Jemand zuhause','Niemand zuhause'],nobodyHome:['Niemand zuhause','Jemand zuhause']};
  const pair=states[key]||['Aktiv','Inaktiv'];
  return value?pair[0]:pair[1];
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
function automationAdditionalEventValues(trigger){
  const device=automationDeviceById(trigger?.deviceId);const allowed=automationButtonEventValues(device);
  const raw=Array.isArray(trigger?.eventValues)?trigger.eventValues:[trigger?.value];
  const unique=[...new Set(raw.map(Number).filter(value=>Number.isSafeInteger(value)&&allowed.includes(value)))];
  return unique.length?unique:[allowed[0]??1000];
}
function automationAdditionalTriggerDefinitionCount(trigger){return trigger?.stateKey===automationButtonEventMarker?Math.max(1,automationAdditionalEventValues(trigger).length):1}
function automationAdditionalDefinitionCount(excludedId=null){return automationAdditionalTriggers.filter(trigger=>trigger.id!==excludedId).reduce((sum,trigger)=>sum+automationAdditionalTriggerDefinitionCount(trigger),0)}
function automationPrimaryTriggerDefinitionCount(){return automationElements.triggerState?.value===automationButtonEventMarker?Math.max(1,automationPrimaryEventValues.length):1}
function automationTotalTriggerDefinitionCount(){return automationPrimaryTriggerDefinitionCount()+automationAdditionalDefinitionCount()}
function automationPrimaryEventCapacity(){return Math.max(1,8-automationAdditionalDefinitionCount())}
function automationAdditionalEventCapacity(id){return Math.max(1,8-automationPrimaryTriggerDefinitionCount()-automationAdditionalDefinitionCount(id))}
function refreshAutomationAddTriggerAvailability(){const triggerLimitReached=automationAdditionalTriggers.length>=7||automationTotalTriggerDefinitionCount()>=8;if(automationElements.addTrigger){automationElements.addTrigger.hidden=triggerLimitReached;automationElements.addTrigger.disabled=triggerLimitReached}}
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
function automationTriggerDevices(){return all.filter(device=>automationBooleanStateKeys(device).length>0||automationEventStateKeys(device).length>0)}
function automationConditionDevices(){return all.filter(device=>automationBooleanStateKeys(device).length>0)}
function automationActionDevices(){return all.filter(device=>['turnOn','turnOff','toggle'].some(action=>device.capabilities?.includes(action)))}
function automationAllTriggerDeviceIds(){return new Set([automationElements.triggerDevice?.value,...automationAdditionalTriggers.map(trigger=>trigger.deviceId)].filter(Boolean))}
function normalizedAutomationSearch(value){return String(value||'').trim().toLocaleLowerCase('de-DE')}
function automationDeviceSearchText(device){return [device.name,device.room,sourceLabels?.[device.source]||device.source,device.model,typeLabels?.[device.type]||device.type].filter(Boolean).join(' ').toLocaleLowerCase('de-DE')}
function automationDeviceMatchesSearch(device,query){const terms=normalizedAutomationSearch(query).split(/\s+/).filter(Boolean);if(!terms.length)return true;const haystack=automationDeviceSearchText(device);return terms.every(term=>haystack.includes(term))}
function sortedAutomationDevices(devices){return [...devices].sort((a,b)=>String(a.room||'ZZZ').localeCompare(String(b.room||'ZZZ'),'de',{sensitivity:'base'})||String(a.name||'').localeCompare(String(b.name||''),'de',{sensitivity:'base'})||String(a.source||'').localeCompare(String(b.source||''),'de',{sensitivity:'base'}))}
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
function clearAutomationDeviceSearches(){for(const input of [automationElements.triggerSearch,automationElements.conditionSearch,automationElements.actionSearch])if(input)input.value=''}
function refreshAutomationDeviceSearch(kind){
  const triggerIds=automationAllTriggerDeviceIds();
  if(kind==='trigger')fillAutomationSelect(automationElements.triggerDevice,automationTriggerDevices(),automationElements.triggerDevice.value,'Triggergerät wählen',automationElements.triggerSearch?.value,automationElements.triggerCount);
  if(kind==='condition')fillAutomationSelect(automationElements.conditionDevice,automationConditionDevices().filter(device=>!triggerIds.has(device.id)),automationElements.conditionDevice.value,'Anderes Bedingungsgerät wählen',automationElements.conditionSearch?.value,automationElements.conditionCount);
  if(kind==='action')fillAutomationSelect(automationElements.actionDevice,automationActionDevices().filter(device=>!triggerIds.has(device.id)),automationElements.actionDevice.value,'Zielgerät wählen',automationElements.actionSearch?.value,automationElements.actionCount);
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
  const current=selected===undefined?true:selected===true||selected==='true';
  select.innerHTML=[true,false].map(value=>`<option value="${value}"${value===current?' selected':''}>${escapeHtml(automationValueLabel(stateKey,value))}</option>`).join('');
}
function fillAutomationActionSelect(selected){
  const device=automationDeviceById(automationElements.actionDevice.value);const actions=['turnOn','turnOff','toggle'].filter(action=>device?.capabilities?.includes(action));
  automationElements.action.innerHTML=actions.length?actions.map(action=>`<option value="${action}"${action===selected?' selected':''}>${automationActionLabels[action]}</option>`).join(''):'<option value="">Keine Schaltaktion verfügbar</option>';
}
function updateAutomationFormOptions(values={}){
  const storedEvent=automationParseStoredEventTrigger(values.triggerStateKey);
  const triggerSelected=values.triggerDeviceId??automationElements.triggerDevice.value;
  fillAutomationSelect(automationElements.triggerDevice,automationTriggerDevices(),triggerSelected,'Triggergerät wählen',automationElements.triggerSearch?.value,automationElements.triggerCount);
  const triggerId=automationElements.triggerDevice.value||triggerSelected;
  const triggerState=storedEvent?automationButtonEventMarker:(values.triggerStateKey??automationElements.triggerState.value);
  fillAutomationStateSelect(automationElements.triggerState,triggerId,triggerState,true);
  const triggerValue=storedEvent?.value??values.triggerValue??automationElements.triggerValue.value;
  fillAutomationValueSelect(automationElements.triggerValue,automationElements.triggerState.value,triggerValue,triggerId);
  if(automationElements.triggerState.value===automationButtonEventMarker&&!automationPrimaryEventValues.length)automationSetPrimaryEventValues([Number(triggerValue)]);
  renderAutomationPrimaryEventPicker();

  const triggerIds=automationAllTriggerDeviceIds();
  const conditionSelected=values.conditionDeviceId??automationElements.conditionDevice.value;
  fillAutomationSelect(automationElements.conditionDevice,automationConditionDevices().filter(device=>!triggerIds.has(device.id)),conditionSelected,'Anderes Bedingungsgerät wählen',automationElements.conditionSearch?.value,automationElements.conditionCount);
  const conditionId=automationElements.conditionDevice.value||conditionSelected;
  fillAutomationStateSelect(automationElements.conditionState,conditionId,values.conditionStateKey??automationElements.conditionState.value,false);
  fillAutomationValueSelect(automationElements.conditionValue,automationElements.conditionState.value,values.conditionValue??automationElements.conditionValue.value,conditionId);

  const actionSelected=values.actionDeviceId??automationElements.actionDevice.value;
  fillAutomationSelect(automationElements.actionDevice,automationActionDevices().filter(device=>!triggerIds.has(device.id)),actionSelected,'Zielgerät wählen',automationElements.actionSearch?.value,automationElements.actionCount);
  if(actionSelected&&[...automationElements.actionDevice.options].some(option=>option.value===actionSelected))automationElements.actionDevice.value=actionSelected;
  fillAutomationActionSelect(values.action??automationElements.action.value);
  renderAutomationAdditionalTriggers();
}
function automationStoredAdditionalTrigger(trigger){
  const storedEvent=automationParseStoredEventTrigger(trigger?.stateKey);
  const eventValues=storedEvent?[storedEvent.value]:[];
  return {id:++automationAdditionalTriggerSequence,deviceId:String(trigger?.deviceId||''),stateKey:storedEvent?automationButtonEventMarker:String(trigger?.stateKey||''),value:storedEvent?.value??trigger?.value??true,eventValues,query:'',expanded:false};
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
  return `${device.name} · ${automationStateLabel(trigger.stateKey)} = ${automationValueLabel(trigger.stateKey,trigger.value===true||trigger.value==='true')}`;
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
    fillAutomationSelect(deviceSelect,automationTriggerDevices(),trigger.deviceId,'Triggergerät wählen',trigger.query,count);
    const selectedDevice=deviceSelect.value||trigger.deviceId;if(selectedDevice!==trigger.deviceId)trigger.deviceId=selectedDevice;
    const stateSelect=document.getElementById(`automationExtraState-${trigger.id}`);const valueSelect=document.getElementById(`automationExtraValue-${trigger.id}`);
    fillAutomationStateSelect(stateSelect,trigger.deviceId,trigger.stateKey,true);trigger.stateKey=stateSelect.value;
    fillAutomationValueSelect(valueSelect,trigger.stateKey,trigger.value,trigger.deviceId);
    if(trigger.stateKey===automationButtonEventMarker){trigger.eventValues=automationAdditionalEventValues(trigger);trigger.value=trigger.eventValues[0]}else{trigger.eventValues=[];trigger.value=valueSelect.value==='true'}
    renderAutomationAdditionalEventPicker(trigger);
  }
  refreshAutomationAddTriggerAvailability();
}
function addAutomationAdditionalTrigger(){
  if(automationAdditionalTriggers.length>=7||automationTotalTriggerDefinitionCount()>=8){notify('Maximal acht ODER-Auslöser pro Automation.',true);return}
  const excluded=new Set([automationElements.triggerDevice?.value,automationElements.actionDevice?.value].filter(Boolean));const candidates=automationTriggerDevices();const first=candidates.find(device=>!excluded.has(device.id))||candidates[0];const state=first?(automationBooleanStateKeys(first)[0]||(automationEventStateKeys(first).length?automationButtonEventMarker:'')):'';
  const value=state===automationButtonEventMarker?(automationButtonEventValues(first)[0]??1000):true;
  automationAdditionalTriggers.push({id:++automationAdditionalTriggerSequence,deviceId:first?.id||'',stateKey:state,value,eventValues:state===automationButtonEventMarker?[value]:[],query:'',expanded:true});
  updateAutomationFormOptions();
}
function removeAutomationAdditionalTrigger(id){automationAdditionalTriggers=automationAdditionalTriggers.filter(trigger=>trigger.id!==id);updateAutomationFormOptions()}
function toggleAutomationAdditionalTrigger(id){const trigger=automationAdditionalTriggers.find(item=>item.id===id);if(!trigger)return;trigger.expanded=!trigger.expanded;renderAutomationAdditionalTriggers()}
function searchAutomationAdditionalTrigger(id,query){const trigger=automationAdditionalTriggers.find(item=>item.id===id);if(!trigger)return;trigger.query=query;const select=document.getElementById(`automationExtraDevice-${id}`);const count=document.getElementById(`automationExtraCount-${id}`);if(select)fillAutomationSelect(select,automationTriggerDevices(),trigger.deviceId,'Triggergerät wählen',query,count)}
function changeAutomationAdditionalTriggerDevice(id,deviceId){const trigger=automationAdditionalTriggers.find(item=>item.id===id);if(!trigger)return;trigger.deviceId=deviceId;trigger.query='';const device=automationDeviceById(deviceId);trigger.stateKey=automationBooleanStateKeys(device)[0]||(automationEventStateKeys(device).length?automationButtonEventMarker:'');trigger.value=trigger.stateKey===automationButtonEventMarker?(automationButtonEventValues(device)[0]??1000):true;trigger.eventValues=trigger.stateKey===automationButtonEventMarker?[trigger.value]:[];updateAutomationFormOptions()}
function changeAutomationAdditionalTriggerState(id,stateKey){const trigger=automationAdditionalTriggers.find(item=>item.id===id);if(!trigger)return;trigger.stateKey=stateKey;const device=automationDeviceById(trigger.deviceId);trigger.value=stateKey===automationButtonEventMarker?(automationButtonEventValues(device)[0]??1000):true;trigger.eventValues=stateKey===automationButtonEventMarker?[trigger.value]:[];renderAutomationAdditionalTriggers()}
function changeAutomationAdditionalTriggerValue(id,value){const trigger=automationAdditionalTriggers.find(item=>item.id===id);if(!trigger)return;trigger.value=trigger.stateKey===automationButtonEventMarker?Number(value):value==='true';if(trigger.stateKey===automationButtonEventMarker)trigger.eventValues=[trigger.value];renderAutomationAdditionalTriggers()}
function automationAdditionalTriggerPayload(){return automationAdditionalTriggers.flatMap(trigger=>trigger.stateKey===automationButtonEventMarker?automationAdditionalEventValues(trigger).map(value=>({deviceId:trigger.deviceId,stateKey:`event:buttonEvent:${value}`,value:true})):[{deviceId:trigger.deviceId,stateKey:trigger.stateKey,value:trigger.value===true||trigger.value==='true'}])}
function automationRoomById(id){return rooms.find(room=>room.id===id)}
function fillAutomationRoomSelect(selected=''){
  const current=selected||automationElements.room?.value||'';
  const options=['<option value="">Keinem Raum zugeordnet</option>',...rooms.map(room=>`<option value="${escapeHtml(room.id)}"${room.id===current?' selected':''}>${escapeHtml(room.name)}</option>`)]
  if(automationElements.room){automationElements.room.innerHTML=options.join('');automationElements.room.value=rooms.some(room=>room.id===current)?current:''}
}
function automationLastEventLabel(value,now=new Date()){
  if(!value)return 'Letztes Event: noch nicht ausgeführt';
  const eventDate=new Date(value);if(Number.isNaN(eventDate.getTime()))return 'Letztes Event: unbekannt';
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const eventDay=new Date(eventDate.getFullYear(),eventDate.getMonth(),eventDate.getDate());
  const days=Math.max(0,Math.round((today.getTime()-eventDay.getTime())/86400000));
  const dayLabel=days===0?'Heute':days===1?'Gestern':`vor ${days} Tagen`;
  const time=eventDate.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  return `Letztes Event: ${dayLabel} · ${time} Uhr`;
}
function automationSummary(rule){
  const trigger=automationDeviceById(rule.triggerDeviceId);const condition=rule.conditionDeviceId?automationDeviceById(rule.conditionDeviceId):null;const target=automationDeviceById(rule.actionDeviceId);const event=automationParseStoredEventTrigger(rule.triggerStateKey);
  const primary=event?`Wenn ${trigger?.name||'Unbekannt'} · ${automationButtonEventLabel(event.value)}`:`Wenn ${trigger?.name||'Unbekannt'} · ${automationStateLabel(rule.triggerStateKey)} = ${automationValueLabel(rule.triggerStateKey,rule.triggerValue)}`;
  const triggerCount=1+(rule.additionalTriggers?.length||0);const triggerText=triggerCount>1?`${primary} · ${triggerCount} Auslöser (ODER)`:primary;
  const conditionText=condition?`Nur wenn ${condition.name} · ${automationStateLabel(rule.conditionStateKey)} = ${automationValueLabel(rule.conditionStateKey,rule.conditionValue)}`:'Ohne zusätzliche Bedingung';
  const actionText=`Dann ${target?.name||'Unbekannt'} → ${automationActionLabels[rule.action]||rule.action}`;
  return {triggerText,conditionText,actionText};
}
function renderAutomations(){
  automationElements.count.textContent=automationRules.length;
  if(!automationRules.length){automationElements.list.innerHTML='<div class="empty-state compact"><h3>Noch keine Automationen</h3><p class="muted">Lege rechts deine erste lokale Regel an.</p></div>';return}
  automationElements.list.innerHTML=automationRules.map(rule=>{const summary=automationSummary(rule);const room=automationRoomById(rule.roomId);return `<article class="automation-card ${rule.enabled?'':'disabled'}"><div class="automation-card-head"><div class="automation-card-title"><h3>${escapeHtml(rule.name)}</h3><div class="automation-card-meta"><span>${rule.enabled?'Aktiv':'Deaktiviert'}</span>${room?`<span class="automation-room-badge">${iconMarkup(room.icon||'home-outline')} ${escapeHtml(room.name)}</span>`:''}</div><small class="automation-last-event">${escapeHtml(automationLastEventLabel(rule.lastTriggeredAt))}</small></div><label class="automation-switch" title="Automation ${rule.enabled?'deaktivieren':'aktivieren'}"><input type="checkbox" ${rule.enabled?'checked':''} onchange="toggleAutomation('${rule.id}',this.checked)"><span aria-hidden="true"></span></label></div><div class="automation-flow"><div><span class="automation-step-icon">${iconMarkup('flash-outline')}</span><p>${escapeHtml(summary.triggerText)}</p></div><div><span class="automation-step-icon">${iconMarkup('filter-outline')}</span><p>${escapeHtml(summary.conditionText)}</p></div><div><span class="automation-step-icon">${iconMarkup('arrow-right-bold-outline')}</span><p>${escapeHtml(summary.actionText)}</p></div></div><div class="automation-card-actions"><button class="secondary" type="button" onclick="editAutomation('${rule.id}')">${iconMarkup('pencil-outline')}<span>Bearbeiten</span></button><button class="danger" type="button" onclick="deleteAutomation('${rule.id}')">${iconMarkup('delete-outline')}<span>Löschen</span></button></div></article>`}).join('');
}
async function loadAutomations(){const payload=await api('/api/automations');automationRules=payload?.automations||[];fillAutomationRoomSelect();renderAutomations();updateAutomationFormOptions()}
function resetAutomationForm(){editingAutomationId=null;automationAdditionalTriggers=[];automationPrimaryEventValues=[];automationElements.form.reset();clearAutomationDeviceSearches();fillAutomationRoomSelect('');automationElements.enabled.checked=true;automationElements.conditionEnabled.checked=false;automationElements.conditionFields.hidden=true;automationElements.title.textContent='Automation hinzufügen';automationElements.save.textContent='Automation speichern';automationElements.cancel.hidden=true;updateAutomationFormOptions()}
function cancelAutomationEdit(){resetAutomationForm()}
function editAutomation(id){
  clearAutomationDeviceSearches();const rule=automationRules.find(item=>item.id===id);if(!rule)return;editingAutomationId=id;const primaryEvent=automationParseStoredEventTrigger(rule.triggerStateKey);const primaryEventValues=primaryEvent?[primaryEvent.value]:[];const visibleAdditional=[];for(const trigger of (rule.additionalTriggers||[])){const event=automationParseStoredEventTrigger(trigger.stateKey);if(primaryEvent&&trigger.deviceId===rule.triggerDeviceId&&event){primaryEventValues.push(event.value)}else visibleAdditional.push(trigger)}automationAdditionalTriggers=automationStoredAdditionalTriggers(visibleAdditional);automationPrimaryEventValues=[];automationSetPrimaryEventValues(primaryEventValues);automationElements.title.textContent='Automation bearbeiten';automationElements.save.textContent='Änderungen speichern';automationElements.cancel.hidden=false;automationElements.name.value=rule.name;fillAutomationRoomSelect(rule.roomId||'');automationElements.enabled.checked=rule.enabled;automationElements.conditionEnabled.checked=Boolean(rule.conditionDeviceId);automationElements.conditionFields.hidden=!rule.conditionDeviceId;updateAutomationFormOptions(rule);automationElements.name.focus();window.scrollTo({top:0,behavior:'smooth'});
}
function automationPayload(){
  const useCondition=automationElements.conditionEnabled.checked;const eventTrigger=automationElements.triggerState.value===automationButtonEventMarker;
  const eventValues=eventTrigger?(automationPrimaryEventValues.length?automationPrimaryEventValues:[Number(automationElements.triggerValue.value)]):[];
  const eventValue=eventValues[0];const sameDeviceEventTriggers=eventValues.slice(1).map(value=>({deviceId:automationElements.triggerDevice.value,stateKey:`event:buttonEvent:${value}`,value:true}));
  return {name:automationElements.name.value.trim(),enabled:automationElements.enabled.checked,roomId:automationElements.room?.value||null,triggerDeviceId:automationElements.triggerDevice.value,triggerStateKey:eventTrigger?`event:buttonEvent:${eventValue}`:automationElements.triggerState.value,triggerValue:eventTrigger?true:automationElements.triggerValue.value==='true',additionalTriggers:[...sameDeviceEventTriggers,...automationAdditionalTriggerPayload()],conditionDeviceId:useCondition?automationElements.conditionDevice.value:null,conditionStateKey:useCondition?automationElements.conditionState.value:null,conditionValue:useCondition?automationElements.conditionValue.value==='true':null,actionDeviceId:automationElements.actionDevice.value,action:automationElements.action.value};
}
function friendlyAutomationError(error){const messages={AUTOMATION_ROOM_NOT_FOUND:'Der ausgewählte Raum existiert nicht mehr.',AUTOMATION_CYCLE_NOT_ALLOWED:'Diese Regel würde einen Schaltkreis zwischen Automationen erzeugen. Zyklische Regeln sind nicht erlaubt.',AUTOMATION_TRIGGER_ACTION_SAME_DEVICE:'Trigger- und Zielgerät müssen unterschiedlich sein.',AUTOMATION_CONDITION_TRIGGER_SAME_DEVICE:'Das Bedingungsgerät muss sich vom Triggergerät unterscheiden.',AUTOMATION_TRIGGER_STATE_UNSUPPORTED:'Der ausgewählte Triggerzustand ist für dieses Gerät nicht verfügbar.',AUTOMATION_TRIGGER_EVENT_UNSUPPORTED:'Das ausgewählte Tasterereignis ist für dieses Gerät nicht verfügbar.',AUTOMATION_TRIGGER_LIMIT:'Maximal acht ODER-Auslöser sind pro Automation möglich.',AUTOMATION_TRIGGER_DUPLICATE:'Derselbe Auslöser ist mehrfach eingetragen.',AUTOMATION_CONDITION_STATE_UNSUPPORTED:'Der ausgewählte Bedingungszustand ist für dieses Gerät nicht verfügbar.',AUTOMATION_ACTION_UNSUPPORTED:'Das Zielgerät unterstützt diese Aktion nicht.'};return messages[error?.code]||error?.message||'Automation konnte nicht gespeichert werden.'}
async function saveAutomation(){const payload=automationPayload();const wasEditing=Boolean(editingAutomationId);const method=wasEditing?'PUT':'POST';const url=wasEditing?`/api/automations/${editingAutomationId}`:'/api/automations';const original=automationElements.save.textContent;automationElements.save.disabled=true;automationElements.save.textContent='Wird gespeichert …';try{await api(url,{method,headers:{'content-type':'application/json'},body:JSON.stringify(payload)});await loadAutomations();resetAutomationForm();notify(wasEditing?'Automation wurde aktualisiert.':'Automation wurde angelegt.')}catch(error){notify(friendlyAutomationError(error),true)}finally{automationElements.save.disabled=false;automationElements.save.textContent=original}}
async function toggleAutomation(id,enabled){try{await api(`/api/automations/${id}/enabled`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({enabled})});await loadAutomations();notify(enabled?'Automation aktiviert.':'Automation deaktiviert.')}catch(error){notify(friendlyAutomationError(error),true);await loadAutomations().catch(()=>undefined)}}
async function deleteAutomation(id){const rule=automationRules.find(item=>item.id===id);if(!rule)return;if(!confirm(`Automation „${rule.name}“ wirklich löschen?`))return;try{await api(`/api/automations/${id}`,{method:'DELETE'});if(editingAutomationId===id)resetAutomationForm();await loadAutomations();notify('Automation wurde gelöscht.')}catch(error){notify(friendlyAutomationError(error),true)}}

function automationDevicesChanged(){fillAutomationRoomSelect();updateAutomationFormOptions();renderAutomations()}

automationElements.triggerSearch?.addEventListener('input',()=>refreshAutomationDeviceSearch('trigger'));
automationElements.conditionSearch?.addEventListener('input',()=>refreshAutomationDeviceSearch('condition'));
automationElements.actionSearch?.addEventListener('input',()=>refreshAutomationDeviceSearch('action'));
automationElements.triggerDevice?.addEventListener('change',()=>{automationPrimaryEventValues=[];if(automationElements.triggerSearch)automationElements.triggerSearch.value='';fillAutomationStateSelect(automationElements.triggerState,automationElements.triggerDevice.value,undefined,true);fillAutomationValueSelect(automationElements.triggerValue,automationElements.triggerState.value,undefined,automationElements.triggerDevice.value);updateAutomationFormOptions()});
automationElements.triggerState?.addEventListener('change',()=>{automationPrimaryEventValues=[];fillAutomationValueSelect(automationElements.triggerValue,automationElements.triggerState.value);renderAutomationPrimaryEventPicker()});
automationElements.conditionEnabled?.addEventListener('change',()=>{automationElements.conditionFields.hidden=!automationElements.conditionEnabled.checked;if(automationElements.conditionEnabled.checked)updateAutomationFormOptions()});
automationElements.conditionDevice?.addEventListener('change',()=>{if(automationElements.conditionSearch)automationElements.conditionSearch.value='';fillAutomationStateSelect(automationElements.conditionState,automationElements.conditionDevice.value,undefined,false);fillAutomationValueSelect(automationElements.conditionValue,automationElements.conditionState.value)});
automationElements.conditionState?.addEventListener('change',()=>fillAutomationValueSelect(automationElements.conditionValue,automationElements.conditionState.value));
automationElements.actionDevice?.addEventListener('change',()=>{if(automationElements.actionSearch)automationElements.actionSearch.value='';fillAutomationActionSelect();updateAutomationFormOptions()});
automationElements.form?.addEventListener('submit',event=>{event.preventDefault();saveAutomation().catch(error=>notify(friendlyAutomationError(error),true))});
