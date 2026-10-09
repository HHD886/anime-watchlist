(() => {
  'use strict';
  if(window.__KING_SHELF_BRIDGE_V45__||!document.querySelector('meta[name="anime-watchlist-template"]'))return;
  const boot=document.getElementById('boot-data');try{if(JSON.parse(boot?.textContent||'{}').role!=='editor')return;}catch{return;}
  window.__KING_SHELF_BRIDGE_V45__=true;
  let active=false,pulling=false,outstanding=false,outstandingAt=0,lastIndex=null;
  const send=message=>new Promise((resolve,reject)=>chrome.runtime.sendMessage(message,result=>{const e=chrome.runtime.lastError;if(e)reject(new Error('插件已更新，请刷新此网页：'+e.message));else if(!result?.ok)reject(new Error(result?.error||'插件没有响应'));else resolve(result);}));
  const post=(type,extra={})=>window.postMessage({source:'bangumi-import-extension',type,...extra},location.protocol==='file:'?'*':location.origin);
  const status=r=>post('SYNC_STATUS',{at:r.at,count:r.count,error:r.error});
  async function ready(){const r=await send({type:'HELLO'});post('EXTENSION_READY',{version:r.version,count:r.count});status(r);}
  async function pull(){if(outstanding&&Date.now()-outstandingAt>130000)outstanding=false;if(!active||pulling||outstanding)return;pulling=true;try{if(lastIndex)status(await send({type:'LIBRARY_INDEX',index:lastIndex}));const r=await send({type:'NEXT_IMPORT'});status(r);if(r.job){outstanding=true;outstandingAt=Date.now();post('IMPORT_JOB',{job:r.job});}}catch(e){post('SYNC_STATUS',{error:e.message});}finally{pulling=false;}}
  window.addEventListener('message',async e=>{
    if(e.source!==window||e.origin!==location.origin||e.data?.source!=='anime-watchlist-html')return;
    const m=e.data;try{
      if(m.type==='HTML_READY')await ready();
      if(m.type==='LIBRARY_INDEX'){lastIndex=m.index;active=true;status(await send({type:'LIBRARY_INDEX',index:lastIndex}));pull();}
      if(m.type==='IMPORT_RESULT'){status(await send({type:'IMPORT_RESULT',receipt:m.receipt,index:m.index,error:m.error}));outstanding=false;setTimeout(pull,200);}
      if(m.type==='SYNC_REQUEST'){await send({type:'RETRY_SYNC'});await ready();pull();}
      if(m.type==='REQUEST_QUEUE'){const r=await send({type:'GET_QUEUE'});post('QUEUE_DATA',{items:r.items,version:r.version});}
      if(m.type==='CLEAR_IMPORTED'){await send({type:'CLEAR_IMPORTED',bangumiIds:m.bangumiIds,receipts:m.receipts});await ready();}
    }catch(err){if(m.type==='IMPORT_RESULT')outstanding=false;post('SYNC_STATUS',{error:err.message});if(['REQUEST_QUEUE','CLEAR_IMPORTED'].includes(m.type))post('EXTENSION_ERROR',{message:err.message});}
  });
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.watchlist_import_queue_v1)setTimeout(pull,150);});
  setInterval(pull,15000);ready().catch(e=>post('SYNC_STATUS',{error:e.message}));
})();
