(function(){
  const COOKIE='salta_language';
  const MAX_AGE=60*60*24*365;
  const SUPPORTED=new Set(['auto','de','en']);
  const dictionaries=new Map();
  const originalText=new WeakMap();
  const originalAttributes=new WeakMap();
  let selection='auto';
  let active='de';
  let observer=null;

  const skipSelector='script,style,code,pre,[data-i18n-skip],.device h3,.device-room-title h2,.room-identity strong,.presence-target-title h3,.presence-target-device-name,.homekit-device-title strong,.homekit-device-room-head strong,.automation-card-title h3,.automation-room-badge,#deviceDialogTitle,#overviewPresenceDetail';

  function readCookie(){
    const prefix=`${COOKIE}=`;
    const entry=document.cookie.split('; ').find(value=>value.startsWith(prefix));
    const value=entry?decodeURIComponent(entry.slice(prefix.length)):'auto';
    return SUPPORTED.has(value)?value:'auto';
  }
  function writeCookie(value){
    const secure=location.protocol==='https:'?'; Secure':'';
    document.cookie=`${COOKIE}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  }
  function resolve(value){
    if(value==='de'||value==='en')return value;
    const candidates=Array.isArray(navigator.languages)&&navigator.languages.length?navigator.languages:[navigator.language||'de'];
    for(const language of candidates){const normalized=String(language).toLowerCase();if(normalized.startsWith('de'))return 'de';if(normalized.startsWith('en'))return 'en'}
    return 'de';
  }
  function locale(){return active==='en'?'en-US':'de-DE'}
  function interpolate(value,vars={}){return String(value).replace(/\{([a-zA-Z0-9_]+)\}/g,(_,key)=>vars[key]??`{${key}}`)}
  function getPath(object,path){return String(path).split('.').reduce((value,key)=>value&&typeof value==='object'?value[key]:undefined,object)}
  function t(key,vars={}){
    const current=dictionaries.get(active)||{};
    const fallback=dictionaries.get('de')||{};
    const value=getPath(current,key)??getPath(fallback,key)??key;
    return interpolate(value,vars);
  }
  function translateSource(source){
    const text=String(source??'');
    if(active==='de')return text;
    const dict=dictionaries.get(active)||{};
    const exact=dict.phrases?.[text];
    if(typeof exact==='string')return exact;
    for(const pattern of dict.patterns||[]){
      try{
        const regex=new RegExp(pattern.match,pattern.flags||'');
        if(regex.test(text))return text.replace(regex,pattern.replace);
      }catch{}
    }
    let translated=text;
    for(const [from,to] of Object.entries(dict.tokens||{}))translated=translated.split(from).join(to);
    return translated;
  }
  function shouldSkip(node){
    const element=node.nodeType===Node.ELEMENT_NODE?node:node.parentElement;
    return Boolean(element?.closest?.(skipSelector));
  }
  function translateTextNode(node){
    if(!node||node.nodeType!==Node.TEXT_NODE||shouldSkip(node))return;
    if(!originalText.has(node))originalText.set(node,node.nodeValue||'');
    const source=originalText.get(node)||'';
    if(!source.trim())return;
    const leading=source.match(/^\s*/)?.[0]||'';
    const trailing=source.match(/\s*$/)?.[0]||'';
    const core=source.trim();
    const next=`${leading}${translateSource(core)}${trailing}`;
    if(node.nodeValue!==next)node.nodeValue=next;
  }
  function translateAttributes(element){
    if(!(element instanceof Element)||shouldSkip(element))return;
    const names=['placeholder','title','aria-label'];
    let saved=originalAttributes.get(element);
    if(!saved){saved={};originalAttributes.set(element,saved)}
    for(const name of names){
      if(!element.hasAttribute(name))continue;
      if(!(name in saved))saved[name]=element.getAttribute(name)||'';
      element.setAttribute(name,translateSource(saved[name]));
    }
  }
  function translateSubtree(root=document.documentElement){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){translateTextNode(root);return}
    if(root instanceof Element)translateAttributes(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      if(node.nodeType===Node.TEXT_NODE)translateTextNode(node);
      else translateAttributes(node);
    }
  }
  function syncSelectors(){
    for(const id of ['languageSelector','appearanceLanguage','loginLanguage']){
      const select=document.getElementById(id);
      if(select&&select.value!==selection)select.value=selection;
    }
  }
  function applyLanguage(value,{persist=true,announce=false}={}){
    selection=SUPPORTED.has(value)?value:'auto';
    active=resolve(selection);
    if(persist)writeCookie(selection);
    document.documentElement.lang=active;
    document.documentElement.dataset.language=active;
    syncSelectors();
    translateSubtree(document.documentElement);
    document.dispatchEvent(new CustomEvent('salta:languagechange',{detail:{selection,language:active,locale:locale()}}));
    if(announce&&globalThis.notify)globalThis.notify(t('language.changed',{language:t(`language.${selection}`)}));
    return active;
  }
  function bindSelector(element){
    if(!element)return;
    element.value=selection;
    element.addEventListener('change',()=>applyLanguage(element.value,{persist:true,announce:true}));
  }
  function formatNumber(value,options={}){return new Intl.NumberFormat(locale(),options).format(value)}
  function formatDate(value,options={dateStyle:'short',timeStyle:'short'}){
    const date=value instanceof Date?value:new Date(value);
    return Number.isNaN(date.getTime())?'–':new Intl.DateTimeFormat(locale(),options).format(date);
  }
  async function loadDictionary(language){
    if(dictionaries.has(language))return dictionaries.get(language);
    const response=await fetch(`/i18n/${language}.json`,{credentials:'same-origin',headers:{accept:'application/json'}});
    if(!response.ok)throw new Error(`i18n ${language} HTTP ${response.status}`);
    const value=await response.json();dictionaries.set(language,value);return value;
  }
  async function init(){
    selection=readCookie();active=resolve(selection);
    await Promise.all([loadDictionary('de'),loadDictionary('en')]);
    document.documentElement.lang=active;
    document.documentElement.dataset.language=active;
    translateSubtree(document.documentElement);
    syncSelectors();
    if(!observer){
      observer=new MutationObserver(records=>{
        for(const record of records){
          if(record.type==='characterData')translateTextNode(record.target);
          for(const node of record.addedNodes)translateSubtree(node);
        }
      });
      observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
    }
    return active;
  }
  function language(){return active}
  function selectedLanguage(){return selection}

  globalThis.SaltaI18n={init,t,translateSource,translateSubtree,applyLanguage,bindSelector,formatNumber,formatDate,locale,language,selectedLanguage};
})();
