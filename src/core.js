/* HHD 王之宝库作品库 · portable data model, migration and encryption. No dependencies. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.Shelf = core;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 4;
  const weekdays = ['周一','周二','周三','周四','周五','周六','周日'];
  const priorities = ['SSR','SR','R'];
  const statuses = {wish:'想看 / 待读',doing:'在看 / 在读',done:'已完成',hold:'搁置',dropped:'放弃'};
  const mediaNames = {anime:'动画',manga:'漫画',novel:'小说'};
  const seriesKinds = {main:'正篇',season:'季度 / 续作',ova:'OVA',oad:'OAD',special:'番外 / 特别篇',movie:'剧场版',part:'上 / 下部',arc:'篇章',mv:'MV / 短片',original:'原作',adaptation:'改编',spinoff:'外传 / 衍生',other:'其他'};
  const gradeBands = [
    {id:'9.6',min:9.6,max:10,label:'9.6–10.0'},
    {id:'9.0',min:9,max:9.5,label:'9.0–9.5'},
    {id:'8.5',min:8.5,max:8.9,label:'8.5–8.9'},
    {id:'8.0',min:8,max:8.4,label:'8.0–8.4'},
    {id:'7.5',min:7.5,max:7.9,label:'7.5–7.9'},
    {id:'7.0',min:7,max:7.4,label:'7.0–7.4'},
    {id:'6.5',min:6.5,max:6.9,label:'6.5–6.9'},
    {id:'6.0',min:6,max:6.4,label:'6.0–6.4'},
    {id:'5.5',min:5.5,max:5.9,label:'5.5–5.9'},
    {id:'5.0',min:5,max:5.4,label:'5.0–5.4'},
    {id:'low',min:0,max:4.9,label:'5.0 以下'}
  ];
  const now = () => new Date().toISOString();
  const uid = () => globalThis.crypto?.randomUUID?.() || 'w-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const str = (v, max=100000) => String(v ?? '').slice(0,max);
  function number(v, fallback=0) {const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.floor(n)):fallback;}
  function score(v) {if(v === '' || v == null)return null;const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=10?Math.round((n+Number.EPSILON)*10)/10:null;}
  function tags(v) {return [...new Set((Array.isArray(v)?v:str(v).split(/[,，、\n]/)).map(x=>str(typeof x==='object'?x?.name:x,80).trim()).filter(Boolean))].slice(0,100);}
  // Calendar tags are displayed once as a year, separate from topic tags.
  function yearTag(v) {return str(v,80).trim().match(/^([12]\d{3})(?:年(?:\d{1,2}月(?:\d{1,2}日?)?|[春夏秋冬]季?)?番?|[-/.]\d{1,2}(?:[-/.]\d{1,2})?)?$/)?.[1]||'';}
  function yearOf(i={}) {
    const explicit=yearTag(i.year),date=yearTag(i.date);
    if(explicit||date)return explicit||date;
    // Older imports kept the Bangumi release date in the generated note.
    const legacy=str(i.note).match(/(?:^|\n)\s*Bangumi\s*[·:：]\s*([12]\d{3})(?=[-/年.\s]|$)/i)?.[1];
    if(legacy)return legacy;
    const candidates=[...new Set(tags(i.tags).map(yearTag).filter(Boolean))];
    return candidates.length===1?candidates[0]:'';
  }
  function topicTags(i) {return [...new Set([...tags(i.personalTags),...tags(i.tags)])].filter(t=>!yearTag(t));}
  function seriesName(v) {return str(v,300).trim().replace(/\s+/g,' ');}
  function seriesKey(v) {return seriesName(v).normalize('NFKC').toLocaleLowerCase();}
  function seriesKind(i) {
    if(Object.hasOwn(seriesKinds,i.seriesKind))return i.seriesKind;
    const name=[i.title,i.originalTitle].join(' '),meta=tags(i.tags).join(' ');
    if(/\bMV\b|音乐视频|ミュージックビデオ/i.test(name))return 'mv';
    if(/\bOAD\b/i.test(name))return 'oad';
    if(/\bOVA\b/i.test(name))return 'ova';
    if(/剧场版|劇場版|映画|总集篇|総集編/.test(name))return 'movie';
    if(/番外|特别篇|特別編|\bSP\b|特典/i.test(name))return 'special';
    if(/外传|外傳|スピンオフ/.test(name))return 'spinoff';
    if(/第[\d一二三四五六七八九十]+[季期]|\b(?:season\s*\d+|\d+(?:st|nd|rd|th)\s+season)\b/i.test(name))return 'season';
    if(/(?:[上中下前后後][篇編部])|第\d+部分|\bpart\s*\d+/i.test(name))return 'part';
    if(/篇(?:章)?$|編$/.test(i.title))return 'arc';
    if(/\bOAD\b/i.test(meta))return 'oad';
    if(/\bOVA\b/i.test(meta))return 'ova';
    if(/剧场版|劇場版/.test(meta))return 'movie';
    return 'main';
  }
  function seriesLabel(i) {return str(i.seriesLabel,80).trim()||str(i.title).match(/第[\d一二三四五六七八九十]+[季期]|第\d+部分|[上中下前后後][篇編部]/)?.[0]||seriesKinds[seriesKind(i)];}
  function seriesOrder(items) {return [...items].sort((a,b)=>{
    const order=i=>i.seriesOrder!==''&&i.seriesOrder!=null&&Number.isFinite(Number(i.seriesOrder))?Number(i.seriesOrder):Infinity;
    return order(a)-order(b)||(Number(yearOf(a))||9999)-(Number(yearOf(b))||9999)||a.title.localeCompare(b.title,'zh-CN',{numeric:true});
  });}
  function seriesMembers(items,name) {const key=seriesKey(name);return key?items.filter(i=>seriesKey(i.series)===key):[];}
  function groupSeries(items,all=items) {
    const allGroups=new Map(),groups=new Map(),out=[];
    for(const i of all){const key=seriesKey(i.series);if(key){if(!allGroups.has(key))allGroups.set(key,[]);allGroups.get(key).push(i);}}
    for(const i of items){const key=seriesKey(i.series);if(!key){out.push(i);continue;}if(!groups.has(key)){const entry={_series:true,key,title:seriesName(i.series),series:seriesName(i.series),matches:[],members:allGroups.get(key)||[]};groups.set(key,entry);out.push(entry);}groups.get(key).matches.push(i);}
    for(const g of groups.values()){
      const ordered=seriesOrder(g.members),representative=ordered.find(i=>i.seriesCover&&i.image)||ordered.find(i=>i.image)||ordered[0];
      const scores=g.matches.map(i=>i.score).filter(s=>s!==null),years=g.matches.map(yearOf).filter(Boolean).sort();
      Object.assign(g,{id:representative.id,image:representative.image,media:representative.media,score:scores.length?Math.max(...scores):null,year:years.at(-1)||'',favorite:g.matches.some(i=>i.favorite),tags:tags(g.matches.flatMap(i=>i.tags)),personalTags:tags(g.matches.flatMap(i=>i.personalTags)),priority:priorities.find(p=>g.matches.some(i=>i.priority===p))||'R',updatedAt:g.matches.map(i=>i.updatedAt||i.createdAt||'').sort().at(-1)||'',createdAt:''});
    }
    return out;
  }
  function seriesBase(title) {
    return seriesName(title).replace(/^(?:剧场版|劇場版|映画)\s*/,'').replace(/\s*(?:第[\d一二三四五六七八九十]+[季期]|第\d+部分|\b(?:season\s*\d+|\d+(?:st|nd|rd|th)\s+season|OVA|OAD|SP|part\s*\d+)\b|番外|特别篇|特別編|[上中下前后後][篇編部]).*$/i,'').replace(/[\s·:：\-—]+$/,'').trim();
  }
  function seriesSuggestions(items) {
    const clean=v=>seriesKey(v).replace(/[\s!！?？·・:：～〜~—\-，,。]/g,''),names=new Map();
    for(const i of items){const name=seriesBase(i.series||i.title);if(name&&clean(name).length>=2&&!names.has(clean(name)))names.set(clean(name),name);}
    const groups=new Map();
    for(const i of items){if(i.series)continue;let key=clean(seriesBase(i.title));const withoutNumber=key.replace(/[2-9二三四五六七八九十]+$/,'');if(withoutNumber.length>=3&&names.has(withoutNumber))key=withoutNumber;
      if(!groups.has(key))groups.set(key,{name:names.get(key)||seriesBase(i.title),ids:[]});groups.get(key).ids.push(i.id);}
    return [...groups.values()].filter(g=>g.name&&(g.ids.length>1||seriesMembers(items,g.name).length)).sort((a,b)=>b.ids.length-a.ids.length||a.name.localeCompare(b.name,'zh-CN'));
  }
  function assignSeries(items,{name,ids,source='',coverId,parts={}}={}) {
    name=seriesName(name);if(!name)throw new Error('请填写系列名称');const selected=new Set(ids||[]);
    if(!selected.size)throw new Error('请至少选择一部作品');if([...selected].some(id=>!items.some(i=>i.id===id)))throw new Error('部分作品已变动，请重新打开整理页面');
    const sourceKey=seriesKey(source),targetKey=seriesKey(name),stamp=now();
    return items.map(i=>{
      if(selected.has(i.id)){const p=parts[i.id]||{};return normalize({...i,series:name,seriesKind:p.kind??i.seriesKind,seriesLabel:p.label??i.seriesLabel,seriesOrder:p.order??i.seriesOrder,seriesCover:coverId!==undefined?i.id===coverId:i.seriesCover,updatedAt:stamp});}
      if(sourceKey&&seriesKey(i.series)===sourceKey)return normalize({...i,series:'',seriesCover:false,updatedAt:stamp});
      if(coverId!==undefined&&seriesKey(i.series)===targetKey&&i.seriesCover)return normalize({...i,seriesCover:false,updatedAt:stamp});
      return i;
    });
  }
  function safeURL(v, image=false) {
    let s=str(v,5000000).trim();if(s.startsWith('//'))s='https:'+s;
    if(image && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z\d+/=\s]+$/i.test(s))return s;
    try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}
  }
  function subjectId(v) {
    const s=str(v,2000).trim();
    if(/^\d+$/.test(s))return s;
    try{const u=new URL(s);if(!['bgm.tv','bangumi.tv','chii.in'].includes(u.hostname))return '';return u.pathname.match(/^\/subject\/(\d+)(?:\/|$)/)?.[1]||'';}catch{return '';}
  }
  function parseSubjectList(value) {
    const tokens=str(value,300000).split(/[\s,，;；、]+/).map(s=>s.trim()).filter(Boolean);
    const ids=[],invalid=[],seen=new Set();let duplicates=0;
    for(const token of tokens){const id=subjectId(token);if(!id){invalid.push(token);continue;}if(seen.has(id)){duplicates++;continue;}seen.add(id);ids.push(id);}
    if(ids.length>2000)throw new Error('一次最多读取 2000 部作品，请分批粘贴');
    return {ids,invalid,duplicates};
  }
  function applyImportOptions(raw,options={}) {
    const original=normalize(raw),media=options.media&&options.media!=='auto'?options.media:original.media;
    const type=media==='anime'?(options.type&&options.type!=='keep'?options.type:original.media==='anime'?original.type:'binge'):media;
    const result=normalize({...original,media,type,unit:media===original.media?original.unit:media==='anime'?'集':media==='manga'?'话':'卷'});
    if(options.status&&options.status!=='keep'){result.status=options.status;if(result.status==='done'&&result.total!=='')result.current=result.total;}
    if(options.placement==='library')result.inWatchlist=false;
    if(options.placement==='watch')result.inWatchlist=true;
    if(['done','dropped'].includes(result.status))result.inWatchlist=false;
    if(priorities.includes(options.priority))result.priority=options.priority;
    if(weekdays.includes(options.weekday)&&result.type==='daily')result.weekday=options.weekday;
    result.personalTags=tags([...result.personalTags,...tags(options.personalTags||[])]);
    if(seriesName(options.series))result.series=seriesName(options.series);
    return normalize(result);
  }
  function normalize(raw={}) {
    if(!raw || typeof raw!=='object' || Array.isArray(raw))throw new Error('作品记录格式不正确');
    let type=['daily','binge','manga','novel'].includes(raw.type)?raw.type:'binge';
    let media=['anime','manga','novel'].includes(raw.media)?raw.media: (type==='manga'?'manga':type==='novel'?'novel':'anime');
    if(media!=='anime')type=media;else if(!['daily','binge'].includes(type))type='binge';
    const current=number(raw.current);
    const total=raw.total==='' || raw.total==null || Number(raw.total)===0?'':number(raw.total,'');
    const status=Object.hasOwn(statuses,raw.status)?raw.status: (total!==''&&current>=total?'done':current>0||type==='daily'?'doing':'wish');
    const weekday=weekdays.includes(raw.weekday)?raw.weekday:weekdays.includes(raw.subtype)?raw.subtype:(type==='daily'?'周一':'');
    const priority=priorities.includes(raw.priority)?raw.priority:priorities.includes(raw.tier)?raw.tier:priorities.includes(raw.subtype)?raw.subtype:'R';
    const bangumiId=subjectId(raw.bangumiId)||subjectId(raw.sourceUrl);
    const date=str(raw.updatedAt||raw.importedAt||'');
    return {
      ...raw, id:str(raw.id||uid(),120),title:str(raw.title||raw.name_cn||raw.name||'未命名作品',300),
      originalTitle:str(raw.originalTitle,300),media,type,weekday,priority,subtype:type==='daily'?weekday:priority,
      status,current,total,inWatchlist:typeof raw.inWatchlist==='boolean'?raw.inWatchlist:!['done','dropped'].includes(status),unit:['集','话','卷','章'].includes(raw.unit)?raw.unit:media==='anime'?'集':media==='manga'?'话':'卷',
      score:score(raw.score),bgmScore:score(raw.bgmScore),favorite:raw.favorite===true,
      image:safeURL(raw.image,true),tags:tags(raw.tags),personalTags:tags(raw.personalTags),
      sourceUrl:safeURL(raw.sourceUrl)||(bangumiId?'https://bgm.tv/subject/'+bangumiId:''),bangumiId,
      note:str(raw.note),review:str(raw.review),summary:str(raw.summary),series:seriesName(raw.series),
      seriesKind:Object.hasOwn(seriesKinds,raw.seriesKind)?raw.seriesKind:'',seriesLabel:str(raw.seriesLabel,80).trim(),seriesOrder:raw.seriesOrder==null||raw.seriesOrder===''?'':number(raw.seriesOrder),seriesCover:raw.seriesCover===true,
      year:str(raw.year,4),date:str(raw.date,20),createdAt:str(raw.createdAt||raw.importedAt||''),updatedAt:date,
      importedAt:str(raw.importedAt),finishedAt:str(raw.finishedAt),
      comments:(Array.isArray(raw.comments)?raw.comments:[]).filter(x=>x&&typeof x==='object').map(x=>({id:str(x.id||uid()),text:str(x.text),at:str(x.at||now())})),
      scoreHistory:(Array.isArray(raw.scoreHistory)?raw.scoreHistory:[]).filter(x=>x&&score(x.score)!==null).map(x=>({score:score(x.score),at:str(x.at)}))
    };
  }
  function parsePayload(input) {
    let p=typeof input==='string'?JSON.parse(input.replace(/^\uFEFF/,'')):input;
    if(p?.encrypted)throw new Error('此备份已加密，请先解锁');
    const list=Array.isArray(p)?p:p?.items;
    if(!Array.isArray(list))throw new Error('未找到作品数组；请使用旧版或新版导出的 JSON 备份');
    if(list.length>20000)throw new Error('一次最多导入 20000 部作品');
    const ids=new Set();const items=list.map(normalize).map(i=>{if(ids.has(i.id))i.id=uid();ids.add(i.id);return i;});
    return {version:VERSION,title:str(!p.title||p.title==='HHD 的作品库'?'王之宝库':p.title,80),publishedAt:str(p.publishedAt),items};
  }
  function duplicate(items, item) {
    return items.find(i=> i.id===item.id || (item.bangumiId&&i.bangumiId===item.bangumiId) || (!item.bangumiId&&!i.bangumiId&&i.media===item.media&&i.title===item.title));
  }
  function merge(items,incoming,mode='fill') {
    const result=items.map(i=>normalize(i));let added=0,updated=0,skipped=0;
    for(const raw of incoming){
      const n=normalize(raw),old=duplicate(result,n);
      if(!old){n.id=result.some(x=>x.id===n.id)?uid():n.id;result.push(n);added++;continue;}
      if(mode==='skip'){skipped++;continue;}
      if(mode==='replace'){Object.assign(old,n,{id:old.id,updatedAt:now()});updated++;continue;}
      // Re-import only fills empty metadata. Personal scores, reviews, progress,
      // classification, chosen covers and personal tags are never overwritten.
      for(const k of ['originalTitle','image','summary','sourceUrl','bangumiId','year','date'])if(!old[k]&&n[k])old[k]=n[k];
      if(old.total===''&&n.total!=='')old.total=n.total;
      if(old.bgmScore==null&&n.bgmScore!=null)old.bgmScore=n.bgmScore;
      if(!old.tags.length)old.tags=[...n.tags];
      updated++;
    }
    return {items:result,added,updated,skipped};
  }
  function grade(i) {return i.score==null?'unrated':gradeBands.find(b=>i.score>=b.min&&i.score<=b.max)?.id||'unrated';}
  function isWatching(i) {return i.inWatchlist!==false&&!['done','dropped'].includes(i.status);}
  function filter(items,f={}) {
    const words=str(f.query).toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const selected=tags([...(Array.isArray(f.tags)?f.tags:[]),...(f.tag?[f.tag]:[])]);
    const years=tags(Array.isArray(f.years)?f.years:[]);
    return items.filter(i=>{
      const own=[...i.tags,...i.personalTags];
      const tagged=!selected.length||(f.tagMode==='any'?selected.some(t=>own.includes(t)):selected.every(t=>own.includes(t)));
      return (!f.media||f.media==='all'||i.media===f.media)&&(!f.status||i.status===f.status)&&(!f.grade||grade(i)===f.grade)&&(!f.favorite||i.favorite)&&(!years.length||years.includes(yearOf(i)||'unknown'))&&tagged&&words.every(w=>`${i.title} ${i.originalTitle} ${yearOf(i)} ${i.tags.join(' ')} ${i.personalTags.join(' ')} ${i.note} ${i.review} ${i.series}`.toLocaleLowerCase().includes(w));
    });
  }
  function sort(items,by='recent') {
    return [...items].sort((a,b)=>{
      if(by==='year')return Number(yearOf(b))-Number(yearOf(a))||a.title.localeCompare(b.title,'zh-CN');
      if(by==='score')return (b.score??-1)-(a.score??-1)||a.title.localeCompare(b.title,'zh-CN');
      if(by==='title')return a.title.localeCompare(b.title,'zh-CN');
      if(by==='priority')return priorities.indexOf(a.priority)-priorities.indexOf(b.priority)||a.title.localeCompare(b.title,'zh-CN');
      return Number(b.favorite)-Number(a.favorite)||(b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt)||a.title.localeCompare(b.title,'zh-CN');
    });
  }
  function bgmSubject(s,collection=null) {
    if(!s||![1,2].includes(Number(s.type)))throw new Error('只支持动画、漫画和小说条目');
    const tagList=tags([...(s.meta_tags||[]),...(s.tags||[])]);
    const novelTag=[s.platform,...tagList].some(t=>/^(?:小说|小說|轻小说|輕小說|Novel|Light Novel)$/i.test(str(t).trim()));
    let media=Number(s.type)===2?'anime':/漫画|漫畫|Manga/i.test(s.platform||'')?'manga':novelTag?'novel':'manga';
    const info=(keys)=>{const row=(s.infobox||[]).find(x=>keys.includes(x.key));return row?typeof row.value==='string'?row.value:'':'';};
    const dayText=info(['放送星期','放送日']);const digit=dayText.replace(/星期|周|曜日/g,'').match(/[一二三四五六日天月火水木金土]/)?.[0];
    const weekday=({'一':'周一','二':'周二','三':'周三','四':'周四','五':'周五','六':'周六','日':'周日','天':'周日','月':'周一','火':'周二','水':'周三','木':'周四','金':'周五','土':'周六'})[digit]||'';
    const status=collection?({1:'wish',2:'done',3:'doing',4:'hold',5:'dropped'})[collection.type]||'wish':'wish';
    return normalize({id:'bgm-'+s.id,bangumiId:String(s.id),title:s.name_cn||s.name,originalTitle:s.name,media,
      type:media==='anime'?(status==='doing'&&weekday?'daily':'binge'):media,weekday,status,
      current:collection?(media==='novel'?collection.vol_status:collection.ep_status):0,
      total:media==='novel'?(s.volumes||''):(s.eps||s.total_episodes||''),
      image:s.images?.common||s.images?.large||s.images?.medium||'',tags:tagList,personalTags:collection?.tags||[],
      score:collection?.rate?collection.rate:null,bgmScore:s.rating?.score??s.score??null,
      summary:s.summary||s.short_summary||'',review:collection?.comment||'',date:s.date||'',year:s.date?.slice(0,4)||'',
      importedAt:now(),sourceUrl:'https://bgm.tv/subject/'+s.id,
      classificationUncertain:Number(s.type)===1&&!s.platform&&!tagList.some(x=>/漫画|小说/.test(x))
    });
  }
  function bytes64(a){let s='';for(let j=0;j<a.length;j+=32768)s+=String.fromCharCode(...a.subarray(j,j+32768));return btoa(s);}
  function un64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
  async function keyFor(password,salt,iterations){
    if(!globalThis.crypto?.subtle)throw new Error('当前浏览器不支持加密，请使用新版 Chrome、Edge 或 HTTPS 网站');
    const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function encrypt(payload,password){
    if(password.length<8)throw new Error('加密口令至少需要 8 个字符');
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iterations=310000;
    const key=await keyFor(password,salt,iterations);
    const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(payload)));
    return {version:VERSION,encrypted:true,algorithm:'AES-GCM',kdf:'PBKDF2-SHA256',iterations,salt:bytes64(salt),iv:bytes64(iv),ciphertext:bytes64(new Uint8Array(data))};
  }
  async function decrypt(p,password){
    if(!p.encrypted)return parsePayload(p);
    if(p.algorithm!=='AES-GCM'||p.kdf!=='PBKDF2-SHA256'||!Number.isInteger(p.iterations)||p.iterations<100000||p.iterations>1000000)throw new Error('不支持的加密备份格式');
    try{const key=await keyFor(password,un64(p.salt),p.iterations);const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(p.iv)},key,un64(p.ciphertext));return parsePayload(new TextDecoder().decode(raw));}catch{throw new Error('口令不正确，或加密文件已损坏');}
  }
  return {VERSION,weekdays,priorities,statuses,mediaNames,seriesKinds,gradeBands,now,uid,str,number,score,tags,yearTag,yearOf,topicTags,seriesName,seriesKey,seriesKind,seriesLabel,seriesOrder,seriesMembers,groupSeries,seriesBase,seriesSuggestions,assignSeries,safeURL,subjectId,parseSubjectList,applyImportOptions,normalize,parsePayload,duplicate,merge,grade,isWatching,filter,sort,bgmSubject,bytes64,un64,encrypt,decrypt};
});
