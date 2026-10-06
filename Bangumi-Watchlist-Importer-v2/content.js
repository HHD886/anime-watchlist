(() => {
  if (window.__BGM_WATCHLIST_IMPORTER_V2__) return;
  window.__BGM_WATCHLIST_IMPORTER_V2__ = true;

  const host = document.createElement('div');
  host.id = 'bgm-watchlist-importer';
  host.innerHTML = `
    <div class="bwi-title">追番表手动导入</div>
    <label class="bwi-label">导入区域</label>
    <select class="bwi-target">
      <option value="daily">每日更新区</option>
      <option value="binge">完结待看区</option>
      <option value="manga">漫画待看区</option>
      <option value="novel">小说待看区</option>
    </select>
    <div class="bwi-weekday-wrap">
      <label class="bwi-label">更新星期</label>
      <select class="bwi-weekday">
        <option>周一</option><option>周二</option><option>周三</option><option>周四</option><option>周五</option><option>周六</option><option>周日</option>
      </select>
    </div>
    <label class="bwi-label">优先级</label>
    <select class="bwi-tier">
      <option value="SSR">SSR · 最优先</option><option value="SR">SR · 比较想看</option><option value="R">R · 有空再看</option>
    </select>
    <button class="bwi-current">导入当前条目</button>
    <button class="bwi-page">按以上设置导入本页</button>
    <div class="bwi-status">区域、星期和优先级均由你决定，不再自动分类。</div>`;
  const style = document.createElement('style');
  style.textContent = `
    #bgm-watchlist-importer{position:fixed;right:16px;bottom:18px;z-index:2147483647;width:210px;padding:12px;border:1px solid rgba(120,120,140,.28);border-radius:14px;background:rgba(255,255,255,.96);box-shadow:0 10px 32px rgba(20,24,36,.18);font:13px/1.4 system-ui,"Microsoft YaHei",sans-serif;color:#222;backdrop-filter:blur(12px)}
    #bgm-watchlist-importer .bwi-title{font-weight:800;margin-bottom:8px}
    #bgm-watchlist-importer .bwi-label{display:block;margin-top:7px;color:#666;font-size:11px}
    #bgm-watchlist-importer select,#bgm-watchlist-importer button{width:100%;margin-top:4px;padding:8px 9px;border:1px solid #ddd;border-radius:9px;background:#fff;color:#222;font:inherit}
    #bgm-watchlist-importer button{margin-top:8px;cursor:pointer;background:#6c63ff;color:#fff;border-color:#6c63ff}
    #bgm-watchlist-importer button.bwi-page{background:#fff;color:#4d47c9}
    #bgm-watchlist-importer button:disabled{opacity:.55;cursor:wait}
    #bgm-watchlist-importer .bwi-status{margin-top:8px;color:#777;font-size:11px;word-break:break-word}
    #bgm-watchlist-importer .bwi-weekday-wrap[hidden]{display:none}
    html[data-theme="dark"] #bgm-watchlist-importer{background:rgba(32,34,43,.96);color:#f4f4f7;border-color:#444}
    html[data-theme="dark"] #bgm-watchlist-importer select,html[data-theme="dark"] #bgm-watchlist-importer button.bwi-page{background:#252833;color:#eee;border-color:#444}`;
  document.documentElement.append(style);
  document.body.append(host);

  const currentBtn = host.querySelector('.bwi-current');
  const pageBtn = host.querySelector('.bwi-page');
  const targetSelect = host.querySelector('.bwi-target');
  const weekdayWrap = host.querySelector('.bwi-weekday-wrap');
  const weekdaySelect = host.querySelector('.bwi-weekday');
  const tierSelect = host.querySelector('.bwi-tier');
  const status = host.querySelector('.bwi-status');
  const currentMatch = location.pathname.match(/\/subject\/(\d+)/);
  if (!currentMatch) currentBtn.disabled = true;

  const send = message => new Promise(resolve => chrome.runtime.sendMessage(message, resolve));
  const sleep = ms => new Promise(r => setTimeout(r,ms));
  function refreshControls() { weekdayWrap.hidden = targetSelect.value !== 'daily'; }
  function setBusy(busy,text) {
    currentBtn.disabled = busy || !currentMatch; pageBtn.disabled = busy;
    targetSelect.disabled = busy; weekdaySelect.disabled = busy; tierSelect.disabled = busy;
    if(text) status.textContent=text;
  }
  function applyPlacement(item) {
    const type = targetSelect.value;
    const priority = tierSelect.value;
    const weekday = type === 'daily' ? weekdaySelect.value : '';
    return { ...item, type, weekday, priority, subtype: type === 'daily' ? weekday : priority };
  }

  async function fetchOne(id) {
    const result = await send({type:'FETCH_SUBJECT',id});
    if (!result?.ok) throw new Error(result?.error || '读取失败');
    return applyPlacement(result.item);
  }
  async function save(items) {
    const result = await send({type:'SAVE_ITEMS',items});
    if (!result?.ok) throw new Error(result?.error || '保存失败');
    return result.queue?.length || 0;
  }

  targetSelect.addEventListener('change', refreshControls);
  refreshControls();

  currentBtn.addEventListener('click', async () => {
    try {
      setBusy(true,'正在读取当前条目…');
      const item=await fetchOne(currentMatch[1]);
      const count=await save([item]);
      const place=item.type==='daily'?`${item.weekday} · ${item.priority}`:`${targetSelect.options[targetSelect.selectedIndex].text} · ${item.priority}`;
      status.textContent=`已保存《${item.title}》到 ${place}；待同步 ${count} 条`;
    } catch(e){status.textContent='失败：'+e.message;} finally {setBusy(false); refreshControls();}
  });

  pageBtn.addEventListener('click', async () => {
    const ids=[...new Set([...document.querySelectorAll('a[href*="/subject/"]')].map(a => (a.getAttribute('href')||'').match(/\/subject\/(\d+)/)?.[1]).filter(Boolean))].slice(0,80);
    if(currentMatch && !ids.includes(currentMatch[1])) ids.unshift(currentMatch[1]);
    if(!ids.length){status.textContent='本页没有找到条目链接';return;}
    try {
      setBusy(true,`找到 ${ids.length} 个条目，正在读取…`); const items=[]; let failed=0;
      for(let i=0;i<ids.length;i++){
        status.textContent=`正在读取 ${i+1}/${ids.length}…`;
        try{items.push(await fetchOne(ids[i]));}catch{failed++;}
        await sleep(120);
      }
      const count=items.length?await save(items):0;
      status.textContent=`已按当前设置保存 ${items.length} 条，失败 ${failed} 条；待同步 ${count} 条`;
    } catch(e){status.textContent='失败：'+e.message;} finally {setBusy(false); refreshControls();}
  });
})();
