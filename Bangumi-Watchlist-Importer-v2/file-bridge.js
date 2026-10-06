(() => {
  if (!document.querySelector('meta[name="anime-watchlist-template"]')) return;
  const send = message => new Promise(resolve => chrome.runtime.sendMessage(message, resolve));
  function post(type, extra={}) { window.postMessage({source:'bangumi-import-extension',type,...extra},'*'); }
  window.addEventListener('message', async event => {
    if (event.source !== window || !event.data || event.data.source !== 'anime-watchlist-html') return;
    try {
      if (event.data.type === 'REQUEST_QUEUE' || event.data.type === 'HTML_READY') {
        const result=await send({type:'GET_QUEUE'});
        if(!result?.ok) throw new Error(result?.error || '读取插件数据失败');
        if(event.data.type === 'HTML_READY') post('EXTENSION_READY',{count:result.items?.length||0});
        else post('QUEUE_DATA',{items:result.items||[]});
      }
      if (event.data.type === 'CLEAR_IMPORTED') {
        const result=await send({type:'CLEAR_IMPORTED',bangumiIds:event.data.bangumiIds||[]});
        if(!result?.ok) throw new Error(result?.error || '清理导入队列失败');
      }
    } catch(error) { post('EXTENSION_ERROR',{message:error?.message || String(error)}); }
  });
  post('EXTENSION_READY');
})();
