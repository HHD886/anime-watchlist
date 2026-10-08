(() => {
  'use strict';
  if(window.__KING_SHELF_BRIDGE_V42__||!document.querySelector('meta[name="anime-watchlist-template"]'))return;
  const boot=document.getElementById('boot-data');if(boot){try{if(JSON.parse(boot.textContent).role!=='editor')return;}catch{return;}}
  window.__KING_SHELF_BRIDGE_V42__=true;
  const send=message=>new Promise((resolve,reject)=>chrome.runtime.sendMessage(message,result=>{const e=chrome.runtime.lastError;if(e)reject(new Error('插件已更新，请刷新此网页：'+e.message));else if(!result?.ok)reject(new Error(result?.error||'插件没有响应'));else resolve(result);}));
  const post=(type,extra={})=>window.postMessage({source:'bangumi-import-extension',type,...extra},location.protocol==='file:'?'*':location.origin);
  async function ready(){const r=await send({type:'GET_QUEUE'});post('EXTENSION_READY',{version:r.version,count:r.items.length});}
  window.addEventListener('message',async e=>{
    if(e.source!==window||e.data?.source!=='anime-watchlist-html'||e.origin!==location.origin)return;
    try{
      if(e.data.type==='HTML_READY')await ready();
      if(e.data.type==='REQUEST_QUEUE'){const r=await send({type:'GET_QUEUE'});post('QUEUE_DATA',{items:r.items,version:r.version});}
      if(e.data.type==='CLEAR_IMPORTED'){await send({type:'CLEAR_IMPORTED',bangumiIds:e.data.bangumiIds,receipts:e.data.receipts});await ready();}
    }catch(err){post('EXTENSION_ERROR',{message:err.message});}
  });
  ready().catch(()=>{});
})();
