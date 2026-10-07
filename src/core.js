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
  const now = () => new Date().toISOString();
  const uid = () => globalThis.crypto?.randomUUID?.() || 'w-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const str = (v, max=100000) => String(v ?? '').slice(0,max);
  function number(v, fallback=0) {const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.floor(n)):fallback;}
  function score(v) {if(v === '' || v == null)return null;const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=10?Math.round((n+Number.EPSILON)*10)/10:null;}
  function tags(v) {return [...new Set((Array.isArray(v)?v:str(v).split(/[,，、\n]/)).map(x=>str(typeof x==='object'?x?.name:x,80).trim()).filter(Boolean))].slice(0,100);}
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
      status,current,total,unit:['集','话','卷','章'].includes(raw.unit)?raw.unit:media==='anime'?'集':media==='manga'?'话':'卷',
      score:score(raw.score),bgmScore:score(raw.bgmScore),favorite:raw.favorite===true,
      image:safeURL(raw.image,true),tags:tags(raw.tags),personalTags:tags(raw.personalTags),
      sourceUrl:safeURL(raw.sourceUrl)||(bangumiId?'https://bgm.tv/subject/'+bangumiId:''),bangumiId,
      note:str(raw.note),review:str(raw.review),summary:str(raw.summary),series:str(raw.series,300),
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
  function grade(i) {return i.score===null?'unrated':i.score>=9?'9':i.score>=8?'8':i.score>=7?'7':'low';}
  function filter(items,f={}) {
    const words=str(f.query).toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return items.filter(i=>(!f.media||f.media==='all'||i.media===f.media)&&(!f.status||i.status===f.status)&&(!f.grade||grade(i)===f.grade)&&(!f.favorite||i.favorite)&&(!f.tag||[...i.tags,...i.personalTags].includes(f.tag))&&words.every(w=>`${i.title} ${i.originalTitle} ${i.tags.join(' ')} ${i.personalTags.join(' ')} ${i.note} ${i.review} ${i.series}`.toLocaleLowerCase().includes(w)));
  }
  function sort(items,by='recent') {
    return [...items].sort((a,b)=>{
      if(by==='score')return (b.score??-1)-(a.score??-1)||a.title.localeCompare(b.title,'zh-CN');
      if(by==='title')return a.title.localeCompare(b.title,'zh-CN');
      if(by==='priority')return priorities.indexOf(a.priority)-priorities.indexOf(b.priority)||a.title.localeCompare(b.title,'zh-CN');
      return Number(b.favorite)-Number(a.favorite)||(b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt)||a.title.localeCompare(b.title,'zh-CN');
    });
  }
  function bgmSubject(s,collection=null) {
    if(!s||![1,2].includes(Number(s.type)))throw new Error('只支持动画、漫画和小说条目');
    const tagList=tags([...(s.meta_tags||[]),...(s.tags||[])]);
    let media=Number(s.type)===2?'anime': /小说|轻小说|Novel/i.test([s.platform,...tagList].join(' '))?'novel':'manga';
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
  return {VERSION,weekdays,priorities,statuses,mediaNames,now,uid,str,number,score,tags,safeURL,subjectId,normalize,parsePayload,duplicate,merge,grade,filter,sort,bgmSubject,bytes64,un64,encrypt,decrypt};
});
