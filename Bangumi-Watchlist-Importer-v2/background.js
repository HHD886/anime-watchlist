'use strict';
importScripts('core.js');
const QUEUE_KEY='watchlist_import_queue_v1'; // Keep the old queue when upgrading in place.
const C=globalThis.Shelf;
let queueWrites=Promise.resolve();
async function getQueue(){const data=await chrome.storage.local.get(QUEUE_KEY);return Array.isArray(data[QUEUE_KEY])?data[QUEUE_KEY]:[];}
function changeQueue(update){const op=queueWrites.catch(()=>{}).then(async()=>{const queue=await update(await getQueue());if(queue.length>20000)throw new Error('待导入队列超过 20000 部，请先同步到作品库');await chrome.storage.local.set({[QUEUE_KEY]:queue});return queue;});queueWrites=op;return op;}
function senderKind(sender){try{const u=new URL(sender.url||'');if(u.protocol==='chrome-extension:'&&u.hostname===chrome.runtime.id)return 'popup';if(u.protocol==='https:'&&['bgm.tv','bangumi.tv','chii.in'].includes(u.hostname))return 'bangumi';if(u.protocol==='https:'&&u.hostname==='hhd886.github.io'&&u.pathname.startsWith('/anime-watchlist/'))return 'shelf';if(u.protocol==='file:')return 'shelf';}catch{}return '';}
async function fetchSubject(value){const id=C.subjectId(value);if(!id)throw new Error('条目 ID 无效');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const r=await fetch('https://api.bgm.tv/v0/subjects/'+id,{headers:{Accept:'application/json'},signal:controller.signal,credentials:'omit'});if(!r.ok)throw new Error('Bangumi 请求失败：HTTP '+r.status);return C.bgmSubject(await r.json());}catch(e){if(e.name==='AbortError')throw new Error('读取超时，请重试该条目');throw e;}finally{clearTimeout(timer);}}
async function handle(message,sender){
  const kind=senderKind(sender);if(!kind)throw new Error('此页面不能访问导入队列');
  if(message.type==='FETCH_SUBJECT'&&kind==='bangumi')return {item:await fetchSubject(message.id)};
  if(message.type==='SAVE_ITEMS'&&kind==='bangumi'){
    if(!Array.isArray(message.items)||message.items.length>500)throw new Error('一次最多保存 500 部作品');
    const items=message.items.map(raw=>{const i=C.normalize(raw);if(!i.bangumiId)throw new Error('缺少 Bangumi ID');return {...i,_queueRevision:C.uid()};});
    const queue=await changeQueue(old=>{const map=new Map(old.map(i=>[String(i.bangumiId),i]));items.forEach(i=>map.set(i.bangumiId,i));return [...map.values()];});return {count:queue.length};
  }
  if(message.type==='GET_QUEUE'){await queueWrites.catch(()=>{});return {items:await getQueue(),version:chrome.runtime.getManifest().version};}
  if(message.type==='CLEAR_IMPORTED'&&kind==='shelf'){
    const receipts=Array.isArray(message.receipts)?new Map(message.receipts.map(r=>[String(r.bangumiId),String(r.revision)])):new Map();
    const ids=new Set((message.bangumiIds||[]).map(String));
    const items=await changeQueue(queue=>queue.filter(i=>{const id=String(i.bangumiId);if(!ids.has(id))return true;if(i._queueRevision)return receipts.get(id)!==i._queueRevision;return false;}));return {count:items.length};
  }
  throw new Error('此页面不支持该操作');
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{handle(message||{},sender).then(data=>sendResponse({ok:true,...data}),error=>sendResponse({ok:false,error:error.message||String(error)}));return true;});
