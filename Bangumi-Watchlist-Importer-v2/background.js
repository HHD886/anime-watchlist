'use strict';
importScripts('core.js','series.js');
const C=globalThis.Shelf,S=globalThis.ShelfSeries;
const QUEUE_KEY='watchlist_import_queue_v1',INDEX_KEY='king_shelf_index_v45',TARGET_KEY='king_shelf_target_v45';
const DEFAULT_TARGET='https://hhd886.github.io/anime-watchlist/editor.html';
let writes=Promise.resolve(),cacheDB;
const get=async k=>(await chrome.storage.local.get(k))[k];
function serial(fn){const op=writes.catch(()=>{}).then(fn);writes=op;return op;}
async function getQueue(){const q=await get(QUEUE_KEY);return Array.isArray(q)?q:[];}
async function putQueue(q){if(q.length>20000)throw new Error('待同步超过 20000 部，请先打开作品库同步');await chrome.storage.local.set({[QUEUE_KEY]:q});return q;}
function canonical(url){const u=new URL(url);u.search='';u.hash='';return u.href;}
async function target(){return await get(TARGET_KEY)||DEFAULT_TARGET;}
function senderKind(sender){try{if(sender.frameId&&sender.frameId!==0)return '';const u=new URL(sender.url||'');if(u.protocol==='chrome-extension:'&&u.hostname===chrome.runtime.id)return 'popup';if(u.protocol==='https:'&&['bgm.tv','bangumi.tv','chii.in'].includes(u.hostname))return 'bangumi';if(u.protocol==='https:'&&u.hostname==='hhd886.github.io'&&u.pathname.startsWith('/anime-watchlist/'))return 'shelf';if(u.protocol==='file:')return 'shelf';}catch{}return '';}
async function trustedShelf(sender){return senderKind(sender)==='shelf'&&canonical(sender.url)===canonical(await target());}
async function openCache(){if(cacheDB)return cacheDB;cacheDB=await new Promise((res,rej)=>{const q=indexedDB.open('king-shelf-metadata',1);q.onupgradeneeded=()=>q.result.createObjectStore('cache');q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});return cacheDB;}
async function cacheGet(k){const db=await openCache();return new Promise((res,rej)=>{const q=db.transaction('cache').objectStore('cache').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}
async function cachePut(k,v){const db=await openCache();return new Promise((res,rej)=>{const t=db.transaction('cache','readwrite');t.objectStore('cache').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error);});}
const client=S.createClient({get:cacheGet,set:cachePut});
function sanitizeIndex(raw){
  if(raw?.protocol!==1||!Array.isArray(raw.items)||raw.items.length>20000)throw new Error('作品库索引版本不兼容');
  const items=raw.items.filter(i=>C.subjectId(i.bangumiId)).map(i=>({id:C.str(i.id,120),bangumiId:C.subjectId(i.bangumiId),seriesId:C.str(i.seriesId,160),series:C.str(i.series,300),title:C.str(i.title,300),media:C.str(i.media,20),locked:!!i.locked}));
  const known=new Set(items.map(i=>i.seriesId)),related={};
  for(const [id,r] of Object.entries(raw.related||{}).slice(0,100000)){if(!C.subjectId(id))continue;if(r?.ambiguous)related[id]={ambiguous:true};else if(known.has(r?.seriesId))related[id]={seriesId:C.str(r.seriesId,160),series:C.str(r.series,300)};}
  return {protocol:1,items,related,version:Number(raw.version)||0,at:C.now()};
}
async function status(){const index=await get(INDEX_KEY),q=await getQueue();return {at:index?.at||'',count:q.length,error:q.find(i=>i._error)?._error||'',target:await target(),version:chrome.runtime.getManifest().version};}
async function addRequests(ids,options={},personal={}){
  return serial(async()=>{const index=await get(INDEX_KEY),q=await getQueue(),byId=new Map(q.map(i=>[String(i.bangumiId),i]));let added=0,present=0;
    for(const value of ids){const id=C.subjectId(value);if(!id)throw new Error('Bangumi ID 无效');if(index&&Date.now()-Date.parse(index.at)<120000&&index.items.some(i=>i.bangumiId===id)){present++;continue;}if(byId.has(id))continue;
      byId.set(id,{bangumiId:id,_queueRevision:C.uid(),_requestedAt:C.now(),_options:options,_personal:{score:C.score(personal.score),review:C.str(personal.review)}});added++;
    }
    await putQueue([...byId.values()]);return {count:byId.size,added,present};
  });
}
async function nextJob(sender){
  const lease=await serial(async()=>{const q=await getQueue(),i=q.find(i=>(!i._leaseUntil||i._leaseUntil<Date.now())&&(!i._retryAt||i._retryAt<=Date.now()));if(!i)return null;
    if(!i._queueRevision)i._queueRevision=C.uid();i._leaseUntil=Date.now()+120000;i._leaseOwner=String(sender.tab?.id||'file');await putQueue(q);return structuredClone(i);
  });
  if(!lease)return {job:null,...await status()};
  try{
    let i=lease.title?C.normalize(lease):(await client.subject(lease.bangumiId)).item;
    if(!lease.title){i=C.applyImportOptions(i,lease._options);if(lease._personal){i.score=lease._personal.score;i.review=lease._personal.review;}}
    let relations;try{relations=(await client.relations(lease.bangumiId)).rows;}catch{} // Import may succeed with a safe singleton; the website retries relation lookup.
    for(const k of Object.keys(i))if(k.startsWith('_'))delete i[k];
    return {job:{item:i,relations,receipt:{bangumiId:lease.bangumiId,revision:lease._queueRevision}},...await status()};
  }catch(e){await serial(async()=>{const q=await getQueue(),i=q.find(i=>i.bangumiId===lease.bangumiId&&i._queueRevision===lease._queueRevision);if(i){delete i._leaseUntil;i._retryAt=Date.now()+60000;i._error=e.message;}await putQueue(q);});return {job:null,...await status()};}
}
async function handle(message,sender){
  const kind=senderKind(sender);if(!kind)throw new Error('此页面不能访问作品库插件');
  if(message.type==='STATUS'||message.type==='HELLO'){
    if(kind==='shelf'&&!await trustedShelf(sender))throw new Error('此编辑器不是插件绑定的地址，请在插件设置中更改地址');return await status();
  }
  if(message.type==='SET_TARGET'&&kind==='popup'){
    const u=new URL(message.url);if(!(u.protocol==='file:'&&u.pathname.toLowerCase().endsWith('.html'))&&!(u.origin==='https://hhd886.github.io'&&u.pathname.startsWith('/anime-watchlist/')&&u.pathname.endsWith('editor.html')))throw new Error('请输入本网站的 editor.html 地址或本地 HTML 文件的完整 file:// 地址');
    await chrome.storage.local.set({[TARGET_KEY]:canonical(u.href),[INDEX_KEY]:null});return await status();
  }
  if(message.type==='OPEN_LIBRARY'){
    if(!['popup','bangumi'].includes(kind))throw new Error('不支持的来源');const url=(await target())+(message.id?'#work='+encodeURIComponent(C.str(message.id,120)):'');await chrome.tabs.create({url});return {};
  }
  if(message.type==='ADD_REQUEST'&&kind==='bangumi'){
    const ids=message.ids||[message.id];if(!Array.isArray(ids)||ids.length>500)throw new Error('一次最多 500 部');return await addRequests(ids,message.options,message.personal);
  }
  if(message.type==='STATUS_BATCH'&&kind==='bangumi'){
    const ids=[...new Set((message.ids||[]).map(C.subjectId).filter(Boolean))].slice(0,500),index=await get(INDEX_KEY),q=await getQueue(),cache={};
    await Promise.all(ids.map(async id=>{const e=await cacheGet('relations:'+id);if(e)cache[id]=e;}));
    if(message.resolve&&ids.length===1&&index&&!index.items.some(i=>i.bangumiId===ids[0])&&!index.related?.[ids[0]]&&!q.some(i=>i.bangumiId===ids[0])){try{cache[ids[0]]=await client.relations(ids[0]);}catch{}}
    const classify=S.classifier(index,cache,q);return {states:Object.fromEntries(ids.map(id=>[id,classify(id)])),...await status()};
  }
  if(message.type==='LIBRARY_INDEX'&&await trustedShelf(sender)){
    await serial(async()=>{const next=sanitizeIndex(message.index),old=await get(INDEX_KEY);if(!old||next.version>=old.version)await chrome.storage.local.set({[INDEX_KEY]:next});});return await status();
  }
  if(message.type==='NEXT_IMPORT'&&await trustedShelf(sender))return await nextJob(sender);
  if(message.type==='IMPORT_RESULT'&&await trustedShelf(sender)){
    const receipt=message.receipt||{};await serial(async()=>{
      let q=await getQueue();const i=q.find(i=>i.bangumiId===receipt.bangumiId&&i._queueRevision===receipt.revision);if(!i)return;
      if(message.error){delete i._leaseUntil;i._retryAt=Date.now()+30000;i._error=C.str(message.error,300);}
      else{const index=sanitizeIndex(message.index);if(!index.items.some(x=>x.bangumiId===i.bangumiId))throw new Error('作品库尚未确认作品已保存');const current=await get(INDEX_KEY);if(!current||index.version>=current.version)await chrome.storage.local.set({[INDEX_KEY]:index});q=q.filter(x=>x!==i);}
      await putQueue(q);
    });return await status();
  }
  if(message.type==='RETRY_SYNC'){
    if(kind==='shelf'&&!await trustedShelf(sender))throw new Error('编辑器地址不匹配');await serial(async()=>{const q=await getQueue();q.forEach(i=>{delete i._retryAt;delete i._error;});await putQueue(q);});return await status();
  }
  // Compatibility with the previous extension queue and manual import dialog.
  if(message.type==='FETCH_SUBJECT'&&kind==='bangumi')return {item:(await client.subject(message.id)).item};
  if(message.type==='SAVE_ITEMS'&&kind==='bangumi'){
    if(!Array.isArray(message.items)||message.items.length>500)throw new Error('一次最多保存 500 部');const items=message.items.map(raw=>{const i=C.normalize(raw);if(!i.bangumiId)throw new Error('缺少 Bangumi ID');return {...i,_queueRevision:C.uid()};});
    return serial(async()=>{const old=await getQueue(),map=new Map(old.map(i=>[i.bangumiId,i]));items.forEach(i=>map.set(i.bangumiId,i));const q=await putQueue([...map.values()]);return {count:q.length};});
  }
  if(message.type==='GET_QUEUE'){
    if(kind==='shelf'&&!await trustedShelf(sender))throw new Error('编辑器地址不匹配');await writes.catch(()=>{});const q=await getQueue();return {items:q.filter(i=>i.title),requests:q.filter(i=>!i.title),...await status()};
  }
  if(message.type==='CLEAR_IMPORTED'&&await trustedShelf(sender)){
    const receipts=new Map((message.receipts||[]).map(r=>[String(r.bangumiId),String(r.revision)])),ids=new Set((message.bangumiIds||[]).map(String));
    await serial(async()=>putQueue((await getQueue()).filter(i=>!ids.has(i.bangumiId)||(i._queueRevision&&receipts.get(i.bangumiId)!==i._queueRevision))));return await status();
  }
  throw new Error('此页面不支持该操作');
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{handle(message||{},sender).then(data=>sendResponse({ok:true,...data}),error=>sendResponse({ok:false,error:error.message||String(error)}));return true;});
