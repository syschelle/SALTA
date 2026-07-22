let all=[],rooms=[],selectedDevice=null,shellySettingsStatus=null,editingRoomId=null,liveRefreshInFlight=false,activeCoverSliderId=null,csrfToken="";
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
const pages=['overview','devices','rooms','settings'];
const defaultPage='overview';
const icons={outlet:'mdi-power-socket-eu',switch:'mdi-toggle-switch-outline',energyMeter:'mdi-flash-outline',windowCovering:'mdi-window-shutter',thermostat:'mdi-thermostat',light:'mdi-lightbulb-outline',fan:'mdi-fan',motionSensor:'mdi-motion-sensor'};
const mdiIcon=(name,fallback='help-circle-outline')=>{const normalized=String(name||'').trim().toLowerCase().replace(/^mdi-/,'');return /^[a-z0-9-]+$/.test(normalized)?`mdi-${normalized}`:`mdi-${fallback}`};
const iconMarkup=(name)=>`<span class="mdi ${mdiIcon(name)}" aria-hidden="true"></span>`;
const typeLabels={outlet:'Steckdose',switch:'Schalter',energyMeter:'Energiezähler',windowCovering:'Rollladen',thermostat:'Thermostat',light:'Licht',fan:'Ventilator',motionSensor:'Bewegungssensor'};
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
const labels={on:'Status',brightness:'Helligkeit',power:'Leistung',energy:'Energie',voltage:'Spannung',current:'Strom',frequency:'Frequenz',temperature:'Temperatur',motion:'Bewegung',battery:'Batterie',currentPosition:'Position',targetPosition:'Ziel',positionState:'Fahrt',currentTemperature:'Ist',targetTemperature:'Soll',mode:'Modus',totalPower:'Gesamtleistung',powerL1:'Phase L1',powerL2:'Phase L2',powerL3:'Phase L3'};
const fmt=(k,v)=>{if(typeof v==='boolean')return v?'Ein':'Aus';if(typeof v!=='number')return String(v);const value=Math.round(v*10)/10;const lower=k.toLowerCase();const unit=lower.includes('temperature')?' °C':lower.includes('position')||k==='brightness'||k==='battery'?' %':lower.includes('power')?' W':k==='energy'?' Wh':k==='voltage'?' V':k==='current'?' A':k==='frequency'?' Hz':'';return `${value}${unit}`};
const displayedState=d=>Object.entries(d.state||{}).filter(([,value])=>value!==null&&value!==undefined&&!(typeof value==='number'&&!Number.isFinite(value))).slice(0,4);
function supportsPresentationOverride(d){return ['switch','outlet','light'].includes(d.type)&&d.capabilities.includes('turnOn')&&d.capabilities.includes('turnOff')}
function resolvedPresentationType(d){return d.presentationType&&d.presentationType!=='auto'&&supportsPresentationOverride(d)?d.presentationType:d.type}

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
    throw error;
  }
  return payload;
}
async function logout(){
  try{await api('/auth/logout',{method:'POST'})}finally{location.replace('/login')}
}
function updateDashboardSummary(){
  deviceCount.textContent=all.length;
  reachableCount.textContent=all.filter(device=>device.reachable).length;
  roomCount.textContent=rooms.length;
  const currentPower=all.filter(device=>device.reachable).reduce((sum,device)=>sum+Number(device.state?.totalPower??device.state?.power??0),0);
  power.textContent=all.some(device=>device.state?.totalPower!==undefined||device.state?.power!==undefined)?String(Math.round(currentPower)):'–';
}
async function load(){
  try{
    [all,rooms]=await Promise.all([api('/api/devices'),api('/api/rooms')]);
    renderFilters();
    renderDevices();
    renderRooms();
    updateDashboardSummary();
  }catch(error){notify(error.message,true)}
}
async function refreshLiveData(){
  if(liveRefreshInFlight)return;
  liveRefreshInFlight=true;
  try{
    all=await api('/api/devices');
    if(!activeCoverSliderId)renderDevices();
    updateDashboardSummary();
  }catch(error){
    console.warn('Live device refresh failed',error);
  }finally{
    liveRefreshInFlight=false;
  }
}
function renderFilters(){const current=roomFilter.value;roomFilter.innerHTML='<option value="">Alle Räume</option>'+rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')+'<option value="unassigned">Nicht zugeordnet</option>';roomFilter.value=current;}
function filtered(){const q=filter.value.toLowerCase();const rf=roomFilter.value;return all.filter(d=>d.name.toLowerCase().includes(q)&&(!rf||(rf==='unassigned'?!d.roomId:d.roomId===rf)))}
function boundedPosition(value){const number=Number(value);return Number.isFinite(number)?Math.min(100,Math.max(0,Math.round(number))):null}
function coverPosition(d){return coverSliderDrafts.has(d.id)?coverSliderDrafts.get(d.id):boundedPosition(d.state?.currentPosition)}
function beginCoverPosition(id,value,input){activeCoverSliderId=id;previewCoverPosition(id,value,input)}
function previewCoverPosition(id,value,input){const position=boundedPosition(value);if(position===null)return;coverSliderDrafts.set(id,position);const output=input?.closest('.cover-control')?.querySelector('output');if(output)output.textContent=`${position} %`}
function endCoverPosition(id){if(activeCoverSliderId===id)activeCoverSliderId=null}
async function setCoverPosition(id,value){const position=boundedPosition(value);if(position===null)return;coverSliderDrafts.set(id,position);activeCoverSliderId=null;try{await api(`/api/devices/${id}/command`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({capability:'setTargetPosition',value:position})});coverSliderDrafts.delete(id);all=await api('/api/devices');renderDevices();updateDashboardSummary();notify(`Rollladen fährt auf ${position} %.`)}catch(error){coverSliderDrafts.delete(id);renderDevices();notify(error.message,true)}}
function coverControl(d){if(d.type!=='windowCovering'||!d.capabilities.includes('setTargetPosition'))return'';const position=coverPosition(d);if(position===null)return'<div class="cover-position-unavailable">Positionssteuerung ist erst nach der Kalibrierung verfügbar.</div>';const disabled=d.reachable?'':' disabled';return `<div class="cover-control"><div class="cover-control-head"><label for="cover-position-${escapeHtml(d.id)}">Höhe</label><output for="cover-position-${escapeHtml(d.id)}">${position} %</output></div><input id="cover-position-${escapeHtml(d.id)}" type="range" min="0" max="100" step="1" value="${position}" aria-label="Höhe für ${escapeHtml(d.name)}" onfocus="beginCoverPosition('${d.id}',this.value,this)" onpointerdown="beginCoverPosition('${d.id}',this.value,this)" oninput="previewCoverPosition('${d.id}',this.value,this)" onchange="setCoverPosition('${d.id}',this.value)" onblur="endCoverPosition('${d.id}')"${disabled}></div>`}
function actions(d){const a=[];if(d.capabilities.includes('toggle'))a.push(`<button onclick="cmd('${d.id}','toggle')">${iconMarkup(d.state.on?'power-off':'power')}<span>${d.state.on?'Ausschalten':'Einschalten'}</span></button>`);if(d.capabilities.includes('open'))a.push(`<button onclick="cmd('${d.id}','open')">${iconMarkup('arrow-up')}<span>Öffnen</span></button><button onclick="cmd('${d.id}','stop')">${iconMarkup('stop')}<span>Stopp</span></button><button onclick="cmd('${d.id}','close')">${iconMarkup('arrow-down')}<span>Schließen</span></button>`);if(d.capabilities.includes('setTargetTemperature'))a.push(`<button onclick="temp('${d.id}',${d.state.targetTemperature})">${iconMarkup('thermometer')}<span>Temperatur</span></button>`);a.push(`<button class="secondary device-config-button" onclick="openDevice('${d.id}')" aria-label="${escapeHtml(d.name)} konfigurieren" title="Konfigurieren">${iconMarkup('cog-outline')}</button>`);return a.join('')}
function deviceCard(d){const visualType=resolvedPresentationType(d);const stateVisual=['switch','light','outlet'].includes(visualType);const stateKnown=stateVisual&&d.reachable&&typeof d.state?.on==='boolean';const stateClass=stateKnown?(d.state.on?' device-state-on':' device-state-off'):'';const stateLabel=stateKnown?`, ${d.state.on?'An':'Aus'}`:'';const values=displayedState(d).filter(([key])=>!(stateVisual&&key==='on'));const model=d.model?` · ${escapeHtml(d.model)}`:'';const channel=d.profile==='switch'&&d.channelCount>1?` · Kanal ${Number(d.componentId||0)+1}`:'';return `<article class="device ${d.reachable?'':'offline'}${stateClass}"${stateKnown?` aria-label="${escapeHtml(d.name)}${stateLabel}"`:''}><div class="device-head"><div class="device-head-main"><div class="icon">${iconMarkup(icons[visualType]||'help-circle-outline')}</div><div class="device-title-block"><h3>${escapeHtml(d.name)}</h3><div class="meta">${escapeHtml(d.room||'Nicht zugeordnet')} · ${escapeHtml(typeLabels[visualType]||visualType)}${channel}${model}</div></div></div><div class="dot"></div></div>${values.length?`<div class="values">${values.map(([k,v])=>`<div class="value"><b>${fmt(k,v)}</b><small>${labels[k]||k}</small></div>`).join('')}</div>`:''}${coverControl(d)}<div class="actions">${actions(d)}</div></article>`}
function renderDevices(){const devices=filtered();if(!devices.length){deviceGrid.innerHTML='<article class="empty-state"><h3>Keine Geräte gefunden</h3><p class="muted">Passe Suche oder Raumfilter an.</p></article>';return}const knownRoomIds=new Set(rooms.map(room=>room.id));const groups=rooms.map(room=>({id:room.id,name:room.name,icon:room.icon||'home-outline',devices:devices.filter(device=>device.roomId===room.id)})).filter(group=>group.devices.length);const unassigned=devices.filter(device=>!device.roomId||!knownRoomIds.has(device.roomId));if(unassigned.length)groups.push({id:'unassigned',name:'Nicht zugeordnet',icon:'help-circle-outline',devices:unassigned});deviceGrid.innerHTML=groups.map(group=>`<section class="device-room-group" data-room-id="${escapeHtml(group.id)}"><div class="device-room-heading"><div class="device-room-title"><span class="device-room-icon" aria-hidden="true">${iconMarkup(group.icon)}</span><div><h2>${escapeHtml(group.name)}</h2><p>${group.devices.length} ${group.devices.length===1?'Gerät':'Geräte'}</p></div></div></div><div class="grid">${group.devices.map(deviceCard).join('')}</div></section>`).join('')}
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
function temp(id,current){const v=prompt('Zieltemperatur',current);if(v!==null)cmd(id,'setTargetTemperature',Number(v))}
async function reconcile(){await api('/api/adapters/shelly/reconcile',{method:'POST'});await load();notify('Synchronisierung abgeschlossen.')}
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
function openDevice(id){selectedDevice=all.find(d=>d.id===id);if(!selectedDevice)return;deviceDialogTitle.textContent=selectedDevice.name;deviceName.value=selectedDevice.name;deviceRoom.innerHTML='<option value="">Nicht zugeordnet</option>'+rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');deviceRoom.value=selectedDevice.roomId||'';const configurable=supportsPresentationOverride(selectedDevice);devicePresentationSection.hidden=!configurable;devicePresentationType.value=selectedDevice.presentationType||'auto';devicePresentationType.options[0].textContent=`Automatisch (${typeLabels[selectedDevice.type]||selectedDevice.type})`;credentialMode.value=selectedDevice.credentialMode||'inherit';deviceUsername.value=selectedDevice.credentialUsername||'';devicePassword.value='';deviceDeleteSection.hidden=selectedDevice.source!=='shelly';toggleDeviceCredentials();deviceDialog.showModal()}
async function saveDeviceConfig(){if(!selectedDevice)return;const name=deviceName.value.trim();if(!name){deviceName.focus();return}const presentationType=devicePresentationSection.hidden?(selectedDevice.presentationType||'auto'):devicePresentationType.value;await api(`/api/devices/${encodeURIComponent(selectedDevice.id)}/config`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name,roomId:deviceRoom.value||null,presentationType})});await api(`/api/devices/${encodeURIComponent(selectedDevice.id)}/credentials`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({credentialMode:credentialMode.value,username:deviceUsername.value||undefined,password:devicePassword.value||undefined})});deviceDialog.close();await load();notify('Gerätekonfiguration gespeichert.')}
async function removeSelectedDevice(){if(!selectedDevice)return;const device=selectedDevice;if(!confirm(`„${device.name}“ wirklich aus SALTA löschen?\n\nDas Shelly-Gerät selbst bleibt unverändert und kann später erneut hinzugefügt werden.`))return;const original=deleteDeviceButton.textContent;deleteDeviceButton.disabled=true;deleteDeviceButton.textContent='Gerät wird gelöscht …';try{await api(`/api/devices/${encodeURIComponent(device.id)}`,{method:'DELETE'});deviceDialog.close();selectedDevice=null;await load();notify('Shelly-Gerät wurde aus SALTA gelöscht.')}finally{deleteDeviceButton.disabled=false;deleteDeviceButton.textContent=original}}

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
function routeFromHash(){const value=location.hash.replace('#','');return pages.includes(value)?value:defaultPage}
function setActiveNavigation(page){document.querySelectorAll('[data-nav]').forEach(item=>{const active=item.dataset.nav===page;item.classList.toggle('active',active);if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current')})}
async function showPage(page,{focus=false}={}){const target=pages.includes(page)?page:defaultPage;document.querySelectorAll('[data-page]').forEach(section=>section.hidden=section.dataset.page!==target);setActiveNavigation(target);if(target==='settings')await loadShellySettings();if(focus){document.querySelector(`[data-page="${target}"] h1`)?.focus({preventScroll:true})}window.scrollTo({top:0,behavior:'instant'})}
function openMenu(){document.body.classList.add('menu-open');sidebarBackdrop.hidden=false;menuToggle.setAttribute('aria-expanded','true');menuClose.focus()}
function closeMenu({restoreFocus=false}={}){document.body.classList.remove('menu-open');sidebarBackdrop.hidden=true;menuToggle.setAttribute('aria-expanded','false');if(restoreFocus)menuToggle.focus()}
function navigate(){showPage(routeFromHash());closeMenu()}
function showUnavailable(name){notify(`${name} folgt in einer kommenden SALTA-Version.`)}
function notify(message,error=false){toast.textContent=message;toast.classList.toggle('error',error);toast.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),2600)}

filter.addEventListener('input',renderDevices);roomFilter.addEventListener('change',renderDevices);
roomForm.addEventListener('submit',event=>{event.preventDefault();createRoom().catch(e=>notify(e.message,true))});
shellyForm.addEventListener('submit',event=>{event.preventDefault();saveShelly().catch(e=>notify(e.message,true))});
addShellyForm.addEventListener('submit',event=>{event.preventDefault();addShelly().catch(e=>notify(e.message,true))});
document.querySelectorAll('input[name="shellyCredentialMode"]').forEach(input=>input.addEventListener('change',toggleCustomShellyCredentials));
credentialMode.addEventListener('change',toggleDeviceCredentials);
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
