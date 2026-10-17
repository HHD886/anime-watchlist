'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('./core.js'),S=require('./series.js'),{setup,field,response}=require('./test-support.cjs');
const work=(id,title,extra={})=>C.normalize({id:'bgm-'+id,bangumiId:String(id),title,image:'https://lain.bgm.tv/pic/cover/l/'+id+'.jpg',...extra});
const relation=(id,name,kind='续集')=>({id:String(id),name,type:2,relation:kind});
const tick=()=>new Promise(r=>setImmediate(r));

test('浏览与编辑模式可选择两种评分排序，个人榜单保留个人名次和分区',async()=>{
 const items=[work(1,'个人高分',{score:9.9,bgmScore:7}),work(2,'Bangumi 高分',{score:8,bgmScore:9.1}),work(3,'缺少参考分',{score:9,bgmScore:null}),work(4,'未打个人分',{score:null,bgmScore:8.5})];
 for(const role of ['viewer','editor']){
  const {q,document,window}=await setup({boot:{role,seed:{items}},fetch:async()=>response({items})});
  const before=JSON.stringify(q.state.payload),logo=document.querySelector('.brand-mark img'),poster=document.querySelector('[data-work="bgm-1"] img');
  const select=document.getElementById('filter-sort');
  assert.equal(select.querySelector('[value="score"]').textContent,'个人评分从高到低');assert.equal(select.querySelector('[value="bgmScore"]').textContent,'Bangumi 评分从高到低');
  for(const o of select.options)o.removeAttribute('selected');select.querySelector('[value="bgmScore"]').setAttribute('selected','');select.dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal(q.state.sort,'bgmScore');assert.deepEqual([...document.querySelectorAll('.work-card')].map(n=>n.dataset.work),['bgm-2','bgm-4','bgm-1','bgm-3']);
  assert.equal(document.querySelector('.brand-mark img'),logo);assert.equal(document.querySelector('[data-work="bgm-1"] img'),poster);
  q.state.view='ranking';q.render();assert.equal(document.getElementById('filter-sort').value,'bgmScore');
  assert.deepEqual([...document.querySelectorAll('.rank-row')].map(n=>n.dataset.work),['bgm-2','bgm-1','bgm-3']);
  assert.equal(document.querySelector('[data-work="bgm-2"] .rank-n').textContent,'03');assert.match(document.querySelector('[data-work="bgm-2"] .rank-score').textContent,/8.0我的评分Bangumi 9.1/);
  q.state.rankGroup=true;q.render();assert.match(document.querySelector('.result-line').textContent,/区内按 Bangumi/);
  q.state.rankGroup=false;q.state.sort='score';q.render();assert.deepEqual([...document.querySelectorAll('.rank-row')].map(n=>n.dataset.work),['bgm-1','bgm-3','bgm-2']);
  assert.equal(JSON.stringify(q.state.payload),before);
 }
});

test('background saves retain the exact logo, cover, card and search DOM nodes',async()=>{
 const items=[work(1,'宇宙冒险 第一季'),work(2,'另一部故事')],{q,document}=await setup({boot:{role:'editor',seed:{items}}});
 const logo=document.querySelector('.brand-mark img'),cover=document.querySelector('[data-work="bgm-1"] img'),card=cover.closest('article'),search=document.getElementById('search');
 let removed=0;const observer=new document.defaultView.MutationObserver(records=>{for(const r of records)for(const n of r.removedNodes)if(n===logo||n===card||n===cover||n.contains?.(cover))removed++;});observer.observe(document.getElementById('app'),{childList:true,subtree:true});
 for(let n=0;n<25;n++)await q.mutate(()=>{q.state.payload.seriesScan={version:3,complete:false,at:String(n)};},'',false,true);
 assert.equal(document.querySelector('.brand-mark img'),logo);assert.equal(document.querySelector('[data-work="bgm-1"] img'),cover);assert.equal(document.getElementById('search'),search);await tick();assert.equal(removed,0);observer.disconnect();
 await q.mutate(()=>{q.state.payload.items[0].current=4;q.state.payload.items[0].score=9.9;},'',false,true);
 assert.equal(document.querySelector('[data-work="bgm-1"] img'),cover);assert.match(card.textContent,/9.9/);assert.match(card.textContent,/4.*集/);assert.equal(cover.loading||cover.getAttribute('loading'),'lazy');
});
test('sorting and filtering reuse matching work nodes; viewer refresh keeps the shell and covers',async()=>{
 const items=[work(1,'甲作品',{score:8}),work(2,'乙作品',{score:9})];const {q,document}=await setup({boot:{role:'viewer'},fetch:async()=>response({items})});
 const logo=document.querySelector('.brand-mark img'),first=document.querySelector('[data-work="bgm-1"] img');q.state.sort='score';q.render();assert.equal(document.querySelector('[data-work="bgm-1"] img'),first);
 const input=document.getElementById('search');input.value='甲';q.updateSearchInput(input);assert.equal(document.querySelector('[data-work="bgm-1"] img'),first);assert.equal(document.querySelectorAll('.work-card').length,1);
 await q.loadViewer();assert.equal(document.querySelector('.brand-mark img'),logo);assert.equal(document.querySelector('[data-work="bgm-1"] img'),first);assert.equal(document.querySelectorAll('[data-action="publish"]').length,0);
});
test('quiet updates retain unsaved settings, Chinese composition, focus and scroll containers',async()=>{
 const {q,document,window}=await setup({boot:{role:'editor',seed:{items:[work(1,'伪物语')]}}});const input=document.getElementById('search');Object.defineProperty(document,'activeElement',{configurable:true,get:()=>input});input.dispatchEvent(new window.Event('compositionstart',{bubbles:true}));input.value='伪物';
 await q.mutate(()=>{q.state.payload.items[0].series='物语系列';},'',false,true);assert.equal(document.getElementById('search'),input);assert.equal(input.value,'伪物');input.dispatchEvent(new window.Event('compositionend',{bubbles:true}));assert.equal(q.state.filter.query,'伪物');
 q.state.view='settings';q.render();const form=document.getElementById('github-form'),owner=field(document,'owner','unsaved-owner');field(document,'token','unsubmitted-secret');form.scrollTop=73;
 await q.mutate(()=>{q.state.payload.seriesScan={complete:false};},'',false,true);assert.equal(document.getElementById('github-form'),form);assert.equal(owner.value,'unsaved-owner');assert.equal(form.elements.token.value,'unsubmitted-secret');assert.equal(form.scrollTop,73);
});
test('a failed cover is not recreated or retried on every background render',async()=>{
 const {q,document,window}=await setup({boot:{role:'editor',seed:{items:[work(1,'封面失败')]}}});const img=document.querySelector('.work-card img');img.dispatchEvent(new window.Event('error',{bubbles:true}));const fallback=document.querySelector('.poster-fallback');assert.ok(fallback);
 await q.mutate(()=>{q.state.payload.items[0].current=2;},'',false,true);assert.equal(document.querySelector('.poster-fallback'),fallback);assert.equal(document.querySelector('.work-card img'),null);
});

async function automation(payload,options={}){
 const memory=options.memory||new Map(),writes=[],messages=[],calls=[],analysis=[],timers=new Set();
 const state={payload:C.parsePayload(payload),localRevision:1},series={...S,analyseChanged(...args){const r=S.analyseChanged(...args);analysis.push(r.analysed);return r;},createClient(opts){return S.createClient({...opts,interval:0,delay:async()=>{}});}};
 const ctx={Shelf:C,ShelfSeries:series,location:{href:'https://hhd886.github.io/anime-watchlist/editor.html'},setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();timers.add(t);return t;},clearTimeout:t=>{clearTimeout(t);timers.delete(t);},fetch:async url=>{calls.push(url);return options.fetch?options.fetch(url):response([]);}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/automation.js','utf8'),ctx);
 let a;const h={state,get:async k=>structuredClone(memory.get(k)),put:async(k,v)=>{writes.push(k);memory.set(k,structuredClone(v));},post:(type,v)=>messages.push({type,...structuredClone(v)}),progress:()=>{},toast:()=>{},commit:async fn=>{const before=structuredClone(state.payload);try{if(fn()===false)return;await h.put('editor',state.payload);state.localRevision++;a?.saved();}catch(e){state.payload=before;throw e;}}};
 a=ctx.ShelfAutomation.create(h);await a.start();return {a,state,memory,writes,messages,calls,analysis,timers,h};
}
test('completed analysis reload makes zero analysis/API/editor/job writes; personal edits do not schedule scans',async()=>{
 const env=await automation({items:[work(1,'独立作品')]});await env.a.scan();env.a.stop();const again=await automation(env.state.payload,{memory:env.memory});
 try{assert.equal(again.a.stats().complete,true);assert.deepEqual(again.analysis,[]);assert.equal(again.calls.length,0);assert.equal(again.writes.length,0);assert.equal(again.timers.size,0);
  again.state.payload.items[0].score=9.9;again.state.payload.items[0].current=10;again.state.payload.items[0].review='个人评语';again.a.saved();await again.a.scan();assert.equal(again.a.stats().complete,true);assert.equal(again.writes.length,0);assert.equal(again.analysis.length,0);assert.equal(again.timers.size,0);
 }finally{again.a.stop();}
});
test('new season analyses its candidate component, not hundreds of unrelated works; only new ID fetches',async()=>{
 const items=[work(1,'宇宙冒险 第一季'),...Array.from({length:300},(_,n)=>work(n+100,'Independent narrative '+(n+100)))];const env=await automation({items});await env.a.scan();env.calls.length=0;env.analysis.length=0;
 try{env.state.payload.items.push(work(2,'宇宙冒险 第二季'));env.a.saved();await env.a.scan();assert.ok(env.analysis.some(n=>n===2));assert.ok(env.analysis.every(n=>n<=2));assert.equal(env.calls.length,1);assert.match(env.calls[0],/subjects\/2\/subjects$/);assert.equal(env.state.payload.items[0].seriesId,env.state.payload.items.at(-1).seriesId);assert.equal(env.state.payload.items.length,302);
 }finally{env.a.stop();}
});
test('checkpointed pending relationships are analysed after restart; failed requests retry without repeating successes',async()=>{
 let broken=true;const fetch=async url=>url.includes('/2/')&&broken?response({},404):response(url.includes('/1/')?[relation(2,'后续故事')]:[relation(1,'开篇故事','前传')]);const env=await automation({items:[work(1,'开篇故事'),work(2,'后续故事')]},{fetch});await env.a.scan();assert.equal(env.a.stats().done,1);assert.equal(env.a.stats().failed,1);env.a.stop();
 const job=env.memory.get('series-scan-v3');job.pending=['1'];const again=await automation(env.state.payload,{memory:env.memory,fetch});
 try{broken=false;await again.a.resume();await again.a.scan();assert.equal(again.a.stats().complete,true);assert.equal(again.calls.length,1);assert.match(again.calls[0],/subjects\/2\/subjects$/);assert.equal(again.state.payload.items[0].seriesId,again.state.payload.items[1].seriesId);assert.ok(again.analysis.some(n=>n===2));}finally{again.a.stop();}
});
test('concurrent scan calls share one task; automatic work never changes manual decisions or personal fields',async()=>{
 let release;const gate=new Promise(r=>release=r),items=[work(1,'宇宙冒险 第一季',{series:'我的手动系列',seriesId:'manual-own',seriesLocked:true,seriesSource:'manual',current:7,review:'笔记',priority:'SSR',score:9.8}),work(2,'宇宙冒险 第二季')];const env=await automation({items},{fetch:async()=>{await gate;return response([]);}});
 try{const a=env.a.scan();await tick();const b=env.a.scan();release();await Promise.all([a,b]);assert.equal(env.calls.length,2);for(const k of ['series','seriesId','seriesLocked','current','review','priority','score','image'])assert.equal(env.state.payload.items[0][k],items[0][k]);}finally{env.a.stop();}
});
test('no connected extension means no graph index; connected personal saves reuse the graph',async()=>{
 const env=await automation({items:[work(1,'故事')]});await env.a.scan();assert.equal(env.messages.length,0);
 env.a.receive({type:'EXTENSION_READY'});assert.equal(env.messages[0].type,'LIBRARY_INDEX');env.state.payload.items[0].review='private-only';env.a.saved();assert.equal(JSON.stringify(env.messages).includes('private-only'),false);env.state.payload.items=[];env.a.saved();assert.equal(env.messages.at(-1).index.items.length,0);env.a.stop();
});
test('incremental analysis agrees with full analysis for real Monogatari, Madoka, Kaguya and Gintama fixtures',()=>{
 for(const file of ['series-v46.json','series-v47.json']){const f=require('./fixtures/'+file),subjects=Object.fromEntries(Object.entries(f.subjects).map(([id,s])=>[id,{item:C.bgmSubject(s)}])),cache=Object.fromEntries(Object.entries(f.relations).map(([id,rows])=>[id,{rows:S.cleanRelations(rows)}]));
  for(const ids of Object.values(f.cases).filter(Array.isArray)){if(ids.some(id=>!f.subjects[id]))continue;let prior=S.analyse([],cache,subjects),inputs={};
   for(const id of ids){const list=[...prior.items,C.bgmSubject(f.subjects[id])],next=S.analyseChanged(list,cache,subjects,inputs,[],prior.review),full=S.analyse(list,cache,subjects);assert.deepEqual(next.items,full.items,file+': '+id);inputs=S.analysisInputs(next.items);prior=next;}
  }
 }
});
test('deletion, renaming and manual splitting invalidate former neighbours without changing unrelated personal data',()=>{
 const originals=[work(1,'宇宙冒险 第一季'),work(2,'宇宙冒险 第二季'),work(3,'Independent novel',{score:9.9,review:'private'})];let first=S.analyse(originals),inputs=S.analysisInputs(first.items);
 for(const list of [first.items.filter(i=>i.bangumiId!=='1'),first.items.map(i=>i.bangumiId==='2'?{...i,title:'不同的作品',originalTitle:'',series:'',seriesId:'',seriesLocked:true,seriesSource:'manual'}:i)]){const incremental=S.analyseChanged(list,{}, {},inputs,[],first.review),full=S.analyse(list);assert.deepEqual(incremental.items,full.items);assert.equal(incremental.items.find(i=>i.bangumiId==='3'),list.find(i=>i.bangumiId==='3'));}
});
