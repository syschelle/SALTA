(function(){
  const form=document.getElementById('fritzSmartHomeSettingsForm');
  if(!form)return;
  const enabled=document.getElementById('fritzSmartHomeEnabled');
  const thermostats=document.getElementById('fritzSmartHomeThermostats');
  const outlets=document.getElementById('fritzSmartHomeOutlets');
  const lights=document.getElementById('fritzSmartHomeLights');
  const sensors=document.getElementById('fritzSmartHomeSensors');
  const status=document.getElementById('fritzSmartHomeStatus');
  const testButton=document.getElementById('fritzSmartHomeTestButton');
  const refreshButton=document.getElementById('fritzSmartHomeRefreshButton');
  const categoryInputs=[thermostats,outlets,lights,sensors];
  const translate=value=>globalThis.SaltaI18n?.translateSource?.(value)??value;

  function setCategoryAvailability(){for(const input of categoryInputs)if(input)input.disabled=!enabled.checked}
  function statusText(value){
    if(!value?.enabled)return translate('Deaktiviert – keine FRITZ!Box-Smart-Home-Geräte werden abgefragt.');
    if(value.connected)return `${translate('Verbunden')} · ${Number(value.deviceCount||0)} ${translate('Geräte eingebunden')}`;
    return value.lastError?`${translate('Nicht verbunden')}: ${value.lastError}`:translate('Noch nicht synchronisiert');
  }
  function render(data){
    const settings=data?.settings||{};
    enabled.checked=settings.enabled===true;
    thermostats.checked=settings.thermostats===true;
    outlets.checked=settings.outlets===true;
    lights.checked=settings.lights===true;
    sensors.checked=settings.sensors===true;
    setCategoryAvailability();
    if(status){status.textContent=statusText(data?.status);status.classList.toggle('ok',Boolean(data?.status?.connected));status.classList.toggle('warning',Boolean(data?.status?.enabled&&!data?.status?.connected))}
  }
  async function load(){try{render(await api('/api/fritzbox/smarthome'))}catch(error){if(status)status.textContent=String(error?.message||error)}}
  async function save(event){
    event.preventDefault();
    const payload={enabled:enabled.checked,thermostats:thermostats.checked,outlets:outlets.checked,lights:lights.checked,sensors:sensors.checked};
    try{render(await api('/api/fritzbox/smarthome/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}));notify(translate('FRITZ!Box Smart Home gespeichert.'))}catch(error){notify(String(error?.message||error),true)}
  }
  async function test(){
    testButton.disabled=true;
    try{const result=await api('/api/fritzbox/smarthome/test',{method:'POST'});render({settings:{enabled:enabled.checked,thermostats:thermostats.checked,outlets:outlets.checked,lights:lights.checked,sensors:sensors.checked},status:result});notify(result.connected?translate('FRITZ!Box Smart Home verbunden.'):translate('FRITZ!Box Smart Home konnte nicht verbunden werden.'),!result.connected)}catch(error){notify(String(error?.message||error),true)}finally{testButton.disabled=false}
  }
  async function refresh(){
    refreshButton.disabled=true;
    try{const result=await api('/api/fritzbox/smarthome/refresh',{method:'POST'});render({settings:{enabled:enabled.checked,thermostats:thermostats.checked,outlets:outlets.checked,lights:lights.checked,sensors:sensors.checked},status:result});notify(translate('FRITZ!Box Smart Home synchronisiert.'));if(globalThis.refreshLiveData)await globalThis.refreshLiveData()}catch(error){notify(String(error?.message||error),true)}finally{refreshButton.disabled=false}
  }
  enabled.addEventListener('change',setCategoryAvailability);
  form.addEventListener('submit',save);
  testButton?.addEventListener('click',test);
  refreshButton?.addEventListener('click',refresh);
  window.addEventListener('hashchange',()=>{if(location.hash==='#presence')void load()});
  document.addEventListener('salta:languagechange',()=>{void load()});
  globalThis.refreshFritzBoxSmartHomeStatus=load;
  void load();
})();
