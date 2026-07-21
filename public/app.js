let all=[],rooms=[],selectedDevice=null,shellySettingsStatus=null,editingRoomId=null,liveRefreshInFlight=false;
const pages=['overview','devices','rooms','settings'];
const defaultPage='overview';
const icons={outlet:'◉',switch:'⏻',energyMeter:'⌁',windowCovering:'▤',thermostat:'◒',light:'✦',motionSensor:'◌'};
const typeLabels={outlet:'Steckdose',switch:'Schalter',energyMeter:'Energiezähler',windowCovering:'Rollladen',thermostat:'Thermostat',light:'Licht',motionSensor:'Bewegungssensor'};
const labels={on:'Status',brightness:'Helligkeit',power:'Leistung',energy:'Energie',voltage:'Spannung',current:'Strom',frequency:'Frequenz',temperature:'Temperatur',motion:'Bewegung',battery:'Batterie',currentPosition:'Position',targetPosition:'Ziel',positionState:'Fahrt',currentTemperature:'Ist',targetTemperature:'Soll',mode:'Modus',totalPower:'Gesamtleistung',powerL1:'Phase L1',powerL2:'Phase L2',powerL3:'Phase L3'};
const fmt=(k,v)=>{if(typeof v==='boolean')return v?'Ein':'Aus';if(typeof v!=='number')return String(v);const value=Math.round(v*10)/10;const lower=k.toLowerCase();const unit=lower.includes('temperature')?' °C':lower.includes('position')||k==='brightness'||k==='battery'?' %':lower.includes('power')?' W':k==='energy'?' Wh':k==='voltage'?' V':k==='current'?' A':k==='frequency'?' Hz':'';return `${value}${unit}`};
const displayedState=d=>Object.entries(d.state||{}).filter(([,value])=>value!==null&&value!==undefined&&!(typeof value==='number'&&!Number.isFinite(value))).slice(0,4);

async function api(url,options){
  const response=await fetch(url,options);
  if(!response.ok){
    const payload=await response.json().catch(()=>({}));
    const error=new Error(payload.error?.message||`HTTP ${response.status}`);
    error.code=payload.error?.code||`HTTP_${response.status}`;
    error.status=response.status;
    error.requestId=payload.error?.requestId;
    throw error;
  }
  return response.status===204?null:response.json();
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
    renderDevices();
    updateDashboardSummary();
  }catch(error){
    console.warn('Live device refresh failed',error);
  }finally{
    liveRefreshInFlight=false;
  }
}
function renderFilters(){const current=roomFilter.value;roomFilter.innerHTML='<option value="">Alle Räume</option><option value="unassigned">Nicht zugeordnet</option>'+rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');roomFilter.value=current;}
function filtered(){const q=filter.value.toLowerCase();const rf=roomFilter.value;return all.filter(d=>d.name.toLowerCase().includes(q)&&(!rf||(rf==='unassigned'?!d.roomId:d.roomId===rf)))}
function actions(d){const a=[];if(d.capabilities.includes('toggle'))a.push(`<button onclick="cmd('${d.id}','toggle')">${d.state.on?'Ausschalten':'Einschalten'}</button>`);if(d.capabilities.includes('open'))a.push(`<button onclick="cmd('${d.id}','open')">Öffnen</button><button onclick="cmd('${d.id}','close')">Schließen</button>`);if(d.capabilities.includes('setTargetTemperature'))a.push(`<button onclick="temp('${d.id}',${d.state.targetTemperature})">Temperatur</button>`);a.push(`<button class="secondary" onclick="openDevice('${d.id}')">Konfigurieren</button>`);return a.join('')}
function renderDevices(){deviceGrid.innerHTML=filtered().map(d=>{const values=displayedState(d);const model=d.model?` · ${escapeHtml(d.model)}`:'';return `<article class="device ${d.reachable?'':'offline'}"><div class="device-top"><div class="icon">${icons[d.type]||'•'}</div><div class="dot"></div></div><h3>${escapeHtml(d.name)}</h3><div class="meta">${escapeHtml(d.room||'Nicht zugeordnet')} · ${escapeHtml(typeLabels[d.type]||d.type)}${model}</div><div class="values">${values.length?values.map(([k,v])=>`<div class="value"><b>${fmt(k,v)}</b><small>${labels[k]||k}</small></div>`).join(''):'<p class="muted">Keine Messwerte verfügbar</p>'}</div><div class="actions">${actions(d)}</div></article>`}).join('')||'<article class="empty-state"><h3>Keine Geräte gefunden</h3><p class="muted">Passe Suche oder Raumfilter an.</p></article>'}
function currentRoomEditDraft(){
  if(!editingRoomId)return null;
  const row=roomRow(editingRoomId);
  const form=row?.querySelector('.room-edit-form');
  if(!form||form.hidden)return null;
  const activeElement=document.activeElement;
  const activeField=form.contains(activeElement)&&activeElement instanceof HTMLInputElement?activeElement.name:null;
  return {
    id:editingRoomId,
    name:form.elements.name.value,
    icon:form.elements.icon.value,
    activeField,
    selectionStart:activeField?activeElement.selectionStart:null,
    selectionEnd:activeField?activeElement.selectionEnd:null
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
    if(draft.activeField&&draft.selectionStart!==null&&draft.selectionEnd!==null)input.setSelectionRange(draft.selectionStart,draft.selectionEnd);
  }
}
function renderRooms(){
  const draft=currentRoomEditDraft();
  roomPageCount.textContent=rooms.length;
  roomList.innerHTML=rooms.map(r=>{const count=all.filter(d=>d.roomId===r.id).length;return `<div class="room-row" data-room-id="${r.id}"><div class="room-summary"><div class="room-identity"><span class="room-icon" aria-hidden="true">${escapeHtml(r.icon||'home')}</span><div><strong>${escapeHtml(r.name)}</strong><small>${count} ${count===1?'Gerät':'Geräte'}</small></div></div><div class="room-actions"><button class="secondary" type="button" onclick="startRoomEdit('${r.id}')">Bearbeiten</button><button class="danger" type="button" onclick="removeRoom('${r.id}')">Löschen</button></div></div><form class="room-edit-form" onsubmit="saveRoomEdit(event,'${r.id}')" hidden><label>Name<input name="name" value="${escapeHtml(r.name)}" required maxlength="80"></label><label>Icon<input name="icon" value="${escapeHtml(r.icon||'home')}" required maxlength="40"></label><div class="room-actions"><button type="button" class="secondary" onclick="cancelRoomEdit('${r.id}')">Abbrechen</button><button type="submit">Speichern</button></div></form></div>`}).join('')||'<div class="empty-state compact"><h3>Noch keine Räume</h3><p class="muted">Lege rechts deinen ersten Raum an.</p></div>';
  if(draft)restoreRoomEdit(draft,{focus:Boolean(draft.activeField)});
}
function roomRow(id){return roomList.querySelector(`[data-room-id="${CSS.escape(id)}"]`)}
function startRoomEdit(id){
  if(editingRoomId&&editingRoomId!==id)cancelRoomEdit(editingRoomId);
  editingRoomId=id;
  const room=rooms.find(item=>item.id===id);
  restoreRoomEdit({id,name:room?.name||'',icon:room?.icon||'home',activeField:'name',selectionStart:0,selectionEnd:(room?.name||'').length},{focus:true});
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
  const icon=form.elements.icon.value.trim()||'home';
  if(!name)return;
  try{
    await api(`/api/rooms/${id}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({name,icon,sortOrder:room.sortOrder||0})});
    editingRoomId=null;
    await load();
    notify('Raum wurde aktualisiert.');
  }catch(error){notify(error.message,true)}
}
async function cmd(id,capability,value){await api(`/api/devices/${id}/command`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({capability,value})});await load()}
function temp(id,current){const v=prompt('Zieltemperatur',current);if(v!==null)cmd(id,'setTargetTemperature',Number(v))}
async function reconcile(){await api('/api/adapters/shelly/reconcile',{method:'POST'});await load();notify('Synchronisierung abgeschlossen.')}
async function createRoom(){const name=newRoomName.value.trim();if(!name)return;await api('/api/rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,icon:newRoomIcon.value||'home',sortOrder:rooms.length})});newRoomName.value='';await load();notify('Raum wurde hinzugefügt.')}
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
function openDevice(id){selectedDevice=all.find(d=>d.id===id);if(!selectedDevice)return;deviceDialogTitle.textContent=selectedDevice.name;deviceRoom.innerHTML='<option value="">Nicht zugeordnet</option>'+rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');deviceRoom.value=selectedDevice.roomId||'';credentialMode.value=selectedDevice.credentialMode||'inherit';deviceUsername.value=selectedDevice.credentialUsername||'';devicePassword.value='';deviceDeleteSection.hidden=selectedDevice.source!=='shelly';toggleDeviceCredentials();deviceDialog.showModal()}
async function saveDeviceConfig(){if(!selectedDevice)return;await api(`/api/devices/${encodeURIComponent(selectedDevice.id)}/config`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({roomId:deviceRoom.value||null})});await api(`/api/devices/${encodeURIComponent(selectedDevice.id)}/credentials`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({credentialMode:credentialMode.value,username:deviceUsername.value||undefined,password:devicePassword.value||undefined})});deviceDialog.close();await load();notify('Gerätekonfiguration gespeichert.')}
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
    await api('/api/adapters/shelly/devices',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    addShellyDialog.close();
    await load();
    notify('Shelly-Gerät wurde hinzugefügt.');
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
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('menu-open'))closeMenu({restoreFocus:true})});
document.querySelectorAll('#sidebar [data-nav]').forEach(item=>item.addEventListener('click',()=>{if(matchMedia('(max-width: 1000px)').matches)closeMenu()}));
deviceDialog.addEventListener('close',()=>{selectedDevice=null;setActiveNavigation(routeFromHash())});

navigate();load();setInterval(refreshLiveData,5000);
