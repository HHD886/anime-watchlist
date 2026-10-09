/* Shared, conservative Bangumi relationship engine. Never edits personal fields. */
(function(root,factory){const value=factory(typeof module==='object'&&module.exports?require('./core.js'):root.Shelf);if(typeof module==='object'&&module.exports)module.exports=value;else root.ShelfSeries=value;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  const VERSION=1, TTL=30*86400000;
  const strong=new Set(['前传','续集','续作','总集篇','全集','番外篇','番外','主线故事','改编','原作','系列','单行本','外传','衍生','Prequel','Sequel','Summary','Full Story','Side Story','Parent Story','Adaptation','Series','Offprint','Spin-off']);
  const medium=new Set(['相同世界观','不同世界观','不同演绎','不同版本','Same Setting','Same setting','Alternative Setting','Alternative Version','Version']);
  const id=v=>C.subjectId(v), key=v=>C.seriesKey(v), clone=v=>JSON.parse(JSON.stringify(v));
  function stableId(name){let h=2166136261;for(const ch of key(name)){h^=ch.codePointAt(0);h=Math.imul(h,16777619);}return 'manual-'+(h>>>0).toString(36);}
  function migrate(items){return items.map(i=>({...i,seriesId:i.seriesId||(i.series?stableId(i.series):''),seriesSource:i.seriesSource||(i.series?'manual':''),seriesLocked:typeof i.seriesLocked==='boolean'?i.seriesLocked:!!i.series}));}
  function relationLevel(r){return strong.has(r.relation)?'high':medium.has(r.relation)?'medium':'low';}
  function cleanRelations(rows){if(!Array.isArray(rows))throw new Error('Bangumi 关联返回格式不正确');return rows.filter(r=>id(r.id)&&[1,2,3,4,6].includes(Number(r.type))).slice(0,500).map(r=>({id:id(r.id),type:Number(r.type),name:C.str(r.name,300),name_cn:C.str(r.name_cn,300),relation:C.str(r.relation,80)}));}
  function position(i){const s=[i.title,i.originalTitle].join(' '),num=v=>{if(/^\d+$/.test(v))return Number(v);const c={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};return c[v]||0;};
    const season=s.match(/第\s*([\d一二三四五六七八九十]+)\s*[季期]|\bseason\s*(\d+)|\b(\d+)(?:st|nd|rd|th)\s+season/i),part=s.match(/\bpart[.\s]*(\d+)|第\s*(\d+)\s*部分|([上中下前后後])[篇編部]/i);
    return {season:season?num(season[1]||season[2]||season[3]):0,part:part?Number(part[1]||part[2]||({'上':1,'前':1,'中':2,'下':2,'后':2,'後':2})[part[3]]):0};}
  function arrange(items){return [...items].sort((a,b)=>{const n=i=>i.seriesOrder!==''&&i.seriesOrder!=null?Number(i.seriesOrder):Infinity;const manual=n(a)-n(b);if(manual)return manual;const date=i=>/^\d{4}-\d{2}-\d{2}$/.test(i.date||i.seriesDate||'')?(i.date||i.seriesDate):(C.yearOf(i)||'9999')+'-12-31';const byDate=date(a).localeCompare(date(b));if(byDate)return byDate;const x=position(a),y=position(b);return x.season-y.season||x.part-y.part||a.title.localeCompare(b.title,'zh-CN',{numeric:true});});}
  function autoName(i){return C.seriesBase(i.title)||i.title;}
  function analyse(input,cache={}){
    const items=migrate(input),nodes=new Map(),parent=new Map(),edges=[],evidenceById=new Map(),review=[],byBgm=new Map(),isolated=new Set();
    const add=(k,n={})=>{if(!parent.has(k))parent.set(k,k);if(!nodes.has(k))nodes.set(k,n);};
    const find=k=>{let p=parent.get(k);if(p!==k){p=find(p);parent.set(k,p);}return p;};
    const join=(a,b)=>{add(a);add(b);const x=find(a),y=find(b);if(x!==y)parent.set(y,x);};
    for(const i of items){if(i.bangumiId){byBgm.set(i.bangumiId,i);add(i.bangumiId,i);if(i.seriesLocked&&!i.series)isolated.add(i.bangumiId);}}
    for(const [from,entry] of Object.entries(cache)){if(!id(from)||!Array.isArray(entry?.rows))continue;add(from);for(const r of entry.rows){const to=id(r.id);if(!to)continue;add(to,r);const level=relationLevel(r);const edge={from,to,relation:r.relation,level};edges.push(edge);if(level==='high')for(const k of [from,to]){if(!evidenceById.has(k))evidenceById.set(k,[]);if(evidenceById.get(k).length<12)evidenceById.get(k).push(edge);}if(level==='high'&&!isolated.has(from)&&!isolated.has(to))join(from,to);}}
    // Existing explicit series are trustworthy anchors, including manual cross-media groups.
    const known=new Map();for(const i of items){if(!i.series||!i.bangumiId)continue;const k=i.seriesId||stableId(i.series);if(known.has(k))join(i.bangumiId,known.get(k));else known.set(k,i.bangumiId);}
    const components=new Map();for(const i of items){const k=i.bangumiId?find(i.bangumiId):'local:'+i.id;if(!components.has(k))components.set(k,[]);components.get(k).push(i);}
    const next=new Map(items.map(i=>[i.id,i])),names=new Map(items.filter(i=>i.series).map(i=>[key(i.series),i.seriesId]));let assigned=0,created=0;
    for(const group of components.values()){
      const locks=new Map(group.filter(i=>i.seriesLocked&&i.series).map(i=>[i.seriesId,i]));
      if(locks.size>1||group.length>150){review.push({key:'conflict:'+group.map(i=>i.id).sort().join(','),ids:group.map(i=>i.id),name:autoName(group[0]),reason:locks.size>1?'关联跨越多个手动确认的系列，请决定是否合并':'关联范围过大，需要确认'});continue;}
      const sorted=arrange(group),existing=sorted.find(i=>i.seriesLocked&&i.series)||sorted.find(i=>i.series),anchor=existing||sorted[0];
      const seriesId=existing?.seriesId||(anchor.bangumiId?'bgm-series-'+anchor.bangumiId:'local-series-'+anchor.id);
      let name=existing?.series||autoName(anchor);if(!existing&&names.has(key(name))&&names.get(key(name))!==seriesId)name+='〔'+(anchor.bangumiId||anchor.media)+'〕';names.set(key(name),seriesId);
      if(!existing)created++;
      for(const i of group){if(i.seriesLocked)continue;const entry=cache[i.bangumiId];const evidence=evidenceById.get(i.bangumiId)||[];
        const fresh={...i,seriesId,series:name,seriesSource:'auto',seriesLocked:false,seriesEvidence:evidence,seriesConfidence:evidence.length?'high':entry?'single':'unknown'};
        if(i.series!==name||i.seriesId!==seriesId)assigned++;next.set(i.id,fresh);
      }
    }
    for(const e of edges){if(e.level!=='medium')continue;const a=byBgm.get(e.from),b=byBgm.get(e.to);if(a&&b&&!isolated.has(a.bangumiId)&&!isolated.has(b.bangumiId)&&next.get(a.id).seriesId!==next.get(b.id).seriesId)review.push({key:'relation:'+ [a.id,b.id].sort().join(','),ids:[a.id,b.id],name:autoName(a),reason:'Bangumi：'+e.relation+'；不足以自动认定为同一系列'});}
    // Title and alias matches are suggestions only; never used as union edges.
    const titleGroups=new Map();for(const i of items){if(i.seriesLocked&&!i.series)continue;for(const title of [i.title,i.originalTitle,...(i.aliases||[])]){const k=key(C.seriesBase(title)).replace(/[\s!！?？·・:：～〜~—\-，,。]/g,'');if(k.length<2)continue;if(!titleGroups.has(k))titleGroups.set(k,new Set());titleGroups.get(k).add(i.id);}}
    for(const ids of titleGroups.values()){const list=[...ids];if(list.length<2||new Set(list.map(i=>next.get(i).seriesId||i)).size<2)continue;review.push({key:'title:'+list.sort().join(','),ids:list,name:autoName(next.get(list[0])),reason:'标题或别名接近，尚无足够的可靠关联'});}
    const unique=[...new Map(review.map(r=>[r.ids.slice().sort().join(','),r])).values()];
    return {items:[...next.values()],review:unique,assigned,created,seriesCount:new Set([...next.values()].map(i=>i.seriesId).filter(Boolean)).size};
  }
  function graph(cache,items=[]){
    const parent=new Map(),separate=new Set(items.filter(i=>(i.locked||i.seriesLocked)&&!i.seriesId).map(i=>i.bangumiId));
    const find=k=>{if(!parent.has(k))parent.set(k,k);let root=k;while(parent.get(root)!==root)root=parent.get(root);while(parent.get(k)!==k){const next=parent.get(k);parent.set(k,root);k=next;}return root;};
    const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(b,a);};
    for(const [from,e] of Object.entries(cache))for(const r of e?.rows||[])if(relationLevel(r)==='high'&&!separate.has(from)&&!separate.has(r.id))join(from,r.id);
    const groups=new Map();for(const i of items){if(!i.seriesId)continue;const root=find(i.bangumiId);if(!groups.has(root))groups.set(root,new Map());groups.get(root).set(i.seriesId,{seriesId:i.seriesId,series:i.series});}
    return {find,parent,groups};
  }
  function minimalIndex(items,meta={},cache={}){
    const rows=items.filter(i=>i.bangumiId).map(i=>({id:i.id,bangumiId:i.bangumiId,seriesId:i.seriesId||(i.series?stableId(i.series):''),series:i.series||'',title:i.title,media:i.media,locked:!!i.seriesLocked}));
    const g=graph(cache,rows),related={};for(const sid of g.parent.keys()){const groups=g.groups.get(g.find(sid));if(groups?.size===1)related[sid]=[...groups.values()][0];else if(groups?.size>1)related[sid]={ambiguous:true};}
    return {protocol:1,version:Number(meta.version)||0,at:meta.at||C.now(),scope:C.str(meta.scope,500),items:rows,related};
  }
  function classifier(index,cache={},pending=[]){
    const exact=new Map((index?.items||[]).map(i=>[i.bangumiId,i])),waiting=new Set(pending.map(i=>i.bangumiId)),g=graph(cache,index?.items||[]);
    return value=>{const sid=id(value);if(waiting.has(sid))return {state:'pending'};
      if(!index||!Array.isArray(index.items))return {state:'unknown',reason:'尚未与作品库同步'};
      // Negative conclusions expire quickly; a closed library may have changed elsewhere.
      const stale=Date.now()-Date.parse(index.at)>120000;
      if(exact.has(sid))return {state:'present',item:exact.get(sid),cached:stale,reason:stale?'上次同步已入库；打开作品库后会核对最新状态':''};
      if(stale)return {state:'unknown',reason:'作品库未连接，最后同步状态已过期'};
      if(index.related?.[sid]?.ambiguous)return {state:'unknown',reason:'关联到多个手动系列'};
      if(index.related?.[sid]?.seriesId)return {state:'related',...index.related[sid]};
      const rows=cache[sid]?.rows;if(!Array.isArray(rows))return {state:'unknown',reason:'关联尚未读取或网络不可用'};
      const groups=new Map(g.groups.get(g.find(sid))||[]);
      for(const r of rows){if(relationLevel(r)!=='high')continue;const hint=index.related?.[r.id];if(hint?.ambiguous)return {state:'unknown',reason:'关联存在歧义'};if(hint?.seriesId)groups.set(hint.seriesId,hint);}
      if(groups.size===1)return {state:'related',...[...groups.values()][0]};
      if(groups.size>1)return {state:'unknown',reason:'关联到多个系列，添加后待确认'};
      if(rows.some(r=>relationLevel(r)==='medium'&&(exact.has(r.id)||index.related?.[r.id])))return {state:'unknown',reason:'存在关联歧义，添加后待确认'};
      return {state:'absent'};
    };
  }
  function classify(value,index,cache={},pending=[]){return classifier(index,cache,pending)(value);}
  function createClient({get,set,fetch:doFetch=globalThis.fetch,delay=ms=>new Promise(r=>setTimeout(r,ms)),interval=420,ttl=TTL,timeout=14000}={}){
    let tail=Promise.resolve(),last=0;const inflight=new Map();
    async function request(path){for(let attempt=0;attempt<3;attempt++){const wait=Math.max(0,last+interval-Date.now());if(wait)await delay(wait);last=Date.now();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);let retry=800*(attempt+1);try{const r=await doFetch('https://api.bgm.tv/v0/subjects/'+path,{headers:{Accept:'application/json'},credentials:'omit',signal:controller.signal});if(!r.ok){retry=Math.min(30000,Math.max(retry,(Number(r.headers?.get?.('Retry-After'))||0)*1000));const e=new Error('Bangumi HTTP '+r.status);e.retryable=r.status===429||r.status>=500;throw e;}return await r.json();}catch(e){if(e.retryable===false||attempt===2)throw new Error(e.name==='AbortError'?'Bangumi 读取超时':e.message);await delay(retry);}finally{clearTimeout(timer);}}}
    async function load(sid,kind,force=false){sid=id(sid);if(!sid)throw new Error('Bangumi ID 无效');const k=kind+':'+sid,old=await get(k);if(!force&&old&&Date.now()-old.at<ttl)return old;if(inflight.has(k))return inflight.get(k);const p=tail.catch(()=>{}).then(async()=>{const raw=await request(sid+(kind==='relations'?'/subjects':''));const value={at:Date.now(),...(kind==='relations'?{rows:cleanRelations(raw)}:{item:C.bgmSubject(raw)})};await set(k,value);return value;});tail=p;inflight.set(k,p);try{return await p;}finally{inflight.delete(k);}}
    return {relations:(sid,force)=>load(sid,'relations',force),subject:(sid,force)=>load(sid,'subject',force)};
  }
  return {VERSION,TTL,stableId,migrate,relationLevel,cleanRelations,position,arrange,analyse,minimalIndex,classifier,classify,createClient};
});
