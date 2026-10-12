/* Muse v2 shell: five main tabs (Tracker · Ideas · Voice · Inspo · Planner) + More.
   Adds new top-level board.json keys only: tracker, inspo, planner, incidents, ideaWorkshop.
   Stored locally under localStorage "muse.v2"; gh-sync.js commits them with the board.
   Existing views (Studio, Library, boards, Strategy map, Video Inspo, Plan, Published,
   My voice, North Star, Journey, Tools) are untouched and reachable from Voice or More. */
(function(){
'use strict';
const KEY='muse.v2';
const E=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const say=m=>{try{toast(m)}catch{console.log(m)}};
const fmtN=n=>n==null||n===''||isNaN(n)?'—':Number(n)>=1e6?(n/1e6).toFixed(1).replace(/\.0$/,'')+'M':Number(n)>=1e4?Math.round(n/1e3)+'K':Number(n).toLocaleString();
const fmtD=d=>{if(!d)return '';const x=new Date(/^\d{4}-\d\d-\d\d$/.test(d)?d+'T00:00':d);return isNaN(x)?String(d):x.toLocaleDateString(undefined,{month:'short',day:'numeric',year:x.getFullYear()!==new Date().getFullYear()?'numeric':undefined});};
const safeUrl=u=>/^https?:\/\//i.test(String(u||''))?String(u):'';
const platformOfUrl=u=>/instagram\.com/.test(u)?'IG':/(x|twitter)\.com/.test(u)?'X':/linkedin\.com/.test(u)?'LinkedIn':/tiktok\.com/.test(u)?'TikTok':/youtu\.?be/.test(u)?'YouTube':/xiaohongshu|xhslink/.test(u)?'RedNote':/pinterest\./.test(u)?'Pinterest':'Other';
const ytThumb=u=>{const m=String(u).match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/);return m?'https://img.youtube.com/vi/'+m[1]+'/mqdefault.jpg':'';};

/* ---------------- store ---------------- */
const DEFAULT=()=>({
  tracker:{version:1,accounts:[{id:'newwave',name:'NewWave',handle:''},{id:'personal',name:'Personal',handle:'@toriluoo'}],posts:[],updatedAt:null},
  inspo:[], planner:{version:1,items:[],syncedAt:null}, incidents:[], ideaWorkshop:{}
});
function load(){let d={};try{d=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}const b=DEFAULT();
  return {tracker:Object.assign(b.tracker,d.tracker||{}),inspo:Array.isArray(d.inspo)?d.inspo:[],planner:Object.assign(b.planner,d.planner||{}),incidents:Array.isArray(d.incidents)?d.incidents:[],ideaWorkshop:d.ideaWorkshop&&typeof d.ideaWorkshop==='object'?d.ideaWorkshop:{}};}
let V=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(V));}catch(e){say('⚠ Could not save on this device (storage full?)');}}
window.museV2={get:()=>V,reload:()=>{V=load();render();},keys:['tracker','inspo','planner','incidents','ideaWorkshop']};
const ws=cid=>{const w=V.ideaWorkshop[cid]||(V.ideaWorkshop[cid]={});w.scripts=w.scripts||[];w.visualRefs=w.visualRefs||[];w.examples=w.examples||[];w.notes=w.notes||[];return w;};

/* ---------------- shell ---------------- */
const TABS=[
 ['tracker','Tracker','M4 19V9M10 19V5M16 19v-7M22 19H2'],
 ['ideas','Ideas','M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z'],
 ['voice','Voice','M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3'],
 ['inspo','Inspo','M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z'],
 ['planner','Planner','M4 6h16v14H4zM4 10h16M9 3v4M15 3v4']];
const icon=p=>'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+p+'"/></svg>';
let tab=localStorage.getItem('muse.v2.tab')||'ideas', sub={tracker:{acct:'all',plat:'all',view:'gallery',sort:'postedAt',dir:-1},ideas:{q:'',board:'all',status:'all',open:null},planner:{acct:'all',view:'week',anchor:null}};
let root,nav,moreBtn,moreMenu;

function css(){const s=document.createElement('style');s.id='museV2Css';s.textContent=`
#v2Tabs{display:grid;gap:4px;margin:4px 0 18px}
#v2Tabs button,#v2More{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:10px 10px;border:0;border-radius:6px;background:none;color:#4f5869;font:600 13px/1.2 var(--ui,system-ui);text-align:left;cursor:pointer}
#v2Tabs button svg,#v2More svg{width:18px;height:18px;flex-shrink:0;stroke:currentColor;stroke-width:1.6;fill:none;stroke-linecap:round;stroke-linejoin:round}
#v2Tabs button:hover,#v2More:hover{background:#e9ecf1}
#v2Tabs button[aria-current=page]{background:#fff;color:#1f2320;box-shadow:inset 3px 0 0 var(--danger,#b4432f)}
#v2More{margin-top:6px;border-top:1px solid #dfe3ea;border-radius:0;padding-top:14px}
#v2MoreMenu{position:fixed;z-index:500;min-width:230px;max-height:70vh;overflow:auto;background:#fff;border:1px solid #d5dae2;border-radius:10px;box-shadow:0 12px 40px #24375a2e;padding:6px;display:none}
#v2MoreMenu.open{display:block}
#v2MoreMenu button{display:block;width:100%;min-height:44px;text-align:left;border:0;background:none;padding:10px 12px;border-radius:6px;font:14px var(--ui,system-ui);color:#303747;cursor:pointer}
#v2MoreMenu button:hover{background:#f1f3f6}#v2MoreMenu .grp{font:700 11px var(--ui,system-ui);letter-spacing:.08em;text-transform:uppercase;color:#5d6676;padding:10px 12px 4px}
.v2-on #workspaceNav,.v2-on #workspaceTools{display:none!important}
.v2-mode #main>*:not(#topbar):not(#v2View):not(h1.sr-only){display:none!important}
.v2-mode #capture{display:none!important}
#v2View{display:none;overflow:auto;flex:1;min-height:0;padding:8px 36px 120px;font-family:var(--sans)}
.v2-mode #v2View{display:block}
.v2h{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px 18px;margin:6px 0 18px}
.v2h h2{font:400 clamp(28px,3vw,38px)/1.15 var(--serif);margin:0;color:#1f2320;letter-spacing:-.01em}
.v2h p{margin:4px 0 0;color:#525c6c;font-size:14px;max-width:60ch}
.v2h .sp{flex:1}
.v2-seg{display:inline-flex;flex-wrap:wrap;gap:4px;background:#eceef2;border-radius:8px;padding:3px}
.v2-seg button{min-height:40px;padding:0 14px;border:0;border-radius:6px;background:none;font:600 13px var(--ui,system-ui);color:#4f5869;cursor:pointer}
.v2-seg button[aria-pressed=true]{background:#fff;color:#1f2320;box-shadow:0 1px 3px #0002}
.v2-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 16px}
.v2-chip{white-space:nowrap;flex-shrink:0;min-height:36px;padding:0 12px;border:1px solid #cfd5de;border-radius:18px;background:#fff;font:600 12px var(--ui,system-ui);color:#4f5869;cursor:pointer}
.v2-chip[aria-pressed=true]{background:#1f2320;color:#fff;border-color:#1f2320}
.v2-btn{min-height:40px;padding:0 14px;border:1px solid #c4cad4;border-radius:6px;background:#fff;color:#1f2320;font:600 13px var(--ui,system-ui);cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.v2-btn:hover{background:#f3f4f7}.v2-btn.primary{background:var(--danger,#b4432f);border-color:var(--danger,#b4432f);color:#fff}.v2-btn.primary:hover{background:#963826}
.v2-btn.ghost{border-color:transparent;background:none;color:#4f5869}
.v2-in{min-height:44px;padding:8px 12px;border:1px solid #b9c0cb;border-radius:6px;background:#fff;font:15px var(--sans);color:#1f2320;box-sizing:border-box}
textarea.v2-in{width:100%;min-height:96px;resize:vertical;line-height:1.5}
.v2-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.v2-card{position:relative;background:#fff;border-radius:10px;border-top:3px solid var(--edge,#3a7ca5);box-shadow:var(--shadow);padding:16px 18px;display:flex;flex-direction:column;gap:8px;text-align:left;font:inherit;color:inherit;border-left:0;border-right:0;border-bottom:0;cursor:pointer;min-width:0}
.v2-card:hover{box-shadow:var(--shadow-lift)}
.v2-card h3{font:400 19px/1.3 var(--serif);margin:0;color:#1f2320;overflow-wrap:anywhere}
.v2-card .meta{font-size:12px;color:#5d6676;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.v2-card p{margin:0;color:#3d4554;font-size:14px;line-height:1.5;overflow-wrap:anywhere}
.v2-thumb{aspect-ratio:4/5;background:#e9ecf1 center/cover no-repeat;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#5d6676;font:600 12px var(--ui,system-ui);overflow:hidden}
.v2-thumb img{width:100%;height:100%;object-fit:cover}
.v2-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:12px;font:700 11px var(--ui,system-ui);background:#eef1f5;color:#3d4554}
.v2-pill.s-idea{background:#eef0ec;color:#4a5047}.v2-pill.s-scripting{background:#f8efdc;color:#7a5414}.v2-pill.s-filming{background:#e6eaf8;color:#33458c}.v2-pill.s-editing{background:#f2e7f6;color:#6b357c}.v2-pill.s-posted{background:#e3efe9;color:#24493e}
.v2-pill.pending{background:#fff1d6;color:#6d4a00}
.v2-empty{background:#fff;border:1px dashed #b9c0cb;border-radius:12px;padding:28px;text-align:center;color:#3d4554;max-width:640px;margin:10px auto}
.v2-empty h3{font:400 22px var(--serif);margin:0 0 8px;color:#1f2320}.v2-empty p{margin:0 auto 6px;max-width:52ch;line-height:1.55}
.v2-table-wrap{overflow:auto;background:#fff;border-radius:10px;box-shadow:var(--shadow)}
.v2-table{border-collapse:collapse;width:100%;font-size:13px;min-width:760px}
.v2-table th,.v2-table td{padding:10px 12px;border-bottom:1px solid #e6e9ee;text-align:left;vertical-align:middle;white-space:nowrap}
.v2-table td.t{white-space:normal;min-width:220px}
.v2-table th button{border:0;background:none;font:700 12px var(--ui,system-ui);color:#3d4554;cursor:pointer;min-height:36px;padding:0}
.v2-table td.n,.v2-table th.n{text-align:right}
.v2-charts{display:grid;grid-template-columns:2fr 1fr;gap:16px}
.v2-panel{background:#fff;border-radius:10px;box-shadow:var(--shadow);padding:16px 18px}
.v2-panel h3{font:600 14px var(--ui,system-ui);margin:0 0 10px;color:#1f2320}
.v2-sec{background:#fff;border-radius:10px;box-shadow:var(--shadow);padding:18px 20px;margin:0 0 16px;border-top:3px solid var(--edge,#d5dae2)}
.v2-sec>h3{font:400 21px var(--serif);margin:0 0 4px;color:#1f2320}.v2-sec>.hint{margin:0 0 12px;color:#525c6c;font-size:13px}
.v2-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.v2-list li{border:1px solid #e3e6eb;border-radius:8px;padding:10px 12px;display:grid;gap:6px}
.v2-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.v2-row .grow{flex:1;min-width:180px}
.v2-detail{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;align-items:start}
.v2-side{position:sticky;top:0;display:grid;gap:12px}
.v2-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.v2-day{background:#fff;border-radius:8px;min-height:110px;padding:8px;box-shadow:var(--shadow);font-size:12px;display:flex;flex-direction:column;gap:4px}
.v2-day.today{outline:2px solid var(--danger,#b4432f)}.v2-day .d{font:700 12px var(--ui,system-ui);color:#3d4554}.v2-day.out{opacity:.55}
.v2-ev{display:block;border-left:3px solid var(--edge,#3a7ca5);background:#f5f7fa;padding:4px 6px;border-radius:4px;color:#1f2320;text-decoration:none;overflow-wrap:anywhere}
dialog.v2-dlg{width:min(620px,94vw);max-height:90vh;border:0;border-radius:14px;padding:22px;box-shadow:0 20px 60px #0004;font:15px/1.5 var(--sans);color:#1f2320}
dialog.v2-dlg::backdrop{background:#1f232066}
dialog.v2-dlg h2{font:400 24px var(--serif);margin:0 0 12px}
dialog.v2-dlg label{display:block;font:600 13px var(--ui,system-ui);margin:12px 0 4px;color:#303747}
dialog.v2-dlg .v2-in{width:100%}
dialog.v2-dlg footer{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:18px}
.v2-hub{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-bottom:22px}
.v2-fab{display:none}
@media(max-width:800px){
 #v2Tabs{position:fixed;left:0;right:0;bottom:0;z-index:310;margin:0;display:grid;grid-template-columns:repeat(5,1fr);gap:0;background:#fff;border-top:1px solid #d5dae2;padding:4px 4px calc(4px + env(safe-area-inset-bottom));box-shadow:0 -4px 16px #24375a14;order:9}
 #v2Tabs button{flex-direction:column;gap:2px;justify-content:center;padding:6px 2px;font-size:11px;min-height:52px;text-align:center}
 #v2Tabs button[aria-current=page]{box-shadow:inset 0 3px 0 var(--danger,#b4432f);background:#fbf5f3}
 #v2More{width:auto;margin:0;border:1px solid #d5dae2;border-radius:6px;padding:0 12px;min-height:44px}
 #v2More span.lbl{display:inline}
 #v2View{padding:4px 16px calc(150px + env(safe-area-inset-bottom))}
 .v2h h2{font-size:30px}
 .v2-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
 .v2-grid.one{grid-template-columns:1fr}
 .v2-card{padding:12px}
 .v2-card h3{font-size:16px}
 .v2-charts,.v2-detail{grid-template-columns:1fr}
 .v2-side{position:static}
 .v2-cal{grid-template-columns:1fr}.v2-day{min-height:0}.v2-day.empty-day{display:none}
 .v2-fab{display:inline-flex;position:fixed;right:14px;bottom:calc(72px + env(safe-area-inset-bottom));z-index:320;min-height:56px;padding:0 20px;border-radius:28px;border:0;background:var(--danger,#b4432f);color:#fff;font:700 15px var(--ui,system-ui);align-items:center;gap:6px;box-shadow:0 6px 18px #0003}
 dialog.v2-dlg{width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0;margin:0;padding:18px 16px calc(18px + env(safe-area-inset-bottom))}
 #ghBar #ghFab{display:none!important}
 #sidebar #ghBar{position:static!important;background:none!important;border:0!important;box-shadow:none!important;padding:0!important;margin-left:auto;gap:6px}
 #sidebar #ghBar #ghStatus{font-size:12px;padding:0}
 #sidebar #ghBar #ghSaveBtn span{display:none}#sidebar #ghBar #ghSaveBtn::after{content:"Save"}
 #sidebar{align-items:center!important;flex-wrap:nowrap!important}
 .v2-mode #topbar{display:none!important}
 #sidebar #ghBar #ghStatus{font-size:0!important;gap:0}#sidebar #ghBar #ghStatus::before{width:10px;height:10px}
 #v2More .lbl{font-size:13px}
 #sidebar .brand{width:auto!important;margin-right:auto!important}
 body{padding-bottom:calc(64px + env(safe-area-inset-bottom))!important}
 .muse-idea-editor .muse-editor-actions{bottom:calc(62px + env(safe-area-inset-bottom))!important}
 #capture{bottom:calc(70px + env(safe-area-inset-bottom))!important}
 #toast{bottom:calc(140px + env(safe-area-inset-bottom))!important}
}
@media(prefers-reduced-motion:reduce){#museV2Css~*{scroll-behavior:auto}}
`;document.head.append(s);}

function moreItems(){
  const out=[];const add=(grp,label,fn)=>out.push({grp,label,fn});
  $$('#workspaceNav button').forEach(b=>{const t=b.textContent.trim().replace(/^↳\s*/,'');if(!t)return;add('Classic views',t,()=>b.click());});
  $$('#workspaceUtilities button').forEach(b=>{const t=b.textContent.trim();if(t)add('Workspace tools',t,()=>b.click());});
  const bk=$$('#topbar button').find(b=>/back up/i.test(b.textContent));if(bk)add('Data','Back up Muse',()=>bk.click());
  add('Data','Sync & keys',()=>$('#ghCfgBtn')?.click());
  return out;
}
function openMore(){
  const items=moreItems();let g='';moreMenu.innerHTML=items.map((it,i)=>(it.grp!==g?(g=it.grp,'<div class="grp" role="presentation">'+E(g)+'</div>'):'')+'<button role="menuitem" type="button" data-i="'+i+'">'+E(it.label)+'</button>').join('');
  moreMenu.onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;closeMore();leaveV2();items[+b.dataset.i].fn();};
  const r=moreBtn.getBoundingClientRect();moreMenu.classList.add('open');const mh=moreMenu.offsetHeight,mw=moreMenu.offsetWidth;
  let top=r.bottom+6;if(top+mh>innerHeight-8)top=Math.max(8,r.top-mh-6);moreMenu.style.top=top+'px';moreMenu.style.left=Math.max(8,Math.min(r.left,innerWidth-mw-8))+'px';
  moreBtn.setAttribute('aria-expanded','true');moreMenu.querySelector('button')?.focus();
}
function closeMore(){moreMenu.classList.remove('open');moreBtn.setAttribute('aria-expanded','false');}
function leaveV2(){document.body.classList.remove('v2-mode');$$('#v2Tabs button').forEach(b=>b.removeAttribute('aria-current'));}
function closeClassic(){try{if(typeof closeWorkspaces==='function')closeWorkspaces();}catch{}$$('.os-workspace.open').forEach(p=>{const b=p.querySelector('[data-os-action="close"]');if(b)b.click();else p.classList.remove('open');});}
function go(t,opts){tab=t;localStorage.setItem('muse.v2.tab',t);closeClassic();document.body.classList.add('v2-mode');
  $$('#v2Tabs button').forEach(b=>b.dataset.tab===t?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
  const cr=$('#workspaceCrumb');if(cr)cr.textContent='Muse / '+TABS.find(x=>x[0]===t)[1];
  render();if(!opts||opts.focus!==false){const h=root.querySelector('h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}}root.scrollTop=0;}
function render(){if(!root||!document.body.classList.contains('v2-mode'))return;({tracker:rTracker,ideas:rIdeas,voice:rVoice,inspo:rInspo,planner:rPlanner})[tab]();fab();}
function fab(){let f=$('#v2Fab');if(!f){f=document.createElement('button');f.id='v2Fab';f.className='v2-fab';f.type='button';document.body.append(f);}
  const m={ideas:['＋ Idea',quickIdea],inspo:['＋ Inspo',()=>$('#v2InspoUrl')?.focus()],voice:['＋ Story',()=>incidentDlg()]}[tab];
  if(m&&document.body.classList.contains('v2-mode')){f.hidden=false;f.textContent=m[0];f.title={ideas:'Add idea',inspo:'Add inspiration link',voice:'Add life story'}[tab];f.onclick=m[1];}else f.hidden=true;}

/* ---------------- dialogs ---------------- */
function dlg(title,body,onSave,saveLabel){const d=document.createElement('dialog');d.className='v2-dlg';const hid='v2d'+id();d.setAttribute('aria-labelledby',hid);
  d.innerHTML='<form method="dialog"><h2 id="'+hid+'">'+E(title)+'</h2>'+body+'<footer><button class="v2-btn" value="cancel" type="submit" formnovalidate>Cancel</button><button class="v2-btn primary" value="ok" type="submit">'+E(saveLabel||'Save')+'</button></footer></form>';
  document.body.append(d);const ret=document.activeElement;d.addEventListener('close',()=>{if(d.returnValue==='ok'&&onSave){const f=d.querySelector('form');onSave(Object.fromEntries(new FormData(f)),f);}d.remove();try{ret?.focus()}catch{}});d.showModal();return d;}

/* ---------------- TRACKER ---------------- */
const METRICS=[['views','Views'],['likes','Likes'],['comments','Comments'],['shares','Shares'],['saves','Saves'],['followersGained','Followers +']];
function posts(){const s=sub.tracker;return (V.tracker.posts||[]).filter(p=>(s.acct==='all'||p.tracker===s.acct)&&(s.plat==='all'||p.platform===s.plat));}
function rTracker(){const s=sub.tracker,all=V.tracker.posts||[],ps=posts();
  const acc=[['all','All']].concat((V.tracker.accounts||[]).map(a=>[a.id,a.name+(a.handle?' · '+a.handle:'')]));
  let h='<div class="v2h"><div><h2>Tracker</h2><p>How your posts are doing across NewWave and your personal account. Numbers are filled in automatically by the scraper.</p></div><span class="sp"></span>'+(V.tracker.updatedAt?'<span class="v2-pill">Updated '+E(fmtD(V.tracker.updatedAt))+'</span>':'')+'</div>';
  h+='<div class="v2-bar"><div class="v2-seg" role="group" aria-label="Account">'+acc.map(([k,l])=>'<button type="button" data-acct="'+k+'" aria-pressed="'+(s.acct===k)+'">'+E(l)+'</button>').join('')+'</div>';
  h+='<div class="v2-row" role="group" aria-label="Platform">'+['all','IG','X','LinkedIn'].map(p=>'<button type="button" class="v2-chip" data-plat="'+p+'" aria-pressed="'+(s.plat===p)+'">'+(p==='all'?'All platforms':p)+'</button>').join('')+'</div><span class="sp" style="flex:1"></span>';
  h+='<div class="v2-seg" role="group" aria-label="View">'+[['gallery','Gallery'],['table','Table'],['charts','Charts']].map(([k,l])=>'<button type="button" data-view="'+k+'" aria-pressed="'+(s.view===k)+'">'+l+'</button>').join('')+'</div></div>';
  if(!all.length)h+='<div class="v2-empty"><h3>No posts tracked yet</h3><p>Once the scraper runs, your NewWave and @toriluoo posts on IG, X and LinkedIn show up here with views, likes, comments, shares, saves and followers gained.</p><p>Nothing to do right now.</p></div>';
  else if(!ps.length)h+='<div class="v2-empty"><h3>No posts match</h3><p>Try another account or platform.</p></div>';
  else if(s.view==='gallery')h+='<div class="v2-grid">'+[...ps].sort((a,b)=>String(b.postedAt||'').localeCompare(String(a.postedAt||''))).map(p=>{const th=safeUrl(p.thumbnailUrl);return '<button type="button" class="v2-card" data-post="'+E(p.id)+'" style="--edge:'+(p.tracker==='newwave'?'#3a7ca5':'#c2537a')+'"><div class="v2-thumb">'+(th?'<img src="'+E(th)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':E(p.platform||'Post'))+'</div><h3>'+E(p.title||'Untitled post')+'</h3><div class="meta"><span class="v2-pill">'+E(p.platform||'?')+'</span><span>'+E(fmtD(p.postedAt))+'</span></div><div class="meta"><b style="color:#1f2320">'+fmtN(p.views)+'</b> views · '+fmtN(p.likes)+' likes</div></button>';}).join('')+'</div>';
  else if(s.view==='table'){const sorted=[...ps].sort((a,b)=>{const x=a[s.sort],y=b[s.sort];return (typeof x==='number'||typeof y==='number'?(Number(x)||0)-(Number(y)||0):String(x||'').localeCompare(String(y||'')))*s.dir;});
    const col=(k,l,n)=>'<th scope="col" class="'+(n?'n':'')+'" aria-sort="'+(s.sort===k?(s.dir>0?'ascending':'descending'):'none')+'"><button type="button" data-sort="'+k+'">'+l+(s.sort===k?(s.dir>0?' ▲':' ▼'):'')+'</button></th>';
    h+='<div class="v2-table-wrap"><table class="v2-table"><caption class="sr-only">Tracked posts</caption><thead><tr>'+col('title','Post')+col('platform','Platform')+col('tracker','Account')+col('postedAt','Posted')+METRICS.map(([k,l])=>col(k,l,1)).join('')+col('lastUpdated','Updated')+'</tr></thead><tbody>'+sorted.map(p=>'<tr><td class="t"><a href="'+E(safeUrl(p.url)||'#')+'" target="_blank" rel="noopener">'+E(p.title||p.url||'Untitled')+'</a></td><td>'+E(p.platform)+'</td><td>'+E((V.tracker.accounts.find(a=>a.id===p.tracker)||{}).name||p.tracker)+'</td><td>'+E(fmtD(p.postedAt))+'</td>'+METRICS.map(([k])=>'<td class="n">'+fmtN(p[k])+'</td>').join('')+'<td>'+E(fmtD(p.lastUpdated))+'</td></tr>').join('')+'</tbody></table></div>';}
  else h+=charts(ps);
  root.innerHTML=h;
  root.onclick=e=>{const t=e.target.closest('button');if(!t)return;
    if(t.dataset.acct){s.acct=t.dataset.acct;rTracker();}else if(t.dataset.plat){s.plat=t.dataset.plat;rTracker();}else if(t.dataset.view){s.view=t.dataset.view;rTracker();}
    else if(t.dataset.sort){s.dir=s.sort===t.dataset.sort?-s.dir:-1;s.sort=t.dataset.sort;rTracker();}else if(t.dataset.post)postDlg(t.dataset.post);};
}
function charts(ps){
  const byDay={};ps.forEach(p=>{const hist=(p.history&&p.history.length?p.history:[{t:p.lastUpdated||p.postedAt,views:p.views}]);const last={};hist.forEach(x=>{const d=String(x.t||'').slice(0,10);if(d&&x.views!=null)last[d]=Number(x.views)||0;});Object.entries(last).forEach(([d,v])=>{(byDay[d]=byDay[d]||{})[p.id]=v;});});
  const days=Object.keys(byDay).sort();let run={};const pts=days.map(d=>{Object.assign(run,byDay[d]);return [d,Object.values(run).reduce((a,b)=>a+b,0)];});
  const W=600,H=220,P=34,max=Math.max(1,...pts.map(p=>p[1]));
  const line=pts.length>1?pts.map((p,i)=>(i?'L':'M')+(P+i*(W-2*P)/(pts.length-1)).toFixed(1)+' '+(H-P-(p[1]/max)*(H-2*P)).toFixed(1)).join(' '):'';
  const svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Total views over time, latest '+fmtN(pts.length?pts[pts.length-1][1]:0)+'" style="width:100%;height:auto"><line x1="'+P+'" y1="'+(H-P)+'" x2="'+(W-P)+'" y2="'+(H-P)+'" stroke="#c4cad4"/>'+(line?'<path d="'+line+'" fill="none" stroke="#b4432f" stroke-width="2.5"/>':'')+'<text x="'+P+'" y="'+(P-10)+'" font-size="12" fill="#3d4554">'+fmtN(max)+'</text>'+(pts.length?'<text x="'+P+'" y="'+(H-10)+'" font-size="12" fill="#3d4554">'+E(fmtD(pts[0][0]))+'</text><text x="'+(W-P)+'" y="'+(H-10)+'" font-size="12" fill="#3d4554" text-anchor="end">'+E(fmtD(pts[pts.length-1][0]))+'</text>':'')+'</svg>';
  const top=[...ps].sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,8),tmax=Math.max(1,...top.map(p=>p.views||0));
  return '<div class="v2-charts"><section class="v2-panel"><h3>Views over time</h3>'+(pts.length>1?svg:'<p style="color:#525c6c">Needs at least two days of readings.</p>')+'</section><section class="v2-panel"><h3>Top posts by views</h3><ol class="v2-list">'+top.map(p=>'<li><div class="v2-row"><span class="grow" style="overflow-wrap:anywhere">'+E(p.title||'Untitled')+'</span><b>'+fmtN(p.views)+'</b></div><div style="height:6px;background:#eceef2;border-radius:3px"><div style="height:6px;border-radius:3px;background:#b4432f;width:'+((p.views||0)/tmax*100).toFixed(1)+'%"></div></div></li>').join('')+'</ol></section></div>';
}
function postDlg(pid){const p=(V.tracker.posts||[]).find(x=>x.id===pid);if(!p)return;const idea=p.ideaId&&state.cards.find(c=>c.id===p.ideaId);
  const d=dlg(p.title||'Post','<p><span class="v2-pill">'+E(p.platform)+'</span> '+E(fmtD(p.postedAt))+' · <a href="'+E(safeUrl(p.url)||'#')+'" target="_blank" rel="noopener">Open post ↗</a></p><div class="v2-grid" style="grid-template-columns:repeat(3,1fr)">'+METRICS.map(([k,l])=>'<div class="v2-panel" style="padding:10px"><div style="font-size:12px;color:#525c6c">'+l+'</div><b style="font-size:18px">'+fmtN(p[k])+'</b></div>').join('')+'</div>'+(safeUrl(p.docUrl)?'<p><a href="'+E(p.docUrl)+'" target="_blank" rel="noopener">Google Doc draft ↗</a></p>':'')+(idea?'<p>Idea: <button type="button" class="v2-btn ghost" data-idea-go="'+E(idea.id)+'">'+E(title(idea))+'</button></p>':'')+'<label for="v2pn">Notes</label><textarea class="v2-in" id="v2pn" name="notes">'+E(p.notes||'')+'</textarea><p style="font-size:12px;color:#525c6c">Last updated '+E(fmtD(p.lastUpdated)||'—')+'</p>',f=>{p.notes=f.notes;save();},'Save notes');
  d.querySelector('[data-idea-go]')?.addEventListener('click',e=>{d.close();go('ideas');openIdea(e.target.dataset.ideaGo);});}

/* ---------------- IDEAS ---------------- */
const boards=()=>(state.boards||[]).filter(b=>b.type!=='pipeline'&&!/inspo/i.test(b.name||''));
const ideaCards=()=>(state.cards||[]).filter(c=>boards().some(b=>b.id===c.boardId));
const title=c=>{const raw=String(c.text||'').trim();let t=raw.split('\n').map(x=>x.trim()).find(x=>x&&!/^https?:\/\//.test(x));if(!t&&raw){try{const u=new URL(raw.split(/\s/)[0]);t=platformOfUrl(u.href)+' link · '+u.hostname.replace(/^www\./,'');}catch{t=raw;}}t=t||'Untitled idea';return t.length>90?t.slice(0,88)+'…':t;};
const stages=()=>(state.stages&&state.stages.length?state.stages:[{id:'idea',name:'Idea'},{id:'scripting',name:'Scripting'},{id:'filming',name:'Filming'},{id:'editing',name:'Editing'},{id:'posted',name:'Posted'}]);
const stOf=c=>c.status||'idea', stName=s=>(stages().find(x=>x.id===s)||{name:s}).name;
function rIdeas(){if(sub.ideas.open&&state.cards.some(c=>c.id===sub.ideas.open))return rIdea(sub.ideas.open);sub.ideas.open=null;
  const s=sub.ideas,q=s.q.toLowerCase();let cs=ideaCards().filter(c=>!c.done);
  if(s.board!=='all')cs=cs.filter(c=>c.boardId===s.board);if(s.status!=='all')cs=cs.filter(c=>stOf(c)===s.status);if(q)cs=cs.filter(c=>String(c.text||'').toLowerCase().includes(q));
  cs.sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
  const bs=boards().filter(b=>ideaCards().some(c=>c.boardId===b.id));
  let h='<div class="v2h"><div><h2>Ideas</h2><p>Your workshop. Tap an idea to develop it with scripts, references, notes and status.</p></div><span class="sp"></span><button type="button" class="v2-btn primary" id="v2NewIdea">＋ New idea</button></div>';
  h+='<div class="v2-bar"><label class="sr-only" for="v2q">Search ideas</label><input id="v2q" class="v2-in" type="search" placeholder="Search ideas" value="'+E(s.q)+'" style="flex:1;min-width:200px"><label class="sr-only" for="v2st">Status</label><select id="v2st" class="v2-in"><option value="all">All stages</option>'+stages().map(x=>'<option value="'+E(x.id)+'"'+(s.status===x.id?' selected':'')+'>'+E(x.name)+'</option>').join('')+'</select></div>';
  h+='<div class="v2-row" role="group" aria-label="Collection" style="margin-bottom:16px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px"><button type="button" class="v2-chip" data-board="all" aria-pressed="'+(s.board==='all')+'">All ('+ideaCards().filter(c=>!c.done).length+')</button>'+bs.map(b=>'<button type="button" class="v2-chip" data-board="'+E(b.id)+'" aria-pressed="'+(s.board===b.id)+'" style="white-space:nowrap">'+E(b.name)+'</button>').join('')+'</div>';
  h+=cs.length?'<div class="v2-grid">'+cs.map(c=>{const b=state.boards.find(x=>x.id===c.boardId),w=V.ideaWorkshop[c.id],st=stOf(c);return '<button type="button" class="v2-card" data-open="'+E(c.id)+'" style="--edge:'+({idea:'#a3a89f',scripting:'#b07d2b',filming:'#4a5fb5',editing:'#8a4a9e',posted:'#2f5d50'}[st]||'#3a7ca5')+'"><div class="meta"><span class="v2-pill s-'+E(st)+'">'+E(stName(st))+'</span><span>'+E(b?b.name:'')+'</span></div><h3>'+E(title(c))+'</h3><div class="meta">'+E(fmtD(c.updatedAt||c.createdAt))+(w&&w.scripts.length?' · '+w.scripts.length+' script'+(w.scripts.length>1?'s':''):'')+((c.media||[]).length?' · '+c.media.length+' media':'')+'</div></button>';}).join('')+'</div>':'<div class="v2-empty"><h3>'+(ideaCards().length?'No ideas match':'No ideas yet')+'</h3><p>'+(ideaCards().length?'Try clearing the search or filters.':'Capture your first thought with “＋ New idea”.')+'</p></div>';
  root.innerHTML=h;
  $('#v2q',root).oninput=e=>{s.q=e.target.value;const pos=e.target.selectionStart;rIdeas();const i=$('#v2q',root);i.focus();i.setSelectionRange(pos,pos);};
  $('#v2st',root).onchange=e=>{s.status=e.target.value;rIdeas();};$('#v2NewIdea',root).onclick=quickIdea;
  root.onclick=e=>{const t=e.target.closest('button');if(!t)return;if(t.dataset.board){s.board=t.dataset.board;rIdeas();}else if(t.dataset.open)openIdea(t.dataset.open);};
}
function openIdea(cid){sub.ideas.open=cid;if(tab!=='ideas')go('ideas');else{rIdeas();root.scrollTop=0;$('h2',root)?.focus({preventScroll:true});}}
function persistCard(c){c.updatedAt=Date.now();try{saveState();}catch(e){say('⚠ '+e.message);}}
function rIdea(cid){const c=state.cards.find(x=>x.id===cid),w=ws(cid),b=state.boards.find(x=>x.id===c.boardId),st=stOf(c);
  const docFromText=(String(c.text||'').match(/https?:\/\/docs\.google\.com\/[^\s)]+/)||[])[0]||'';const pinFromText=(String(c.text||'').match(/https?:\/\/(?:[a-z]+\.)?pinterest\.[^\s)]+/)||[])[0]||'';
  const posts=V.tracker.posts||[];
  const list=(arr,fn,empty)=>arr.length?'<ul class="v2-list">'+arr.map(fn).join('')+'</ul>':'<p class="hint" style="color:#525c6c;margin:0">'+empty+'</p>';
  let h='<div class="v2h"><div><button type="button" class="v2-btn ghost" id="v2Back" style="margin-left:-10px">← All ideas</button><h2>'+E(title(c))+'</h2><p>'+E(b?b.name:'')+' · created '+E(fmtD(c.createdAt))+'</p></div><span class="sp"></span><button type="button" class="v2-btn" id="v2Full" title="Media, Google Doc preview, coach, tags and the full editor">Open full editor ↗</button></div>';
  h+='<div class="v2-detail"><div>';
  h+='<section class="v2-sec" style="--edge:#c2537a"><h3>Thoughts</h3><p class="hint">The original capture. Edits save on this device; use “Save to GitHub” to sync.</p><label class="sr-only" for="v2txt">Idea text</label><textarea id="v2txt" class="v2-in" rows="5">'+E(c.text||'')+'</textarea></section>';
  h+='<section class="v2-sec" style="--edge:#8a4a9e"><h3>Script versions</h3><p class="hint">Keep every draft. Newest first.</p>'+list([...w.scripts].reverse(),s=>'<li><div class="v2-row"><b class="grow">'+E(s.label||'Draft')+'</b><span style="font-size:12px;color:#525c6c">'+E(fmtD(s.at))+'</span><button type="button" class="v2-btn ghost" data-edit-script="'+E(s.id)+'">Edit</button></div><p style="white-space:pre-wrap;margin:0">'+E(String(s.text||'').slice(0,600))+(String(s.text||'').length>600?'…':'')+'</p></li>','No script drafts yet.')+'<p style="margin:12px 0 0"><button type="button" class="v2-btn" id="v2AddScript">＋ New draft</button></p></section>';
  h+='<section class="v2-sec" style="--edge:#3a7ca5"><h3>Visual references</h3><p class="hint">Image or Pinterest links. Photos you attached are in the full editor.</p>'+list(w.visualRefs,r=>{const u=safeUrl(r.url),img=/\.(png|jpe?g|webp|gif)(\?|$)/i.test(u);return '<li><div class="v2-row">'+(img?'<img src="'+E(u)+'" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:6px" loading="lazy" referrerpolicy="no-referrer">':'')+'<a class="grow" href="'+E(u||'#')+'" target="_blank" rel="noopener" style="overflow-wrap:anywhere">'+E(r.note||u)+'</a><button type="button" class="v2-btn ghost" data-del="visualRefs:'+E(r.id)+'" aria-label="Remove reference">Remove</button></div></li>';},'No visual references yet.')+'<form class="v2-row" id="v2VisForm" style="margin-top:12px"><label class="sr-only" for="v2vis">Image or Pinterest link</label><input id="v2vis" class="v2-in grow" type="url" placeholder="Paste an image or Pinterest link" required><button class="v2-btn" type="submit">Add</button></form></section>';
  h+='<section class="v2-sec" style="--edge:#b07d2b"><h3>Reference examples</h3><p class="hint">Posts on IG, X or elsewhere that show the kind of video you want, with an optional transcript.</p>'+list(w.examples,r=>'<li><div class="v2-row"><span class="v2-pill">'+E(r.platform||platformOfUrl(r.url))+'</span><a class="grow" href="'+E(safeUrl(r.url)||'#')+'" target="_blank" rel="noopener" style="overflow-wrap:anywhere">'+E(r.note||r.url)+'</a><button type="button" class="v2-btn ghost" data-edit-ex="'+E(r.id)+'">Edit</button><button type="button" class="v2-btn ghost" data-del="examples:'+E(r.id)+'" aria-label="Remove example">Remove</button></div>'+(r.transcript?'<details><summary>Transcript</summary><p style="white-space:pre-wrap">'+E(r.transcript)+'</p></details>':'')+'</li>','No reference examples yet.')+'<form class="v2-row" id="v2ExForm" style="margin-top:12px"><label class="sr-only" for="v2ex">Example post link</label><input id="v2ex" class="v2-in grow" type="url" placeholder="Paste an IG / X / other post link" required><button class="v2-btn" type="submit">Add</button></form></section>';
  h+='<section class="v2-sec" style="--edge:#2f5d50"><h3>Notes & thoughts</h3><p class="hint">A running log. Newest first.</p><form id="v2NoteForm"><label class="sr-only" for="v2note">New note</label><textarea id="v2note" class="v2-in" rows="3" placeholder="What are you thinking about this idea?"></textarea><p style="margin:8px 0 12px"><button class="v2-btn" type="submit">Add note</button></p></form>'+list([...w.notes].reverse(),n=>'<li><span style="font-size:12px;color:#525c6c">'+E(new Date(n.at).toLocaleString())+'</span><p style="white-space:pre-wrap;margin:0">'+E(n.text)+'</p></li>','No notes yet.')+'</section>';
  h+='</div><aside class="v2-side" aria-label="Idea details"><section class="v2-sec"><h3>Status</h3><div class="v2-seg" role="group" aria-label="Status" style="display:flex">'+stages().map(x=>'<button type="button" data-status="'+E(x.id)+'" aria-pressed="'+(st===x.id)+'" style="flex:1 1 auto">'+E(x.name)+'</button>').join('')+'</div></section>';
  h+='<section class="v2-sec"><h3>Links</h3><label for="v2doc" style="font:600 13px var(--ui);display:block;margin:6px 0 4px">Google Doc draft</label><input id="v2doc" class="v2-in" style="width:100%" type="url" placeholder="https://docs.google.com/…" value="'+E(w.docUrl||docFromText)+'">'+(safeUrl(w.docUrl||docFromText)?'<p style="margin:6px 0 0"><a href="'+E(safeUrl(w.docUrl||docFromText))+'" target="_blank" rel="noopener">Open doc ↗</a></p>':'')+'<label for="v2pin" style="font:600 13px var(--ui);display:block;margin:12px 0 4px">Pinterest board</label><input id="v2pin" class="v2-in" style="width:100%" type="url" placeholder="https://pinterest.com/…" value="'+E(w.pinterestUrl||pinFromText)+'">'+(safeUrl(w.pinterestUrl||pinFromText)?'<p style="margin:6px 0 0"><a href="'+E(safeUrl(w.pinterestUrl||pinFromText))+'" target="_blank" rel="noopener">Open Pinterest ↗</a></p>':'')+'</section>';
  h+='<section class="v2-sec"><h3>Tracker post</h3>'+(st==='posted'||w.trackerPostId?(posts.length?'<label class="sr-only" for="v2tp">Linked tracker post</label><select id="v2tp" class="v2-in" style="width:100%"><option value="">Not linked</option>'+posts.map(p=>'<option value="'+E(p.id)+'"'+(w.trackerPostId===p.id?' selected':'')+'>'+E((p.platform||'')+' · '+(p.title||p.url||p.id).slice(0,60))+'</option>').join('')+'</select>':'<p class="hint" style="color:#525c6c;margin:0">No tracker posts yet. Once the scraper adds them you can link this idea here.</p>'):'<p class="hint" style="color:#525c6c;margin:0">Mark the idea as Posted to link it to a tracked post.</p>')+'</section>';
  const inc=V.incidents.filter(x=>(x.usedIn||[]).includes(cid));if(inc.length)h+='<section class="v2-sec"><h3>Life stories used</h3><ul class="v2-list">'+inc.map(x=>'<li>'+E(x.what).slice(0,120)+'</li>').join('')+'</ul></section>';
  h+='</aside></div>';
  root.innerHTML=h;
  const T=$('#v2txt',root);T.onchange=()=>{c.text=T.value;persistCard(c);};
  $('#v2Back',root).onclick=()=>{sub.ideas.open=null;rIdeas();};
  $('#v2Full',root).onclick=()=>{leaveV2();try{osIdea(cid);}catch(e){say('Full editor unavailable: '+e.message);}};
  $('#v2doc',root).onchange=e=>{w.docUrl=e.target.value.trim();save();rIdea(cid);};$('#v2pin',root).onchange=e=>{w.pinterestUrl=e.target.value.trim();save();rIdea(cid);};
  $('#v2tp',root)?.addEventListener('change',e=>{w.trackerPostId=e.target.value||null;const p=posts.find(x=>x.id===w.trackerPostId);if(p&&!p.ideaId)p.ideaId=cid;save();say('Linked ✓');});
  $('#v2VisForm',root).onsubmit=e=>{e.preventDefault();w.visualRefs.push({id:id(),url:$('#v2vis',root).value.trim(),addedAt:Date.now()});save();rIdea(cid);};
  $('#v2ExForm',root).onsubmit=e=>{e.preventDefault();const u=$('#v2ex',root).value.trim();w.examples.push({id:id(),url:u,platform:platformOfUrl(u),transcript:'',note:'',addedAt:Date.now()});save();rIdea(cid);};
  $('#v2NoteForm',root).onsubmit=e=>{e.preventDefault();const t=$('#v2note',root).value.trim();if(!t)return;w.notes.push({id:id(),at:Date.now(),text:t});save();rIdea(cid);};
  $('#v2AddScript',root).onclick=()=>scriptDlg(cid);
  root.onclick=e=>{const t=e.target.closest('button');if(!t)return;
    if(t.dataset.status){c.status=t.dataset.status==='idea'?null:t.dataset.status;persistCard(c);rIdea(cid);say('Status: '+stName(t.dataset.status));}
    else if(t.dataset.del){const [k,i]=t.dataset.del.split(':');if(!confirm('Remove this item?'))return;w[k]=w[k].filter(x=>x.id!==i);save();rIdea(cid);}
    else if(t.dataset.editScript)scriptDlg(cid,t.dataset.editScript);
    else if(t.dataset.editEx){const r=w.examples.find(x=>x.id===t.dataset.editEx);dlg('Reference example','<label for="v2e1">Link</label><input id="v2e1" class="v2-in" name="url" type="url" value="'+E(r.url)+'"><label for="v2e2">Label</label><input id="v2e2" class="v2-in" name="note" value="'+E(r.note||'')+'" placeholder="e.g. great cold open"><label for="v2e3">Transcript (optional)</label><textarea id="v2e3" class="v2-in" name="transcript" rows="8">'+E(r.transcript||'')+'</textarea>',f=>{Object.assign(r,{url:f.url,note:f.note,transcript:f.transcript,platform:platformOfUrl(f.url)});save();rIdea(cid);});}
  };
}
function scriptDlg(cid,sid){const w=ws(cid),s=sid?w.scripts.find(x=>x.id===sid):null;
  dlg(s?'Edit draft':'New script draft','<label for="v2s1">Name</label><input id="v2s1" class="v2-in" name="label" value="'+E(s?s.label:'Draft '+(w.scripts.length+1))+'"><label for="v2s2">Script</label><textarea id="v2s2" class="v2-in" name="text" rows="14" placeholder="Hook…&#10;Body…&#10;CTA…">'+E(s?s.text:(w.scripts.length?w.scripts[w.scripts.length-1].text:''))+'</textarea>'+(s?'':'<p style="font-size:12px;color:#525c6c">Starts from your latest draft so you can revise without losing it.</p>'),f=>{if(s)Object.assign(s,{label:f.label,text:f.text,at:Date.now()});else w.scripts.push({id:id(),label:f.label,text:f.text,at:Date.now()});save();rIdea(cid);});}
function quickIdea(){const bs=boards().filter(b=>b.type!=='story'||true);const def=(typeof museJustIdeasBoard==='function'&&museJustIdeasBoard())||bs[0];
  dlg('New idea','<label for="v2n1">What’s the idea?</label><textarea id="v2n1" class="v2-in" name="text" rows="6" required placeholder="A thought, a hook, a link…"></textarea><label for="v2n2">Collection</label><select id="v2n2" class="v2-in" name="board">'+bs.map(b=>'<option value="'+E(b.id)+'"'+(def&&b.id===def.id?' selected':'')+'>'+E(b.name)+'</option>').join('')+'</select>',async f=>{if(!f.text.trim())return;const prev=state.activeBoard;state.activeBoard=f.board;let c=null;try{c=await addCard(f.text,[]);}catch(e){say('⚠ '+e.message);}state.activeBoard=prev;try{saveState();}catch{}if(c){say('Idea saved ✓');if(tab==='ideas')rIdeas();}},'Save idea');
  setTimeout(()=>$('#v2n1')?.focus(),30);}

/* ---------------- VOICE ---------------- */
function classic(label){const b=$$('#workspaceNav button').find(x=>x.textContent.trim().replace(/^↳\s*/,'')===label);return b;}
function rVoice(){const pend=V.incidents.filter(x=>x.status==='pending'),ok=V.incidents.filter(x=>x.status!=='pending').sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const hub=[['My voice','How you sound: the profile Claude writes from.','#8a4a9e'],['North Star & My Mind','Where you are going and what you believe.','#b07d2b'],['My Journey','Life updates and chapters over time.','#2f5d50']].filter(x=>classic(x[0]));
  let h='<div class="v2h"><div><h2>Voice</h2><p>Who you are on camera: your voice profile, direction, journey, and a bank of real-life stories to draw from.</p></div></div>';
  h+='<div class="v2-hub">'+hub.map(([t,d,c])=>'<button type="button" class="v2-card" data-classic="'+E(t)+'" style="--edge:'+c+'"><h3>'+E(t)+' ↗</h3><p>'+E(d)+'</p></button>').join('')+'</div>';
  h+='<section class="v2-sec" style="--edge:#c2537a"><div class="v2-row"><h3 class="grow" style="font:400 24px var(--serif);margin:0">Life incidents</h3><button type="button" class="v2-btn primary" id="v2AddInc">＋ Add story</button></div><p class="hint" style="color:#525c6c;margin:6px 0 14px">Real moments: what happened, how it felt, and the lesson you could talk about.</p>';
  if(pend.length)h+='<h4 style="font:700 13px var(--ui);margin:6px 0 8px">Suggested for you · '+pend.length+' to review</h4><ul class="v2-list" style="margin-bottom:18px">'+pend.map(x=>incLi(x,true)).join('')+'</ul>';
  h+=ok.length?'<ul class="v2-list">'+ok.map(x=>incLi(x,false)).join('')+'</ul>':'<div class="v2-empty" style="margin:0"><h3>No stories yet</h3><p>Add a moment from your life: a date, what happened, the emotion, and the lesson. Suggested stories will appear here for one-tap approval.</p></div>';
  h+='</section>';root.innerHTML=h;
  $('#v2AddInc',root).onclick=()=>incidentDlg();
  root.onclick=e=>{const t=e.target.closest('button');if(!t)return;
    if(t.dataset.classic){const b=classic(t.dataset.classic);leaveV2();b&&b.click();}
    else if(t.dataset.approve){const x=V.incidents.find(i=>i.id===t.dataset.approve);x.status='approved';x.approvedAt=Date.now();save();rVoice();say('Story added to your bank ✓');}
    else if(t.dataset.dismiss){const x=V.incidents.find(i=>i.id===t.dataset.dismiss);x.status='dismissed';save();rVoice();}
    else if(t.dataset.editInc)incidentDlg(t.dataset.editInc);
    else if(t.dataset.ideaGo)openIdea(t.dataset.ideaGo);};
}
function incLi(x,pending){if(x.status==='dismissed')return '';const used=(x.usedIn||[]).map(i=>state.cards.find(c=>c.id===i)).filter(Boolean);
  return '<li style="'+(pending?'border-color:#e2c27a;background:#fffaf0':'')+'"><div class="v2-row"><span style="font:700 12px var(--ui);color:#3d4554">'+E(fmtD(x.date)||'Undated')+'</span>'+(x.emotion?'<span class="v2-pill">'+E(x.emotion)+'</span>':'')+(pending?'<span class="v2-pill pending">Suggested</span>':'')+(x.tags||[]).map(t=>'<span class="v2-pill">#'+E(t)+'</span>').join('')+'</div><p style="margin:0;white-space:pre-wrap">'+E(x.what)+'</p>'+(x.lesson?'<p style="margin:0;color:#3d4554"><b>Talking point:</b> '+E(x.lesson)+'</p>':'')+(x.source?'<p style="margin:0;font-size:12px;color:#525c6c">Source: '+E(x.source)+'</p>':'')+(used.length?'<div class="v2-row" style="font-size:12px">Used in: '+used.map(c=>'<button type="button" class="v2-btn ghost" data-idea-go="'+E(c.id)+'">'+E(title(c))+'</button>').join('')+'</div>':'')+'<div class="v2-row">'+(pending?'<button type="button" class="v2-btn primary" data-approve="'+E(x.id)+'">Approve</button><button type="button" class="v2-btn" data-dismiss="'+E(x.id)+'">Dismiss</button>':'')+'<button type="button" class="v2-btn ghost" data-edit-inc="'+E(x.id)+'">Edit</button></div></li>';}
function incidentDlg(iid){const x=iid?V.incidents.find(i=>i.id===iid):null;const cs=ideaCards();
  dlg(x?'Edit story':'New life story','<label for="v2i1">Date</label><input id="v2i1" class="v2-in" type="date" name="date" value="'+E(x?String(x.date||'').slice(0,10):'')+'"><label for="v2i2">What happened</label><textarea id="v2i2" class="v2-in" name="what" rows="5" required>'+E(x?x.what:'')+'</textarea><label for="v2i3">Emotion</label><input id="v2i3" class="v2-in" name="emotion" value="'+E(x?x.emotion||'':'')+'" placeholder="e.g. scared, proud, relieved"><label for="v2i4">Lesson / talking point</label><textarea id="v2i4" class="v2-in" name="lesson" rows="3">'+E(x?x.lesson||'':'')+'</textarea><label for="v2i5">Tags (comma separated)</label><input id="v2i5" class="v2-in" name="tags" value="'+E(x?(x.tags||[]).join(', '):'')+'"><label for="v2i6">Source</label><input id="v2i6" class="v2-in" name="source" value="'+E(x?x.source||'':'')+'" placeholder="journal, conversation, Notion page…"><label for="v2i7">Used in idea</label><select id="v2i7" class="v2-in" name="used"><option value="">None</option>'+cs.map(c=>'<option value="'+E(c.id)+'"'+(x&&(x.usedIn||[]).includes(c.id)?' selected':'')+'>'+E(title(c).slice(0,70))+'</option>').join('')+'</select>',f=>{if(!f.what.trim())return;const rec=x||{id:id(),status:'approved',createdAt:Date.now(),usedIn:[]};Object.assign(rec,{date:f.date||null,what:f.what.trim(),emotion:f.emotion.trim(),lesson:f.lesson.trim(),tags:f.tags.split(',').map(t=>t.trim()).filter(Boolean),source:f.source.trim()});rec.usedIn=f.used?[...new Set([...(rec.usedIn||[]).filter(i=>i!==f.used),f.used])]:(rec.usedIn||[]);if(!x)V.incidents.push(rec);save();if(tab==='voice')rVoice();});}

/* ---------------- INSPO ---------------- */
function rInspo(){const items=[...V.inspo].sort((a,b)=>(b.addedAt||0)-(a.addedAt||0));const legacy=(state.cards||[]).filter(c=>(state.boards.find(b=>b.id===c.boardId)||{}).type==='inspo'&&/inspo/i.test((state.boards.find(b=>b.id===c.boardId)||{}).name||'')).length;
  let h='<div class="v2h"><div><h2>Inspo</h2><p>Posts that inspire you. Paste a link to save it, then note the hook and why it works.</p></div></div>';
  h+='<form id="v2InspoForm" class="v2-row" style="margin-bottom:18px"><label class="sr-only" for="v2InspoUrl">Post link</label><input id="v2InspoUrl" class="v2-in grow" type="url" required placeholder="Paste an IG, X, TikTok, YouTube or LinkedIn link"><button class="v2-btn primary" type="submit">Save inspo</button></form>';
  h+=items.length?'<div class="v2-grid">'+items.map(x=>{const th=safeUrl(x.thumbnailUrl)||ytThumb(x.url);return '<button type="button" class="v2-card" data-inspo="'+E(x.id)+'" style="--edge:#b07d2b"><div class="v2-thumb" style="aspect-ratio:1">'+(th?'<img src="'+E(th)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':E(x.platform))+'</div><div class="meta"><span class="v2-pill">'+E(x.platform)+'</span>'+(x.creator?'<span>'+E(x.creator)+'</span>':'')+'</div><h3>'+E(x.title||x.hook||hostOf(x.url))+'</h3><div class="meta">'+(x.transcript?'<span class="v2-pill s-posted">Transcript ✓</span>':'<span class="v2-pill pending">Transcript pending</span>')+((x.ideaIds||[]).length?'<span>→ '+x.ideaIds.length+' idea</span>':'')+'</div></button>';}).join('')+'</div>':'<div class="v2-empty"><h3>Start your inspo library</h3><p>Paste a link above. Each one becomes a card where you can note the creator, the hook, why it works, and which idea it inspires. Transcripts are added for you later.</p></div>';
  if(legacy)h+='<p style="margin-top:22px;color:#3d4554;font-size:14px">Your older inspo boards are still under <b>More → Inspo / Video Inspo</b>.</p>';
  root.innerHTML=h;
  $('#v2InspoForm',root).onsubmit=e=>{e.preventDefault();const u=$('#v2InspoUrl',root).value.trim();if(V.inspo.some(x=>x.url===u))return say('Already saved');const x={id:id(),url:u,platform:platformOfUrl(u),creator:creatorOf(u),thumbnailUrl:ytThumb(u),title:'',transcript:null,transcriptStatus:'pending',hook:'',whyItWorks:'',tags:[],ideaIds:[],addedAt:Date.now()};V.inspo.push(x);save();rInspo();say('Saved ✓ · tap the card to add notes');};
  root.onclick=e=>{const t=e.target.closest('[data-inspo]');if(t)inspoDlg(t.dataset.inspo);};
}
const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return u}};
const creatorOf=u=>{const m=String(u).match(/(?:instagram\.com|x\.com|twitter\.com|tiktok\.com)\/@?([A-Za-z0-9_.]+)/);return m&&!/^(p|reel|reels|status|i|video)$/.test(m[1])?'@'+m[1]:'';};
function inspoDlg(iid){const x=V.inspo.find(i=>i.id===iid);const cs=ideaCards();
  const d=dlg('Inspiration','<p><span class="v2-pill">'+E(x.platform)+'</span> <a href="'+E(safeUrl(x.url)||'#')+'" target="_blank" rel="noopener">Open post ↗</a></p><label for="v2p1">Title</label><input id="v2p1" class="v2-in" name="title" value="'+E(x.title)+'"><label for="v2p2">Creator</label><input id="v2p2" class="v2-in" name="creator" value="'+E(x.creator)+'" placeholder="@handle"><label for="v2p3">Thumbnail image URL</label><input id="v2p3" class="v2-in" name="thumbnailUrl" type="url" value="'+E(x.thumbnailUrl)+'"><label for="v2p4">Hook breakdown</label><textarea id="v2p4" class="v2-in" name="hook" rows="3" placeholder="What happens in the first 3 seconds?">'+E(x.hook)+'</textarea><label for="v2p5">Why it works</label><textarea id="v2p5" class="v2-in" name="whyItWorks" rows="3">'+E(x.whyItWorks)+'</textarea><label for="v2p6">Tags (comma separated)</label><input id="v2p6" class="v2-in" name="tags" value="'+E((x.tags||[]).join(', '))+'"><label for="v2p7">Use as reference for idea</label><select id="v2p7" class="v2-in" name="idea"><option value="">None</option>'+cs.map(c=>'<option value="'+E(c.id)+'"'+((x.ideaIds||[]).includes(c.id)?' selected':'')+'>'+E(title(c).slice(0,70))+'</option>').join('')+'</select><label>Transcript</label>'+(x.transcript?'<details><summary>Show transcript</summary><p style="white-space:pre-wrap">'+E(x.transcript)+'</p></details>':'<p class="v2-pill pending" style="display:inline-flex">Transcript pending · added automatically later</p>')+'<p style="margin-top:16px"><button type="button" class="v2-btn ghost" id="v2InspoDel" style="color:#a2321f">Delete this inspo</button></p>',f=>{Object.assign(x,{title:f.title.trim(),creator:f.creator.trim(),thumbnailUrl:f.thumbnailUrl.trim(),hook:f.hook,whyItWorks:f.whyItWorks,tags:f.tags.split(',').map(t=>t.trim()).filter(Boolean)});const prev=(x.ideaIds||[])[0];x.ideaIds=f.idea?[f.idea]:[];if(f.idea&&f.idea!==prev){const w=ws(f.idea);if(!w.examples.some(e=>e.url===x.url))w.examples.push({id:id(),url:x.url,platform:x.platform,transcript:x.transcript||'',note:x.title||'From Inspo',addedAt:Date.now(),inspoId:x.id});}save();rInspo();});
  d.querySelector('#v2InspoDel').onclick=()=>{if(!confirm('Delete this inspiration?'))return;V.inspo=V.inspo.filter(i=>i.id!==iid);save();d.close();rInspo();};}

/* ---------------- PLANNER ---------------- */
function rPlanner(){const s=sub.planner,items=(V.planner.items||[]).filter(i=>s.acct==='all'||i.tracker===s.acct);
  const anchor=s.anchor?new Date(s.anchor):new Date();anchor.setHours(0,0,0,0);
  let h='<div class="v2h"><div><h2>Planner</h2><p>Your NewWave and Personal video plans, mirrored from Notion.</p></div><span class="sp"></span>'+(V.planner.syncedAt?'<span class="v2-pill">Synced '+E(fmtD(V.planner.syncedAt))+'</span>':'<span class="v2-pill pending">Notion sync not connected yet</span>')+'</div>';
  h+='<div class="v2-bar"><div class="v2-seg" role="group" aria-label="Planner">'+[['all','Both'],['newwave','NewWave'],['personal','Personal']].map(([k,l])=>'<button type="button" data-acct="'+k+'" aria-pressed="'+(s.acct===k)+'">'+l+'</button>').join('')+'</div><span style="flex:1"></span><div class="v2-seg" role="group" aria-label="View">'+[['week','Week'],['month','Month'],['list','List']].map(([k,l])=>'<button type="button" data-view="'+k+'" aria-pressed="'+(s.view===k)+'">'+l+'</button>').join('')+'</div></div>';
  if(!(V.planner.items||[]).length){h+='<div class="v2-empty"><h3>Nothing planned here yet</h3><p>When your two Notion planners are connected, every video (title, date, status, NewWave or Personal) appears here in a week, month or list view.</p><p>Until then, keep planning in Notion.</p></div>';root.innerHTML=h;bindP();return;}
  const ev=i=>'<a class="v2-ev" style="--edge:'+(i.tracker==='newwave'?'#3a7ca5':'#c2537a')+'" href="'+E(safeUrl(i.notionUrl)||'#')+'" target="_blank" rel="noopener"><b>'+E(i.title||'Untitled')+'</b><br><span style="color:#525c6c">'+E(i.status||'')+'</span></a>';
  const key=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const byDay={};items.forEach(i=>{const k=String(i.date||'').slice(0,10);(byDay[k]=byDay[k]||[]).push(i);});
  const today=key(new Date());
  if(s.view==='list'){const sorted=[...items].sort((a,b)=>String(a.date||'9').localeCompare(String(b.date||'9')));h+='<ul class="v2-list">'+sorted.map(i=>'<li><div class="v2-row"><b style="min-width:90px">'+E(fmtD(i.date)||'No date')+'</b><span class="grow">'+E(i.title)+'</span><span class="v2-pill">'+E(i.status||'')+'</span><span class="v2-pill">'+E(i.tracker==='newwave'?'NewWave':'Personal')+'</span>'+(safeUrl(i.notionUrl)?'<a href="'+E(i.notionUrl)+'" target="_blank" rel="noopener">Notion ↗</a>':'')+(i.ideaId&&state.cards.some(c=>c.id===i.ideaId)?'<button type="button" class="v2-btn ghost" data-idea-go="'+E(i.ideaId)+'">Idea</button>':'')+'</div></li>').join('')+'</ul>';}
  else{let start=new Date(anchor),n=7;if(s.view==='week'){start.setDate(start.getDate()-((start.getDay()+6)%7));}else{start=new Date(anchor.getFullYear(),anchor.getMonth(),1);start.setDate(start.getDate()-((start.getDay()+6)%7));n=42;}
    const lbl=s.view==='week'?'Week of '+fmtD(start):anchor.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    h+='<div class="v2-row" style="margin-bottom:10px"><button type="button" class="v2-btn" data-nav="-1" aria-label="Previous">←</button><b style="font:400 20px var(--serif)">'+E(lbl)+'</b><button type="button" class="v2-btn" data-nav="1" aria-label="Next">→</button><button type="button" class="v2-btn ghost" data-nav="0">Today</button></div><div class="v2-cal">';
    for(let i=0;i<n;i++){const d=new Date(start);d.setDate(start.getDate()+i);const k=key(d),evs=byDay[k]||[];h+='<div class="v2-day'+(k===today?' today':'')+(s.view==='month'&&d.getMonth()!==anchor.getMonth()?' out':'')+(evs.length?'':' empty-day')+'"><span class="d">'+d.toLocaleDateString(undefined,{weekday:'short',day:'numeric'})+'</span>'+evs.map(ev).join('')+'</div>';}
    h+='</div>';}
  root.innerHTML=h;bindP();
  function bindP(){root.onclick=e=>{const t=e.target.closest('button');if(!t)return;
    if(t.dataset.acct){s.acct=t.dataset.acct;rPlanner();}else if(t.dataset.view){s.view=t.dataset.view;rPlanner();}
    else if(t.dataset.nav){const d=s.anchor?new Date(s.anchor):new Date();if(t.dataset.nav==='0')s.anchor=null;else{if(s.view==='week')d.setDate(d.getDate()+7*+t.dataset.nav);else d.setMonth(d.getMonth()+ +t.dataset.nav);s.anchor=d.toISOString();}rPlanner();}
    else if(t.dataset.ideaGo)openIdea(t.dataset.ideaGo);};}
}

/* ---------------- init ---------------- */
function init(){if(root)return;if(typeof state==='undefined'||!document.getElementById('sidebar'))return;
  css();document.body.classList.add('v2-on');
  root=document.createElement('section');root.id='v2View';root.setAttribute('aria-live','off');root.setAttribute('aria-label','Muse');($('#main')||document.body).append(root);
  nav=document.createElement('nav');nav.id='v2Tabs';nav.setAttribute('aria-label','Main');
  nav.innerHTML=TABS.map(([k,l,p])=>'<button type="button" data-tab="'+k+'">'+icon(p)+'<span>'+l+'</span></button>').join('');
  moreBtn=document.createElement('button');moreBtn.id='v2More';moreBtn.type='button';moreBtn.setAttribute('aria-haspopup','menu');moreBtn.setAttribute('aria-expanded','false');moreBtn.innerHTML=icon('M5 12h.01M12 12h.01M19 12h.01')+'<span class="lbl">More</span>';
  moreMenu=document.createElement('div');moreMenu.id='v2MoreMenu';moreMenu.setAttribute('role','menu');moreMenu.setAttribute('aria-label','More');
  const sb=$('#sidebar'),wn=$('#workspaceNav');sb.insertBefore(nav,wn||sb.children[1]||null);nav.after(moreMenu);
  if(matchMedia('(max-width:800px)').matches)sb.append(moreBtn);else nav.after(moreBtn);
  matchMedia('(max-width:800px)').addEventListener('change',e=>{if(e.matches)sb.append(moreBtn);else nav.after(moreBtn);});
  nav.onclick=e=>{const b=e.target.closest('[data-tab]');if(!b)return;if(b.dataset.tab==='ideas'&&tab==='ideas')sub.ideas.open=null;go(b.dataset.tab);};
  moreBtn.onclick=e=>{e.stopPropagation();moreMenu.classList.contains('open')?closeMore():openMore();};
  document.addEventListener('click',e=>{if(!moreMenu.contains(e.target)&&e.target!==moreBtn)closeMore();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&moreMenu.classList.contains('open')){e.stopPropagation();closeMore();moreBtn.focus();}
    if(moreMenu.classList.contains('open')&&/^Arrow(Up|Down)$/.test(e.key)){e.preventDefault();const bs=$$('button',moreMenu),i=bs.indexOf(document.activeElement);bs[(i+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length].focus();}},true);
  /* clicking any classic nav leaves the v2 shell */
  $$('#workspaceNav button,#workspaceUtilities button').forEach(b=>b.addEventListener('click',leaveV2,true));
  window.addEventListener('storage',e=>{if(e.key===KEY){V=load();render();}});
  go(tab,{focus:false});
}
window.museV2Init=init;
})();
