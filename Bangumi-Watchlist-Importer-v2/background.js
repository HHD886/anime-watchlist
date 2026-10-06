const QUEUE_KEY = 'watchlist_import_queue_v1';
const API_BASE = 'https://api.bgm.tv/v0/subjects/';

function valueText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join('、');
  if (typeof value === 'object') return valueText(value.v ?? value.value ?? value.name ?? '');
  return '';
}
function infoValue(subject, keys) {
  const rows = Array.isArray(subject.infobox) ? subject.infobox : [];
  for (const key of keys) {
    const row = rows.find(x => String(x?.key || '').trim() === key);
    if (row) return valueText(row.value).trim();
  }
  return '';
}
function normalizeWeekday(text) {
  const s = String(text || '').replace(/星期|周/g, '').trim();
  const map = { '一':'周一','二':'周二','三':'周三','四':'周四','五':'周五','六':'周六','日':'周日','天':'周日', '1':'周一','2':'周二','3':'周三','4':'周四','5':'周五','6':'周六','7':'周日' };
  for (const [key, value] of Object.entries(map)) if (s.includes(key)) return value;
  return '';
}
function numberFrom(value) {
  const m = String(value || '').match(/\d+/);
  return m ? Number(m[0]) : '';
}

function normalizeImage(url) {
  const s = String(url || '');
  return s.startsWith('//') ? 'https:' + s : s;
}
function normalizeSubject(subject) {
  const id = String(subject.id || '');
  const subjectType = Number(subject.type);
  if (![1,2].includes(subjectType)) throw new Error('该条目不是动画、漫画或小说');
  const tags = (Array.isArray(subject.tags) ? subject.tags : []).map(x => x?.name).filter(Boolean).slice(0,12);
  const metaTags = (Array.isArray(subject.meta_tags) ? subject.meta_tags : []).filter(Boolean);
  const total = Number(subject.total_episodes || 0) || numberFrom(infoValue(subject,['话数','册数','卷数'])) || '';
  return {
    id: `bgm-${id}`,
    bangumiId: id,
    title: subject.name_cn || subject.name || `Bangumi #${id}`,
    originalTitle: subject.name || '',
    type: 'binge',
    subtype: 'R',
    weekday: '',
    priority: 'R',
    sourceKind: subjectType === 2 ? 'anime' : 'book',
    current: 0,
    total,
    image: normalizeImage(subject.images?.large || subject.images?.common || subject.images?.medium || subject.images?.small || ''),
    tags: [...new Set([...metaTags,...tags])].slice(0,12),
    sourceUrl: `https://bgm.tv/subject/${id}`,
    note: subject.date ? `Bangumi · ${subject.date}` : '来自 Bangumi',
    importedAt: new Date().toISOString()
  };
}
async function fetchSubject(id) {
  const response = await fetch(API_BASE + encodeURIComponent(id), { headers: { 'Accept': 'application/json' } });
  if (!response.ok) throw new Error(`Bangumi API 请求失败：HTTP ${response.status}`);
  return normalizeSubject(await response.json());
}
async function getQueue() {
  const data = await chrome.storage.local.get(QUEUE_KEY);
  return Array.isArray(data[QUEUE_KEY]) ? data[QUEUE_KEY] : [];
}
async function saveQueue(incoming) {
  const queue = await getQueue();
  const map = new Map(queue.map(x => [String(x.bangumiId),x]));
  for (const item of incoming) map.set(String(item.bangumiId),item);
  const merged = [...map.values()];
  await chrome.storage.local.set({[QUEUE_KEY]:merged});
  return merged;
}
async function clearImported(ids) {
  const set = new Set((ids || []).map(String));
  const queue = (await getQueue()).filter(x => !set.has(String(x.bangumiId)));
  await chrome.storage.local.set({[QUEUE_KEY]:queue});
  return queue;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'FETCH_SUBJECT') sendResponse({ok:true,item:await fetchSubject(message.id)});
      else if (message.type === 'SAVE_ITEMS') sendResponse({ok:true,queue:await saveQueue(message.items || [])});
      else if (message.type === 'GET_QUEUE') sendResponse({ok:true,items:await getQueue()});
      else if (message.type === 'CLEAR_IMPORTED') sendResponse({ok:true,items:await clearImported(message.bangumiIds || [])});
      else sendResponse({ok:false,error:'未知操作'});
    } catch (error) { sendResponse({ok:false,error:error?.message || String(error)}); }
  })();
  return true;
});
