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
  const token=()=>cfg().token||'';
  /* mark local edits as unsynced whenever the app writes muse.data (after boot) */
  let booted=false;const origSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){origSet.call(this,k,v);if(booted&&this===window.localStorage&&k==='muse.data'){origSet.call(this,LS.dirty,'1');status();}};
  const b64enc=s=>{const b=new TextEncoder().encode(s);let o='';for(let i=0;i<b.length;i+=0x8000)o+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(o)};
  const b64dec=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0)));
  const hdr=()=>({'Authorization':'Bearer '+token(),'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'});
  async function fetchRemote(){ /* -> {json, sha} */
    const r=await fetch(API+'?ref='+BRANCH+'&t='+Date.now(),{headers:hdr(),cache:'no-store'});
    if(r.status===404)return {json:null,sha:null};
    if(!r.ok)throw Error('GitHub '+r.status+(r.status===401?' · token invalid/expired':r.status===403?' · token lacks access':''));
    const meta=await r.json();let text;
    if(meta.content&&meta.encoding==='base64')text=b64dec(meta.content);
    else{const raw=await fetch(API+'?ref='+BRANCH,{headers:{...hdr(),Accept:'application/vnd.github.raw'},cache:'no-store'});if(!raw.ok)throw Error('GitHub raw '+raw.status);text=await raw.text();}
    return {json:JSON.parse(text),sha:meta.sha};
  }
  function adopt(j){ /* write remote board into localStorage before the app reads it */
    if(!j||j.app!=='muse'||!j.state||!Array.isArray(j.state.cards))throw Error('board.json is not a Muse board');
    origSet.call(localStorage,'muse.data',JSON.stringify(j.state));
    if(j.prefs){let s={};try{s=JSON.parse(get('muse.settings')||'{}')}catch{}const p={...j.prefs};delete p.apiKey;delete p.ytKey;origSet.call(localStorage,'muse.settings',JSON.stringify({...s,...p}));}
    if(j.drafts&&Object.keys(j.drafts).length)origSet.call(localStorage,'muse.disk.drafts',JSON.stringify(j.drafts));
    set(LS.at,j.exportedAt||'');set(LS.dirty,null);
  }
    booted=true;
  /* Board data is never fetched from this site. With a token it comes from the PRIVATE repo
     via the GitHub API; without one the page starts empty and asks for the token. */
  window.museBootRemote=async function(){
    try{
      const dirty=get(LS.dirty)==='1';
      let j=null,sha=null,src='';
      if(!token())return;
      try{({json:j,sha}=await fetchRemote());src='GitHub';}catch(e){say('GitHub load failed ('+e.message+') · using this device’s copy');console.warn(e);}
      if(!j)return;
      const newer=!get('muse.data')||(j.exportedAt||'')!==(get(LS.at)||'');
      if(!newer){if(sha)set(LS.sha,sha);return;}
      if(!dirty){
        if(sessionStorage.getItem('muse.gh.reloaded')===j.exportedAt)return; /* loop guard */
        sessionStorage.setItem('muse.gh.reloaded',j.exportedAt||'');
        adopt(j);if(sha)set(LS.sha,sha);location.reload();
      }else say('⚠ This device has unsaved edits AND a newer copy exists on '+src+'. “Save to GitHub” keeps this device’s version (you’ll be asked to confirm); ⚙ → “Load from GitHub” discards local edits.');
    }catch(e){console.warn('Remote check skipped',e);}
  };
  function payload(){
    const st=typeof state!=='undefined'?state:JSON.parse(get('muse.data')||'{}');
    let prefs={};try{prefs=typeof prefsForBackup==='function'?prefsForBackup():{}}catch{}
    prefs={...prefs};delete prefs.apiKey;delete prefs.ytKey;
    let drafts={};try{drafts=JSON.parse(get('muse.disk.drafts')||'{}')}catch{}
    return {app:'muse',version:1,exportedAt:new Date().toISOString(),state:st,prefs,drafts};
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
      if(!r.ok){const e=await r.json().catch(()=>({}));throw Error('GitHub '+r.status+' '+(e.message||''));}
      const j=await r.json();set(LS.sha,j.content.sha);set(LS.at,p.exportedAt);set(LS.dirty,null);
      say('Saved to GitHub ✓');
    }catch(e){say('⚠ '+e.message);console.warn(e);}
    finally{busy=false;status();}
  };
  window.museLoadFromGitHub=async function(){
    if(!token())return say('Paste a GitHub token first');
    if(get(LS.dirty)==='1'&&!confirm('Replace this device’s unsaved edits with the GitHub version?'))return;
    try{const {json,sha}=await fetchRemote();if(!json)return say('No board on GitHub yet');adopt(json);set(LS.sha,sha);location.reload();}catch(e){say('⚠ '+e.message);}
  };
  function say(m){if(typeof toast==='function')toast(m);else console.log(m);status();}
  function status(m){const el=document.getElementById('ghStatus');if(!el)return;el.textContent=m||(!token()?'GitHub sync off · edits saved on this device':get(LS.dirty)==='1'?'● Unsaved to GitHub':'✓ In sync with GitHub');const b=document.getElementById('ghSaveBtn');if(b)b.classList.toggle('gh-dirty',get(LS.dirty)==='1');}
  function openPanel(){document.getElementById('ghPanel')?.showModal?.();}
  function ui(){
    const css=document.createElement('style');css.textContent=`
#ghBar{position:fixed;right:12px;top:10px;z-index:9000;display:flex;gap:6px;align-items:center;font:12px system-ui;pointer-events:none}#ghBar>*{pointer-events:auto}
#ghBar button{min-height:40px;padding:0 12px;border-radius:20px;border:1px solid #cfd4dc;background:#fff;cursor:pointer;font:600 13px system-ui}
#ghBar .gh-dirty{background:#2f5d50;color:#fff;border-color:#2f5d50}
#ghStatus{background:#fffd;padding:3px 8px;border-radius:10px;color:#555}
#ghPanel{max-width:min(520px,94vw);border:1px solid #ccc;border-radius:12px;padding:18px;font:14px/1.5 system-ui}
#ghPanel input{width:100%;box-sizing:border-box;min-height:44px;font-size:16px;margin:4px 0 10px}
#ghPanel .row{display:flex;gap:8px;flex-wrap:wrap}#ghPanel .row button{min-height:44px;padding:0 14px}
#ghFab{display:none}
@media(max-width:600px){
 #ghBar{top:auto;bottom:calc(12px + env(safe-area-inset-bottom));left:10px;right:10px;justify-content:flex-end}#ghFab{order:-1;margin-right:auto}
 #ghStatus{display:none}
 #ghFab{display:block;width:56px;height:56px!important;border-radius:50%!important;font-size:28px!important;background:#2f5d50!important;color:#fff!important;border:none!important;box-shadow:0 4px 14px #0003}
 #capture{bottom:calc(84px + env(safe-area-inset-bottom))!important}
 button,.tbtn,.cbtn,select,.board-item,.zone-tab{min-height:40px}
 input,textarea,select{font-size:16px!important} /* stops iOS zoom-on-focus */
 #editModal .mbox,#itemModal .mbox{width:100vw!important;max-width:100vw!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important}
 .card .actions button{min-width:40px;min-height:40px}
 #topbar{flex-wrap:wrap}
}`;document.head.append(css);
    const bar=document.createElement('div');bar.id='ghBar';
    bar.innerHTML='<span id="ghStatus" role="status"></span><button id="ghSaveBtn" title="Commit data/board.json to GitHub">☁ Save to GitHub</button><button id="ghCfgBtn" title="GitHub sync settings" aria-label="GitHub sync settings">⚙</button><button id="ghFab" aria-label="Add idea">＋</button>';
    document.body.append(bar);
    const d=document.createElement('dialog');d.id='ghPanel';
    d.innerHTML='<h3 style="margin-top:0">GitHub sync</h3><p>Fine-grained token with <b>Contents: Read and write</b> on <b>'+OWNER+'/'+REPO+'</b> only. Stored only in this browser (localStorage), never committed.</p><label>GitHub token<input id="ghTok" type="password" autocomplete="off" placeholder="github_pat_…"></label><label>Anthropic API key (optional, for Claude features)<input id="ghAnth" type="password" autocomplete="off" placeholder="sk-ant-…"></label><label>YouTube Data API key (optional)<input id="ghYt" type="password" autocomplete="off" placeholder="AIza…"></label><div class="row"><button id="ghSaveCfg">Save settings</button><button id="ghLoad">Load from GitHub</button><button id="ghForget">Forget token</button><button id="ghClose">Close</button></div>';
    document.body.append(d);
    const S=()=>{try{return JSON.parse(get('muse.settings')||'{}')}catch{return {}}};
    d.addEventListener('close',()=>status());
    document.getElementById('ghCfgBtn').onclick=()=>{const s=typeof settings!=='undefined'?settings:S();ghTok.value=token();ghAnth.value=s.apiKey||'';ghYt.value=s.ytKey||'';d.showModal();};
    document.getElementById('ghClose').onclick=()=>d.close();
    document.getElementById('ghForget').onclick=()=>{set(LS.cfg,null);ghTok.value='';say('Token removed from this browser');};
    document.getElementById('ghLoad').onclick=()=>window.museLoadFromGitHub();
    document.getElementById('ghSaveCfg').onclick=async()=>{
      set(LS.cfg,JSON.stringify({token:ghTok.value.trim()}));
      if(typeof settings!=='undefined'){settings.apiKey=ghAnth.value.trim();settings.ytKey=ghYt.value.trim();if(typeof saveSettings==='function')saveSettings();const a=document.getElementById('apiKey');if(a)a.value=settings.apiKey;const y=document.getElementById('ytKey');if(y)y.value=settings.ytKey;}
      if(token()){try{const {sha}=await fetchRemote();if(sha&&!get(LS.sha))set(LS.sha,sha);say('GitHub connected ✓ · loading…');d.close();return window.museBootRemote();}catch(e){say('⚠ '+e.message);}}
      d.close();
    };
    document.getElementById('ghSaveBtn').onclick=()=>window.museSaveToGitHub();
    document.getElementById('ghFab').onclick=()=>{if(typeof museBeginCapture==='function')return museBeginCapture();const i=document.getElementById('captureInput');if(i){i.scrollIntoView({block:'end'});i.focus();}};
    status();
    if(!token()){const n=document.createElement('p');n.id='ghSetup';n.style.cssText='background:#fff7e6;border:1px solid #e8c36a;border-radius:8px;padding:10px;margin:0 0 10px';n.innerHTML='<b>Set up sync:</b> paste your GitHub token below to load your ideas from your private repo. Until then this device shows only what’s stored in this browser.';d.querySelector('h3').after(n);ghTok.value='';d.showModal();say('Tap ⚙ and paste your GitHub token to load your ideas');}
    window.addEventListener('beforeunload',e=>{if(token()&&get(LS.dirty)==='1'){e.preventDefault();e.returnValue='';}});
  }
  window.museGhUI=ui;
})();
