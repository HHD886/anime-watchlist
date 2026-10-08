'use strict';
const status=document.getElementById('count');
async function queue(){const r=await chrome.runtime.sendMessage({type:'GET_QUEUE'});if(!r?.ok)throw new Error(r?.error||'读取失败');return r.items;}
queue().then(items=>status.textContent=`待导入：${items.length} 部作品`).catch(e=>status.textContent=e.message);
document.getElementById('export').addEventListener('click',async()=>{try{const items=await queue();if(!items.length){status.textContent='队列为空，请先从 Bangumi 加入作品';return;}const url=URL.createObjectURL(new Blob([JSON.stringify({version:4,title:'王之宝库',items},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='王之宝库-Bangumi导入队列.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);status.textContent=`已导出 ${items.length} 部，可在网站导入 JSON。`;}catch(e){status.textContent=e.message;}});
