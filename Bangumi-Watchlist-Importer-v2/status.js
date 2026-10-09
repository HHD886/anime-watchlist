(() => {'use strict';
  const ui=window.KingShelfUI;if(!ui)return;const C=globalThis.Shelf,rows=new Map(),states=new Map(),resolved=new Set();let filter='all',refreshTimer,scanTimer,tail=Promise.resolve(),syncAt='';
  const style=document.createElement('style');style.textContent='.king-shelf-badge{display:inline-flex!important;align-items:center;gap:4px;margin:3px 5px;padding:3px 7px;border:1px solid #c7ccc4;border-radius:6px;font:11px/1.5 system-ui,sans-serif;cursor:pointer;color:#586454;background:#f2f4ef;vertical-align:middle;max-width:260px}.king-shelf-badge[data-state="present"]{color:#25694c;background:#e7f4ec;border-color:#9cc8ae}.king-shelf-badge[data-state="related"]{color:#7b601c;background:#fff5d9;border-color:#dcc987}.king-shelf-badge[data-state="pending"]{color:#956025;background:#fff0df}.king-shelf-badge[data-state="absent"]{color:#356582;background:#e8f2fa}.king-shelf-filtered{display:none!important}';document.head.append(style);
  const names={present:'✓ 已入库',related:'同系列已存在 · 当前作品未入库 · 加入系列',pending:'待同步',absent:'＋ 添加到作品库',unknown:'无法确定 · 添加 / 重试'};
  const visible=(s,f)=>f==='all'||f==='missing'&&s!=='present'||f==='related'&&s==='related'||f==='present'&&s==='present';
  function paint(id){const s=states.get(id)||{state:'unknown'};for(const row of rows.get(id)||[]){row.badge.textContent=names[s.state]+(s.cached?'（上次同步）':'');row.badge.dataset.state=s.state;row.badge.disabled=s.state==='pending';row.badge.title=s.reason||(s.state==='present'?'打开作品库中的这部作品':s.state==='related'?s.series:'保存成功后才会显示已入库');if(row.container)row.container.classList.toggle('king-shelf-filtered',!visible(s.state,filter));}}
  function sync(r){syncAt=r.at||syncAt;ui.root.getElementById('sync-status').textContent=`${syncAt?'最后同步 '+new Date(syncAt).toLocaleString():'尚未连接作品库'} · 待同步 ${r.count||0} 部${r.error?' · '+r.error:''}`;}
  async function refresh(){const ids=[...rows.keys()];for(let n=0;n<ids.length;n+=500){try{const r=await ui.send({type:'STATUS_BATCH',ids:ids.slice(n,n+500)});for(const [id,s] of Object.entries(r.states)){states.set(id,s);paint(id);}sync(r);}catch(e){ui.root.getElementById('sync-status').textContent=e.message;}}}
  ui.refresh=()=>{resolved.clear();refresh().then(()=>{for(const [id,list] of rows)for(const row of list)if(row.badge.getBoundingClientRect().top<innerHeight&&row.badge.getBoundingClientRect().bottom>0)resolve(id);});};
  function resolve(id){if(resolved.has(id)||['present','related','pending'].includes(states.get(id)?.state))return;resolved.add(id);tail=tail.catch(()=>{}).then(async()=>{try{const r=await ui.send({type:'STATUS_BATCH',ids:[id],resolve:true});states.set(id,r.states[id]);paint(id);sync(r);}catch{resolved.delete(id);}});}
  const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)resolve(e.target.dataset.bgmId);},{rootMargin:'150px'});
  function add(anchor,id,container){if(!id||!anchor||anchor.dataset.kingShelfMarked)return;anchor.dataset.kingShelfMarked='1';const badge=document.createElement('button');badge.type='button';badge.className='king-shelf-badge';badge.dataset.bgmId=id;badge.setAttribute('aria-label','王之宝库入库状态');anchor.insertAdjacentElement('afterend',badge);
    if(!rows.has(id))rows.set(id,[]);rows.get(id).push({badge,container});paint(id);observer.observe(badge);
    badge.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();const s=states.get(id);if(s?.state==='present'){await ui.send({type:'OPEN_LIBRARY',id:s.item.id});return;}badge.disabled=true;try{const r=await ui.send({type:'ADD_REQUEST',id,options:ui.options()});states.set(id,r.present?states.get(id):{state:'pending'});paint(id);ui.say(r.present?'该作品已经在作品库中':'已保存添加请求，等待作品库同步');await refresh();}catch(err){ui.say(err.message,true);badge.disabled=false;}});
  }
  function discover(){
    const current=location.pathname.match(/^\/subject\/(\d+)(?:\/|$)/)?.[1];if(current)add(document.querySelector('#headerSubject h1'),current,null);
    const seenContainers=new Map();
    for(const a of document.querySelectorAll('a[href*="/subject/"]')){
      if(a.closest('#bgm-watchlist-importer')||a.classList.contains('king-shelf-badge')||a.dataset.kingShelfMarked)continue;
      let u;try{u=new URL(a.getAttribute('href'),location.href);}catch{continue;}const id=C.subjectId(u.href);if(!id||!/^\/subject\/\d+\/?$/.test(u.pathname))continue;
      if(current&&a.closest('#headerSubject'))continue;
      const row=a.closest('#browserItemList > li, .browserFull > li, .subjectList > li, .browserList > li, .coversSmall > li, .coversMedium > li, .collectInfo > li');
      if(row){if(!seenContainers.has(row))seenContainers.set(row,new Map());const map=seenContainers.get(row);if(!map.has(id)||a.textContent.trim())map.set(id,a);}
      else if(a.textContent.trim())add(a,id,null);
    }
    for(const [row,map] of seenContainers){const prior=row.querySelector('.king-shelf-badge');if(prior)continue;for(const [id,a] of map)add(a,id,map.size===1?row:null);}
    refresh();
  }
  ui.root.getElementById('shelf-filter').addEventListener('change',e=>{filter=e.target.value;for(const id of rows.keys())paint(id);});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!changes.king_shelf_index_v45&&!changes.watchlist_import_queue_v1)return;clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,200);});
  new MutationObserver(records=>{if(!records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&!n.matches('.king-shelf-badge')&&!n.closest?.('#bgm-watchlist-importer,.king-shelf-badge'))))return;clearTimeout(scanTimer);scanTimer=setTimeout(discover,300);}).observe(document.body,{childList:true,subtree:true});
  setInterval(()=>{refresh();},30000);discover();
})();
