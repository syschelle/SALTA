let all=[],rooms=[],selectedDevice=null;
const pages=['overview','devices','rooms','settings'];
const defaultPage='overview';
const icons={outlet:'◉',switch:'⏻',energyMeter:'⌁',windowCovering:'▤',thermostat:'◒',light:'✦',motionSensor:'◌'};
const labels={on:'Status',brightness:'Helligkeit',power:'Leistung',energy:'Energie',motion:'Bewegung',battery:'Batterie',currentPosition:'Position',targetPosition:'Ziel',positionState:'Fahrt',currentTemperature:'Ist',targetTemperature:'Soll',mode:'Modus',totalPower:'Gesamt',powerL1:'L1',powerL2:'L2',powerL3:'L3'};
const fmt=(k,v)=>typeof v==='boolean'?(v?'Ein':'Aus'):typeof v==='number'?`${Math.round(v*10)/10}${k.includes('Temperature')?' °C':k.includes('Position')||k==='brightness'||k==='battery'?' %':k.includes('power')||k==='totalPower'?' W':''}`:String(v);

async function api(url,options){const r=await fetch(url,options);if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||`HTTP ${r.status}`)}return r.status===204?null:r.json()}
async function load(){
  try{
    [all,rooms]=await Promise.all([api('/api/devices'),api('/api/rooms')]);
    renderFilters();renderDevices();renderRooms();
    deviceCount.textContent=all.length;reachableCount.textContent=all.filter(x=>x.reachable).length;roomCount.textContent=rooms.length;
    const m=all.find(x=>x.type==='energyMeter');power.textContent=m?Math.round(Number(m.state.totalPower||0)):'–';
  }catch(error){notify(error.message,true)}
}
function renderFilters(){const current=roomFilter.value;roomFilter.innerHTML='<option value="">Alle Räume</option><option value="unassigned">Nicht zugeordnet</option>'+rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');roomFilter.value=current;}
function filtered(){const q=filter.value.toLowerCase();const rf=roomFilter.value;return all.filter(d=>d.name.toLowerCase().includes(q)&&(!rf||(rf==='unassigned'?!d.roomId:d.roomId===rf)))}
function actions(d){const a=[];if(d.capabilities.includes('toggle'))a.push(`<button onclick="cmd('${d.id}','toggle')">${d.state.on?'Ausschalten':'Einschalten'}</button>`);if(d.capabilities.includes('open'))a.push(`<button onclick="cmd('${d.id}','open')">Öffnen</button><button onclick="cmd('${d.id}','close')">Schließen</button>`);if(d.capabilities.includes('setTargetTemperature'))a.push(`<button onclick="temp('${d.id}',${d.state.targetTemperature})">Temperatur</button>`);a.push(`<button class="secondary" onclick="openDevice('${d.id}')">Konfigurieren</button>`);return a.join('')}
function renderDevices(){deviceGrid.innerHTML=filtered().map(d=>`<article class="device ${d.reachable?'':'offline'}"><div class="device-top"><div class="icon">${icons[d.type]||'•'}</div><div class="dot"></div></div><h3>${escapeHtml(d.name)}</h3><div class="meta">${escapeHtml(d.room||'Nicht zugeordnet')} · ${escapeHtml(d.type)}</div><div class="values">${Object.entries(d.state).slice(0,4).map(([k,v])=>`<div class="value"><b>${fmt(k,v)}</b><small>${labels[k]||k}</small></div>`).join('')}</div><div class="actions">${actions(d)}</div></article>`).join('')||'<article class="empty-state"><h3>Keine Geräte gefunden</h3><p class="muted">Passe Suche oder Raumfilter an.</p></article>'}
function renderRooms(){roomPageCount.textContent=rooms.length;roomList.innerHTML=rooms.map(r=>{const count=all.filter(d=>d.roomId===r.id).length;return `<div class="room-row"><div class="room-identity"><span class="room-icon" aria-hidden="true">▦</span><div><strong>${escapeHtml(r.name)}</strong><small>${count} ${count===1?'Gerät':'Geräte'}</small></div></div><button class="danger" onclick="removeRoom('${r.id}')">Löschen</button></div>`}).join('')||'<div class="empty-state compact"><h3>Noch keine Räume</h3><p class="muted">Lege rechts deinen ersten Raum an.</p></div>'}
async function cmd(id,capability,value){await api(`/api/devices/${id}/command`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({capability,value})});await load()}
function temp(id,current){const v=prompt('Zieltemperatur',current);if(v!==null)cmd(id,'setTargetTemperature',Number(v))}
async function reconcile(){await api('/api/adapters/mock/reconcile',{method:'POST'});await load();notify('Synchronisierung abgeschlossen.')}
async function createRoom(){const name=newRoomName.value.trim();if(!name)return;await api('/api/rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,icon:newRoomIcon.value||'home',sortOrder:rooms.length})});newRoomName.value='';await load();notify('Raum wurde hinzugefügt.')}
async function removeRoom(id){if(!confirm('Raum löschen? Geräte werden nicht gelöscht.'))return;await api(`/api/rooms/${id}`,{method:'DELETE'});await load();notify('Raum wurde gelöscht.')}
async function loadShellySettings(){const s=await api('/api/settings/shelly');shellyUsername.value=s.username;shellyPassword.value='';shellyPasswordState.textContent=s.passwordConfigured?'Ein Passwort ist sicher gespeichert. Leer lassen, um es beizubehalten.':'Aktuell ist kein globales Passwort gespeichert.'}
async function saveShelly(){await api('/api/settings/shelly',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({username:shellyUsername.value,password:shellyPassword.value||undefined})});await loadShellySettings();notify('Shelly-Einstellungen wurden gespeichert.')}
function openDevice(id){selectedDevice=all.find(d=>d.id===id);deviceDialogTitle.textContent=selectedDevice.name;deviceRoom.innerHTML='<option value="">Nicht zugeordnet</option>'+rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');deviceRoom.value=selectedDevice.roomId||'';credentialMode.value=selectedDevice.credentialMode||'inherit';deviceUsername.value=selectedDevice.credentialUsername||'';devicePassword.value='';deviceDialog.showModal()}
async function saveDeviceConfig(){if(!selectedDevice)return;await api(`/api/devices/${selectedDevice.id}/config`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({roomId:deviceRoom.value||null})});await api(`/api/devices/${selectedDevice.id}/credentials`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({credentialMode:credentialMode.value,username:deviceUsername.value||undefined,password:devicePassword.value||undefined})});deviceDialog.close();await load();notify('Gerätekonfiguration gespeichert.')}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function routeFromHash(){const value=location.hash.replace('#','');return pages.includes(value)?value:defaultPage}
function setActiveNavigation(page){document.querySelectorAll('[data-nav]').forEach(item=>{const active=item.dataset.nav===page;item.classList.toggle('active',active);if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current')})}
async function showPage(page,{focus=false}={}){const target=pages.includes(page)?page:defaultPage;document.querySelectorAll('[data-page]').forEach(section=>section.hidden=section.dataset.page!==target);setActiveNavigation(target);if(target==='settings')await loadShellySettings();if(focus){document.querySelector(`[data-page="${target}"] h1`)?.focus({preventScroll:true})}window.scrollTo({top:0,behavior:'instant'})}
function navigate(){showPage(routeFromHash())}
function showUnavailable(name){notify(`${name} folgt in einer kommenden SALTA-Version.`)}
function notify(message,error=false){toast.textContent=message;toast.classList.toggle('error',error);toast.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),2600)}

filter.addEventListener('input',renderDevices);roomFilter.addEventListener('change',renderDevices);
roomForm.addEventListener('submit',event=>{event.preventDefault();createRoom().catch(e=>notify(e.message,true))});
shellyForm.addEventListener('submit',event=>{event.preventDefault();saveShelly().catch(e=>notify(e.message,true))});
window.addEventListener('hashchange',navigate);
deviceDialog.addEventListener('close',()=>setActiveNavigation(routeFromHash()));

navigate();load();setInterval(load,5000);
