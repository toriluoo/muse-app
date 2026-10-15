/* Muse ⇄ GitHub sync.
   - Board data lives in data/board.json in the PRIVATE repo toriluoo/muse and is read/written
     only through the GitHub API with your token (never fetched from this public site).
   - Every edit autosaves to localStorage (muse.data) as before.
   - "Save to GitHub" commits data/board.json via the REST contents API using a
     fine-grained token stored ONLY in this browser's localStorage (muse.gh). */
(function(){
  const OWNER='toriluoo', REPO='muse', PATH='data/board.json', BRANCH='main';
  const API='https://api.github.com/repos/'+OWNER+'/'+REPO+'/contents/'+PATH;
  const LS={cfg:'muse.gh',sha:'muse.gh.sha',dirty:'muse.gh.dirty',at:'muse.gh.remoteAt'};
  const get=k=>{try{return localStorage.getItem(k)}catch{return null}};
  const set=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch{}};
  const cfg=()=>{try{return JSON.parse(get(LS.cfg)||'{}')}catch{return {}}};
  const cleanTok=t=>String(t||'').replace(/^\s*(bearer|token)\s+/i,'').replace(/[\s"'<>]/g,'');
  const token=()=>cleanTok(cfg().token);
  /* mark local edits as unsynced whenever the app writes muse.data (after boot) */
  let booted=false;const origSet=Storage.prototype.setItem;
  const fp=v=>{v=String(v||'').replace(/"activeBoard":"[^"]*",?/,'');let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36)+':'+v.length};
  let baseFp=null; /* fingerprint of the board as last loaded/saved; switching boards alone is not an edit */
  Storage.prototype.setItem=function(k,v){origSet.call(this,k,v);if(booted&&this===window.localStorage&&k==='muse.v2'){origSet.call(this,LS.dirty,'1');status();}
    if(booted&&this===window.localStorage&&k==='muse.data'&&baseFp!==null){const d=fp(v)!==baseFp;if(d)origSet.call(this,LS.dirty,'1');else this.removeItem(LS.dirty);status();}};
  const b64enc=s=>{const b=new TextEncoder().encode(s);let o='';for(let i=0;i<b.length;i+=0x8000)o+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(o)};
  const b64dec=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0)));
  const hdr=()=>({'Authorization':'Bearer '+token(),'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'});
  function httpMsg(st,body){
    if(st===401)return 'GitHub said 401: the token is invalid or expired. Create a new fine-grained token and paste it again.';
    if(st===403)return /rate limit/i.test(body)?'GitHub rate limit reached. Wait a few minutes and try again.':'GitHub said 403: this token lacks access to '+OWNER+'/'+REPO+'. Give it Repository access → '+OWNER+'/'+REPO+' and Contents: Read and write.';
    if(st===404)return 'GitHub said 404: the token can’t see '+OWNER+'/'+REPO+'/'+PATH+'. Fine-grained tokens return 404 for repos they weren’t given: set Resource owner = '+OWNER+', Only select repositories → '+OWNER+'/'+REPO+', Contents: Read and write.';
    return 'GitHub error '+st+(body?': '+String(body).slice(0,140):'');
  }
  async function fetchRemote(){ /* -> {json, sha} */
    const r=await fetch(API+'?ref='+BRANCH+'&t='+Date.now(),{headers:hdr(),cache:'no-store'});
    if(!r.ok)throw Error(httpMsg(r.status,await r.text().catch(()=>'')));
    const meta=await r.json();let text;
    if(meta.content&&meta.encoding==='base64')text=b64dec(meta.content);
    else{const raw=await fetch(API+'?ref='+BRANCH,{headers:{...hdr(),Accept:'application/vnd.github.raw'},cache:'no-store'});if(!raw.ok)throw Error(httpMsg(raw.status,''));text=await raw.text();}
    let json;try{json=JSON.parse(text);}catch(e){throw Error('board.json on GitHub is not valid JSON ('+e.message+')');}
    return {json,sha:meta.sha};
  }
  function adopt(j){ /* write remote board into localStorage before the app reads it */
    if(!j||j.app!=='muse'||!j.state||!Array.isArray(j.state.cards))throw Error('board.json is not a Muse board');
    try{origSet.call(localStorage,'muse.data',JSON.stringify(j.state));}catch(e){throw Error('This browser’s storage is full or blocked (private mode?), so the board can’t be stored. Free space or use a normal window.');}
    if(j.prefs){let s={};try{s=JSON.parse(get('muse.settings')||'{}')}catch{}const p={...j.prefs};delete p.apiKey;delete p.ytKey;origSet.call(localStorage,'muse.settings',JSON.stringify({...s,...p}));}
    {let v={};try{v=JSON.parse(get('muse.v2')||'{}')}catch{}let any=false;for(const k of ['tracker','inspo','planner','incidents','ideaWorkshop'])if(j[k]!==undefined){v[k]=j[k];any=true;}if(any)origSet.call(localStorage,'muse.v2',JSON.stringify(v));}
    if(j.drafts&&Object.keys(j.drafts).length)origSet.call(localStorage,'muse.disk.drafts',JSON.stringify(j.drafts));
    set(LS.at,j.exportedAt||'');set(LS.dirty,null);
  }
    booted=true;
  /* Board data is never fetched from this site. With a token it comes from the PRIVATE repo
     via the GitHub API; without one the page starts empty and asks for the token. */
  const localEmpty=()=>{try{const d=JSON.parse(get('muse.data')||'{}');return !(d.cards&&d.cards.length);}catch{return true;}};
  function adoptAndReload(j,sha){adopt(j);if(sha)set(LS.sha,sha);
    const n=(j.state.cards||[]).length;sessionStorage.setItem('muse.gh.flash','Loaded '+n+' idea'+(n===1?'':'s')+' from GitHub ✓');location.reload();}
  /* explicit=true when the user just saved a token or tapped Reload: always report the outcome */
  window.museBootRemote=async function(explicit){
    if(!token()){if(explicit)msg('Paste your GitHub token first.','err');return false;}
    const dirty=get(LS.dirty)==='1'&&!localEmpty();
    let j,sha;
    try{msg('Loading your board from GitHub…','busy');({json:j,sha}=await fetchRemote());}
    catch(e){console.warn(e);msg(e.message,'err');if(!explicit)say('⚠ '+e.message);return false;}
    const newer=localEmpty()||(j.exportedAt||'')!==(get(LS.at)||'');
    if(!newer&&!explicit){if(sha)set(LS.sha,sha);msg('');return true;}
    if(dirty&&!confirm('This device has changes not yet saved to GitHub.\n\nOK = replace them with the GitHub version.\nCancel = keep this device’s version (then tap “Save to GitHub”).')){msg('Kept this device’s version. Tap “Save to GitHub” to upload it.','ok');return false;}
    if(!explicit&&sessionStorage.getItem('muse.gh.reloaded')===j.exportedAt){msg('');return false;}
    sessionStorage.setItem('muse.gh.reloaded',j.exportedAt||'');
    try{msg('Loaded '+(j.state?.cards||[]).length+' ideas · refreshing…','busy');adoptAndReload(j,sha);}catch(e){msg(e.message,'err');say('⚠ '+e.message);return false;}
    return true;
  };
  function payload(){
    const st=typeof state!=='undefined'?state:JSON.parse(get('muse.data')||'{}');
    let prefs={};try{prefs=typeof prefsForBackup==='function'?prefsForBackup():{}}catch{}
    prefs={...prefs};delete prefs.apiKey;delete prefs.ytKey;
    let drafts={};try{drafts=JSON.parse(get('muse.disk.drafts')||'{}')}catch{}
    let v2={};try{v2=JSON.parse(get('muse.v2')||'{}')}catch{}
    const out={app:'muse',version:1,exportedAt:new Date().toISOString(),state:st,prefs,drafts};for(const k of ['tracker','inspo','planner','incidents','ideaWorkshop'])if(v2[k]!==undefined)out[k]=v2[k];return out;
  }
  let busy=false;
  window.museSaveToGitHub=async function(force){
    if(!token()){openPanel();return say('Paste a GitHub token first');}
    if(typeof safeMode!=='undefined'&&safeMode)return say('Saving paused · recover data first');
    if(busy)return;busy=true;status('Saving to GitHub…');
    try{
      const p=payload();const body=JSON.stringify(p);
      const put=sha=>fetch(API,{method:'PUT',headers:{...hdr(),'Content-Type':'application/json'},body:JSON.stringify({message:'Muse: update board ('+(navigator.userAgent.match(/iPhone|iPad|Android/)?.[0]||'desktop')+')',content:b64enc(body),branch:BRANCH,...(sha?{sha}:{})})});
      let sha=get(LS.sha);let r=await put(sha);
      if(r.status===409||r.status===422){ /* sha mismatch: someone (other device) saved since we loaded */
        const remote=await fetchRemote();
        if(!force&&!confirm('GitHub has a newer board (saved from another device'+(remote.json?.exportedAt?' at '+new Date(remote.json.exportedAt).toLocaleString():'')+').\n\nOK = overwrite it with THIS device’s version.\nCancel = keep GitHub’s version (use ⚙ → Load from GitHub).')){set(LS.sha,remote.sha);throw Error('Not saved · newer version on GitHub');}
        r=await put(remote.sha);
      }
      if(!r.ok){const e=await r.text().catch(()=>'');throw Error(r.status===404||r.status===403?httpMsg(r.status,e)+' (saving needs Contents: Read and write)':httpMsg(r.status,e));}
      const j=await r.json();set(LS.sha,j.content.sha);set(LS.at,p.exportedAt);set(LS.dirty,null);baseFp=fp(get('muse.data'));
      say('Saved to GitHub ✓');
    }catch(e){say('⚠ '+e.message);msg(e.message,'err');console.warn(e);}
    finally{busy=false;status();}
  };
  window.museLoadFromGitHub=()=>window.museBootRemote(true);
  let lastErr='';function msg(t,kind){lastErr=kind==='err'?t:(kind==='ok'||!t?'':lastErr);status();const el=document.getElementById('ghMsg');if(el){el.textContent=t||'';el.dataset.kind=kind||'';el.hidden=!t;el.setAttribute('role',kind==='err'?'alert':'status');}
    document.querySelectorAll('#ghSaveCfg,#ghLoad').forEach(b=>{b.disabled=kind==='busy';b.setAttribute('aria-busy',kind==='busy'?'true':'false');});
    if(t&&!document.getElementById('ghPanel')?.open&&kind!=='busy'&&typeof toast==='function')toast(t);}
  function say(m){if(typeof toast==='function')toast(m);else console.log(m);status();}
  function status(m){
    const el=document.getElementById('ghStatus');if(!el)return;const dirty=get(LS.dirty)==='1';
    const narrow=matchMedia('(max-width:800px)').matches;el.textContent=m&&!narrow?m:(lastErr&&token()?(narrow?'Sync error':'Sync error · open ⚙'):!token()?(narrow?'Local only':'Not syncing · saved on this device only'):dirty?(narrow?'Unsaved':'Unsaved changes'):(narrow?'Saved':'All changes saved'));if(m)el.title=m;
    el.dataset.state=lastErr&&token()?'dirty':!token()?'off':dirty?'dirty':'ok';
    const b=document.getElementById('ghSaveBtn');if(b){b.classList.toggle('gh-dirty',dirty);b.setAttribute('aria-label',dirty?'Save to GitHub — unsaved changes':'Save to GitHub');}
  }
  function openPanel(){const d=document.getElementById('ghPanel');if(d&&!d.open){d._ret=document.activeElement;d.showModal();}}
  /* ---------- accessibility + UX layer (no data/schema changes) ---------- */
  const rgb=s=>{const m=String(s).match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return [p[0],p[1],p[2],p[3]==null?1:p[3]];};
  const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]);};
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
  function a11yFix(root){
    root=root||document;
    root.querySelectorAll('img').forEach(i=>{if(i.hasAttribute('alt')&&!i.alt.trim())i.alt='';if(!i.hasAttribute('alt'))i.alt='';});
    root.querySelectorAll('a[href]').forEach(a=>{if(a.hasAttribute('aria-label')||a.textContent.trim())return;const img=a.querySelector('img[alt]:not([alt=""])');if(img)return;let h='';try{h=new URL(a.href).hostname.replace(/^www\./,'')}catch{}a.setAttribute('aria-label','Open link'+(h?' on '+h:''));});
    root.querySelectorAll('iframe:not([title])').forEach(f=>f.title='Embedded post');
    root.querySelectorAll('button').forEach(b=>{if(b.hasAttribute('aria-label')||b.textContent.trim()&&!/^[\W\d_]{1,3}$/u.test(b.textContent.trim()))return;const t=b.title||{'✕':'Close','×':'Close','⋯':'More options','↺':'Clear','⚙':'Settings','←':'Move left','→':'Move right'}[b.textContent.trim()];if(t)b.setAttribute('aria-label',t);});
    root.querySelectorAll('select[title]:not([aria-label])').forEach(x=>x.setAttribute('aria-label',x.title));
    root.querySelectorAll('input:not([type=hidden]):not([aria-label]),textarea:not([aria-label]),select:not([aria-label])').forEach(x=>{if(x.labels&&x.labels.length)return;const t=x.title||x.placeholder;if(t)x.setAttribute('aria-label',t.replace(/…$/,''));});
    root.querySelectorAll('header.voice-head,dialog header,section header,article header').forEach(h=>{if(!h.hasAttribute('role'))h.setAttribute('role','group');});
    /* user-chosen label/stage colours: darken text until it meets 4.5:1 on its background */
    root.querySelectorAll('[style*="color"]').forEach(el=>{if(!el.textContent.trim()||el.dataset.cfix)return;el.dataset.cfix='1';const cs=getComputedStyle(el);const fg=rgb(cs.color);if(!fg)return;let n=el,bg=null;while(n&&n.nodeType===1){const b=rgb(getComputedStyle(n).backgroundColor);if(b&&b[3]>0.9){bg=b;break;}n=n.parentElement;}bg=bg||[255,255,255,1];
      if(lum(bg)<0.4)return;let c=fg.slice(0,3),i=0;while(ratio(c,bg)<4.5&&i++<20)c=c.map(v=>Math.round(v*0.88));if(i)el.style.color='rgb('+c.join(',')+')';});
    const vp=document.getElementById('voicePreview');if(vp&&!vp.hasAttribute('tabindex'))vp.tabIndex=0;
    const sm=document.querySelector('#workspaceTools>summary');if(sm&&sm.getAttribute('aria-label')&&!sm.getAttribute('aria-label').startsWith(sm.textContent.trim()))sm.setAttribute('aria-label',sm.textContent.trim()+': Plan, Published and settings');
  }
  const MODAL_SEL='[id$="Modal"].open,.modal.open,.os-workspace.open,#menuPop.open';
  function topModal(){const all=[...document.querySelectorAll(MODAL_SEL)].filter(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed');return all[all.length-1]||null;}
  function closeEl(m){
    const btn=[...m.querySelectorAll('button,[data-os-action="close"]')].find(b=>b.offsetParent!==null&&(/^(✕|×|close|cancel|done|back to workspace|close dialog)$/i.test((b.getAttribute('aria-label')||b.textContent).trim())||b.dataset.osAction==='close'));
    if(btn)btn.click();else m.classList.remove('open');
  }
  const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),summary';
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!document.querySelector('dialog[open]')){
      const cap=document.getElementById('capture');if(document.body.classList.contains('gh-capturing')&&cap&&cap.contains(document.activeElement)){document.body.classList.remove('gh-capturing');document.getElementById('ghFab')?.focus();return;}
      const ae=document.activeElement;if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)||ae?.isContentEditable){if(topModal()?.classList.contains('os-workspace')){ae.blur();return;}}
      const m=topModal();if(m){e.preventDefault();closeEl(m);}
    }
    if(e.key==='Tab'){const m=document.querySelector('dialog[open]')||topModal();if(!m||m.id==='menuPop')return;const f=[...m.querySelectorAll(FOCUSABLE)].filter(x=>x.offsetParent!==null);if(!f.length)return;
      if(!m.contains(document.activeElement)){e.preventDefault();f[0].focus();return;}
      if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus();}else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus();}}
  },true);
  function ui(){
    const css=document.createElement('style');css.id='museUxCss';css.textContent=`
:root{--gh-green:#2f5d50}
.sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
:focus-visible{outline:3px solid #2f5d50!important;outline-offset:2px!important;border-radius:4px}
#skipLink{position:fixed;left:8px;top:-60px;z-index:10001;background:#1f2320;color:#fff;padding:10px 14px;border-radius:6px;font:600 14px system-ui}#skipLink:focus{top:8px}
.utility-label{color:#4f5a6b!important}
/* sync bar: bottom-right pill on desktop, clear of the top toolbar */
#ghBar{display:flex;gap:6px;align-items:center;font:13px/1.2 system-ui,sans-serif;flex-shrink:0}#workspaceStorageNote{display:none!important}
#ghBar button,#ghBar span{white-space:nowrap}
#ghBar button{min-height:40px;min-width:40px;padding:0 12px;border-radius:6px;border:1px solid #c4cad4;background:#fff;color:#1f2320;cursor:pointer;font:600 14px system-ui,sans-serif;display:inline-flex;align-items:center;gap:6px}
#ghBar button:hover{background:#f1f3f6}
#ghSaveBtn.gh-dirty{background:var(--gh-green);color:#fff;border-color:var(--gh-green)}#ghSaveBtn.gh-dirty:hover{background:#244a40}
#ghStatus{padding:0 6px 0 10px;color:#3d4554;display:flex;align-items:center;gap:6px;white-space:nowrap}
#ghStatus::before{content:"";width:8px;height:8px;border-radius:50%;background:#8a94a6}
#ghStatus[data-state=ok]::before{background:#2f8a5f}#ghStatus[data-state=dirty]::before{background:#c26a12}
#ghBar #ghFab{display:none}
#ghPanel{width:min(520px,94vw);box-sizing:border-box;border:none;border-radius:14px;padding:22px;font:15px/1.5 system-ui,sans-serif;color:#1f2320;box-shadow:0 20px 60px #0004}
#ghPanel::backdrop{background:#1f232066}
#ghPanel h2{margin:0 0 6px;font:600 20px/1.3 system-ui,sans-serif}
#ghPanel p{margin:0 0 14px;color:#3d4554}
#ghPanel label{display:block;font-weight:600;font-size:14px;margin-top:10px}
#ghPanel input{display:block;width:100%;box-sizing:border-box;min-height:44px;font-size:16px;margin:6px 0 2px;padding:8px 12px;border:1px solid #9aa3b2;border-radius:8px}
#ghPanel .hint{font-weight:400;color:#4f5a6b;font-size:13px}
#ghMsg{margin:14px 0 0;padding:10px 12px;border-radius:8px;font-size:14px;line-height:1.45;background:#eef3fb;color:#1f2f4d}#ghMsg[data-kind=err]{background:#fdecea;color:#7d1d10;border:1px solid #e3a59a}#ghMsg[data-kind=ok]{background:#e7f4ec;color:#1d4a33}#ghMsg[data-kind=busy]::before{content:"";display:inline-block;width:12px;height:12px;margin-right:8px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:ghspin .8s linear infinite;vertical-align:-1px}@keyframes ghspin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){#ghMsg[data-kind=busy]::before{animation:none}}
#ghPanel button:disabled{opacity:.6;cursor:progress}
#ghPanel .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
#ghPanel .row button{min-height:44px;padding:0 16px;border-radius:8px;border:1px solid #9aa3b2;background:#fff;color:#1f2320;font:600 14px system-ui,sans-serif;cursor:pointer}
#ghPanel .row .primary{background:var(--gh-green);border-color:var(--gh-green);color:#fff}
#ghPanel .row .danger{color:#a2321f;border-color:#d9a69c}
#ghPanel .row .spacer{flex:1}
#ghPanel .x{position:absolute;right:10px;top:10px;min-width:44px;min-height:44px;border:none;background:none;font-size:22px;cursor:pointer;color:#3d4554}
#boardScroll{padding-bottom:220px}
@media(max-width:800px){
 #ghBar{position:fixed;z-index:300;background:#fff;gap:8px;left:0;right:0;bottom:0;border-radius:0;border:none;border-top:1px solid #d5dae2;padding:8px 12px calc(8px + env(safe-area-inset-bottom));justify-content:flex-end;box-shadow:0 -4px 16px #24375a14}
 #ghStatus{margin-right:auto;font-size:12px;padding-left:2px}
 #ghBar button{min-height:44px;min-width:44px;border-radius:22px}
 #ghBar #ghFab{display:inline-flex;order:-2;background:var(--gh-green)!important;color:#fff!important;border-color:var(--gh-green)!important;font-size:15px!important}
 #ghFab~#ghStatus{margin-right:auto}
 body{padding-bottom:calc(64px + env(safe-area-inset-bottom))}
 #toast{bottom:calc(80px + env(safe-area-inset-bottom))!important;max-width:92vw;text-align:center}
 /* capture sheet only when asked for, so it doesn't cover the cards */
 #capture{bottom:calc(68px + env(safe-area-inset-bottom))!important;left:8px!important;right:8px!important;width:auto!important;transform:none!important;box-shadow:0 -6px 24px #24375a33}
 body:not(.gh-capturing) #capture{display:none!important}
 .muse-idea-editor .muse-editor-actions{bottom:calc(60px + env(safe-area-inset-bottom))!important}
 /* single scrolling row of workspaces instead of three wrapped rows */
 #workspaceNav{flex-wrap:nowrap!important;overflow-x:auto;width:100%!important;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:2px}
 #workspaceNav::-webkit-scrollbar{display:none}
 #workspaceNav button{flex:0 0 auto;white-space:nowrap}
 button,.tbtn,.cbtn,select,summary,.board-item,.zone-tab,#workspaceNav button{min-height:44px}
 .card a,.card button,.os-actions button{min-height:44px;display:inline-flex;align-items:center}.card .actions button{min-width:44px;justify-content:center}
 input,textarea,select{font-size:16px!important}
 #editModal .mbox,#itemModal .mbox{width:100vw!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important}
 #topbar{flex-wrap:wrap}
}
@media(prefers-reduced-motion:reduce){#ghBar *,#ghPanel{transition:none!important;animation:none!important}}`;document.head.append(css);
    /* landmarks + headings */
    const skip=document.createElement('a');skip.id='skipLink';skip.href='#main';skip.textContent='Skip to content';document.body.prepend(skip);
    const main=document.getElementById('main')||document.querySelector('main');if(main){if(!main.id)main.id='main';main.tabIndex=-1;}
    if(!document.querySelector('h1.sr-only')){const h=document.createElement('h1');h.className='sr-only';h.textContent='Muse idea board';(main||document.body).prepend(h);}
    const sb=document.getElementById('sidebar');if(sb&&!sb.getAttribute('aria-label'))sb.setAttribute('aria-label','Workspaces');
    const t=document.getElementById('toast');if(t){t.setAttribute('role','status');t.setAttribute('aria-live','polite');}
    const bt=document.getElementById('boardTitle');if(bt)bt.setAttribute('aria-label','Board name');
    const ss=document.getElementById('sortSel');if(ss)ss.setAttribute('aria-label','Sort this board');
    const bar=document.createElement('div');bar.id='ghBar';bar.setAttribute('role','region');bar.setAttribute('aria-label','Sync');
    bar.innerHTML='<button id="ghFab" type="button">＋ <span>Add idea</span></button><span id="ghStatus" role="status" aria-live="polite"></span><button id="ghSaveBtn" type="button" title="Commit your board to your private GitHub repo">☁ <span>Save to GitHub</span></button><button id="ghCfgBtn" type="button" title="Sync & API key settings" aria-label="Sync settings">⚙</button>';
    const place=()=>{const narrow=matchMedia('(max-width:800px)').matches,tb=document.getElementById('topbar'),note=document.getElementById('workspaceStorageNote');
      const sbx=document.getElementById('sidebar');if(!narrow&&tb){if(bar.parentElement!==tb)tb.insertBefore(bar,note&&note.parentElement===tb?note:null);}else if(narrow&&sbx&&document.body.classList.contains('v2-on')){if(bar.parentElement!==sbx)sbx.insertBefore(bar,document.getElementById('v2More'));}else if(bar.parentElement!==document.body)document.body.append(bar);status();};window.museGhPlace=place;
    document.body.append(bar);place();matchMedia('(max-width:800px)').addEventListener('change',place);
    const d=document.createElement('dialog');d.id='ghPanel';d.setAttribute('aria-labelledby','ghPanelTitle');
    d.innerHTML='<button class="x" type="button" id="ghX" aria-label="Close">✕</button><h2 id="ghPanelTitle">Sync & keys</h2><p>Your ideas live in your private repo <b>'+OWNER+'/'+REPO+'</b>. Keys are stored only in this browser and never committed.</p><label for="ghTok">GitHub token <span class="hint">· fine-grained, Contents: Read and write on '+OWNER+'/'+REPO+'</span></label><input id="ghTok" type="password" autocomplete="off" placeholder="github_pat_…"><label for="ghAnth">Anthropic API key <span class="hint">· optional, for Claude features</span></label><input id="ghAnth" type="password" autocomplete="off" placeholder="sk-ant-…"><label for="ghYt">YouTube Data API key <span class="hint">· optional, for view counts</span></label><input id="ghYt" type="password" autocomplete="off" placeholder="AIza…"><p id="ghMsg" hidden></p><div class="row"><button id="ghSaveCfg" class="primary" type="button">Save</button><button id="ghLoad" type="button">Reload from GitHub</button><span class="spacer"></span><button id="ghForget" class="danger" type="button">Remove token</button></div>';
    document.body.append(d);
    const S=()=>{try{return JSON.parse(get('muse.settings')||'{}')}catch{return {}}};
    d.addEventListener('close',()=>{status();try{d._ret?.focus?.()}catch{}});
    document.getElementById('ghCfgBtn').onclick=()=>{const s=typeof settings!=='undefined'?settings:S();ghTok.value=token();ghAnth.value=s.apiKey||'';ghYt.value=s.ytKey||'';openPanel();};
    document.getElementById('ghX').onclick=()=>d.close();
    document.getElementById('ghForget').onclick=()=>{if(!confirm('Remove the GitHub token from this browser? Your ideas stay on GitHub.'))return;set(LS.cfg,null);ghTok.value='';say('Token removed from this browser');};
    document.getElementById('ghLoad').onclick=()=>window.museLoadFromGitHub();
    document.getElementById('ghSaveCfg').onclick=async e=>{
      e.preventDefault();
      const t=cleanTok(ghTok.value);ghTok.value=t;
      if(typeof settings!=='undefined'){settings.apiKey=ghAnth.value.trim();settings.ytKey=ghYt.value.trim();if(typeof saveSettings==='function')saveSettings();const a=document.getElementById('apiKey');if(a)a.value=settings.apiKey;const y=document.getElementById('ytKey');if(y)y.value=settings.ytKey;}
      if(!t){set(LS.cfg,null);msg('Settings saved. No GitHub token, so this device isn’t syncing.','ok');status();return;}
      if(!/^(github_pat_|ghp_|gho_|ghu_|ghs_)[A-Za-z0-9_]{20,}$/.test(t))return msg('That doesn’t look like a GitHub token. It should start with “github_pat_”. Copy it again from GitHub → Settings → Developer settings → Fine-grained tokens.','err');
      set(LS.cfg,JSON.stringify({token:t}));status();
      await window.museBootRemote(true);
    };
    document.getElementById('ghSaveBtn').onclick=()=>window.museSaveToGitHub();
    const fab=document.getElementById('ghFab');
    fab.onclick=()=>{document.body.classList.add('gh-capturing');if(typeof museBeginCapture==='function')museBeginCapture();setTimeout(()=>{const i=document.getElementById('captureInput');if(i){i.focus();}},50);};
    /* hide the mobile capture sheet again once it's empty and focus leaves it */
    document.addEventListener('focusout',()=>setTimeout(()=>{const c=document.getElementById('capture'),i=document.getElementById('captureInput');if(c&&!c.contains(document.activeElement)&&!(i&&i.value.trim()))document.body.classList.remove('gh-capturing');},150));
    baseFp=get(LS.dirty)==='1'?'':fp(get('muse.data'));
    a11yFix();let q=null;new MutationObserver(()=>{if(q)return;q=requestAnimationFrame(()=>{q=null;a11yFix();});}).observe(document.body,{childList:true,subtree:true});
    status();
    {const f=sessionStorage.getItem('muse.gh.flash');if(f){sessionStorage.removeItem('muse.gh.flash');setTimeout(()=>say(f),600);}}
    if(!token()){const n=document.createElement('p');n.id='ghSetup';n.style.cssText='background:#fff4dc;border:1px solid #c99a2e;border-radius:8px;padding:10px 12px;color:#3d2e05';n.innerHTML='<b>Connect your ideas:</b> paste your GitHub token below. Until then this device only shows what’s stored in this browser.';d.querySelector('h2').after(n);ghTok.value='';openPanel();say('Paste your GitHub token in Sync settings to load your ideas');}
    window.addEventListener('beforeunload',e=>{if(token()&&get(LS.dirty)==='1'){e.preventDefault();e.returnValue='';}});
  }
  window.museGhUI=ui;
})();
