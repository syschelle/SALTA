function diagnosticExportFilename(response){
  const disposition=response.headers.get('content-disposition')||'';
  const match=/filename="([^"]+)"/i.exec(disposition);
  return match?.[1]||`SALTA-diagnostic-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
}
async function exportSaltaDiagnostics(){
  const button=document.getElementById('diagnosticExportButton');
  const original=button?.innerHTML;
  if(button){button.disabled=true;button.innerHTML=`<span class="mdi mdi-loading mdi-spin" aria-hidden="true"></span>${typeof appTranslate==='function'?appTranslate('Export wird erstellt …'):'Export wird erstellt …'}`}
  try{
    const response=await fetch('/api/diagnostics/export',{method:'GET',credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'});
    if(!response.ok)throw new Error(`Diagnoseexport fehlgeschlagen (${response.status})`);
    const blob=await response.blob();
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=diagnosticExportFilename(response);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    if(typeof notify==='function')notify(typeof appTranslate==='function'?appTranslate('Sanitisierter Diagnoseexport wurde erstellt.'):'Sanitisierter Diagnoseexport wurde erstellt.');
  }catch(error){
    if(typeof notify==='function')notify(error?.message||(typeof appTranslate==='function'?appTranslate('Diagnoseexport konnte nicht erstellt werden.'):'Diagnoseexport konnte nicht erstellt werden.'),true);
    else alert(error?.message||'Diagnoseexport konnte nicht erstellt werden.');
  }finally{
    if(button){button.disabled=false;if(original!==undefined)button.innerHTML=original}
  }
}
globalThis.exportSaltaDiagnostics=exportSaltaDiagnostics;
