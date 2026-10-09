'use strict';
const $=id=>document.getElementById(id),send=async m=>{const r=await chrome.runtime.sendMessage(m);if(!r?.ok)throw new Error(r?.error||'读取失败');return r;};
async function refresh(){const r=await send({type:'STATUS'});$('count').textContent=`待同步 ${r.count} 部 · ${r.at?'最后同步 '+new Date(r.at).toLocaleString():'尚未与作品库连接'}${r.error?' · '+r.error:''}`;$('target').value=r.target;}
function action(id,fn){$(id).addEventListener('click',()=>Promise.resolve().then(fn).catch(e=>$('count').textContent=e.message));}
action('open',()=>send({type:'OPEN_LIBRARY'}));
action('retry',async()=>{await send({type:'RETRY_SYNC'});await refresh();$('count').textContent+='。请保持作品库编辑器打开。';});
action('save',async()=>{await send({type:'SET_TARGET',url:$('target').value.trim()});await refresh();$('count').textContent='地址已保存，请刷新对应的作品库编辑器。';});
action('export',async()=>{const r=await send({type:'GET_QUEUE'});if(!r.count){$('count').textContent='队列为空';return;}const url=URL.createObjectURL(new Blob([JSON.stringify({version:4,title:'王之宝库',items:r.items,importRequests:r.requests||[]},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='王之宝库-Bangumi待同步队列.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);$('count').textContent=`已备份 ${r.count} 个请求，可在网站“JSON 备份”导入。`;});
refresh().catch(e=>$('count').textContent=e.message);
