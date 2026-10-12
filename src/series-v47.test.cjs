'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('./core.js'),S=require('./series.js'),f=require('./fixtures/series-v47.json');
const cache=Object.fromEntries(Object.entries(f.relations).map(([k,v])=>[k,{at:Date.now(),rows:S.cleanRelations(v)}]));
const subjects=Object.fromEntries(Object.entries(f.subjects).map(([k,v])=>[k,{at:Date.now(),item:C.bgmSubject(v)}]));
const works=name=>f.cases[name].map(id=>C.bgmSubject(f.subjects[id]));
const all=()=>[...works('monogatari'),...works('madoka')];
const idFor=(items,id)=>items.find(i=>i.bangumiId===id).seriesId;
test('v4.7 真实资料书桥接：小圆四部和物语七部分开，伤物语 II/III 与伪物语归入物语',()=>{
 const result=S.analyse(all(),cache,subjects),groups=C.groupSeries(result.items);
 assert.equal(groups.length,2);assert.equal(result.merged,9);
 const mono=groups.find(g=>g.members.some(i=>i.bangumiId==='1671'));assert.equal(mono.title,'物语系列');assert.deepEqual(new Set(mono.members.map(i=>i.bangumiId)),new Set(f.cases.monogatari));
 assert.equal(groups.find(g=>g.members.some(i=>i.bangumiId==='9717')).members.length,4);
 assert.notEqual(idFor(result.items,'9717'),idFor(result.items,'1671'));
});
test('v4.7 重算已保存的错误自动系列：拆开旧资料书误合并且不会重复使用系列 ID',()=>{
 const before=all().map((i,n)=>({...i,series:'化物语',seriesId:'bgm-series-1671',seriesSource:'auto',seriesLocked:false,seriesAnalysisVersion:2,seriesEvidence:[{from:'9717',to:'292937',level:'high',relation:'单行本'}],score:8.7,current:n,priority:'SSR',review:'私评',image:'https://example.com/custom.png',note:'未发布备注',comments:[{text:'记录',customFlag:1}]}));
 const after=S.analyse(before,cache,subjects).items;assert.equal(C.groupSeries(after).length,2);assert.notEqual(idFor(after,'9717'),idFor(after,'1671'));assert.equal(new Set(after.map(i=>i.id)).size,before.length);
 for(let n=0;n<before.length;n++)for(const k of Object.keys(before[n]))if(!['series','seriesId','seriesAnalysisVersion','seriesConfidence','seriesEvidence','seriesSource','seriesLocked','seriesSearchNames'].includes(k))assert.deepEqual(after[n][k],before[n][k],k);
 assert.ok(after.every(i=>i.seriesEvidence.every(e=>e.version===3)));assert.deepEqual(S.analyse(after,cache,subjects).items,after);
});
test('v4.7 仅有相同词语、同作者、普通资料书关联均不能把不同故事合并',()=>{
 const a=C.normalize({id:'a',bangumiId:'1',title:'魔法物语',seriesMetadata:{creators:['相同作者']}}),b=C.normalize({id:'b',bangumiId:'2',title:'银河物语',seriesMetadata:{creators:['相同作者']}}),book=C.normalize({id:'guide',bangumiId:'3',title:'作者访谈 CHRONICLE',media:'manga',seriesMetadata:{creators:['相同作者'],narrativeBook:false}});
 const c={'1':{rows:[{id:'3',type:1,relation:'单行本',name:book.title},{id:'2',type:2,relation:'相同世界观'}]},'2':{rows:[{id:'3',type:1,relation:'单行本',name:book.title}]}};
 assert.equal(C.groupSeries(S.analyse([a,b,book],c).items).length,3);
 assert.notEqual(S.titleProof(a,b)?.level,'high');
 const otherGame=C.normalize({id:'g',bangumiId:'4',media:'other',title:'联动大乱斗',seriesMetadata:{creators:['相同作者']}}),novel={...book,title:'银河原作',seriesMetadata:{creators:['相同作者'],narrativeBook:true}};
 assert.equal(S.relationProof(novel,otherGame,{relation:'游戏'}).level,'medium');
});
test('v4.7 官方原作作者规范化及跨媒介：原作小说属于物语，资料书不属于动画季度',()=>{
 const items=[...all(),C.bgmSubject(f.subjects['1988']),C.bgmSubject(f.subjects['292937'])],result=S.analyse(items,cache,subjects);
 assert.equal(idFor(result.items,'1988'),idFor(result.items,'1671'));assert.notEqual(idFor(result.items,'292937'),idFor(result.items,'1671'));assert.equal(result.items.find(i=>i.bangumiId==='1988').media,'novel');
 assert.equal(S.sharedCreator(subjects['1671'].item,subjects['1988'].item),true);assert.equal(S.referenceBook(subjects['292937'].item),true);
});
test('v4.7 中日文、英文本名及括号罗马数字：搜索只返回对应作品',()=>{
 const items=S.analyse(all(),cache,subjects).items;
 for(const q of ['伪物语','偽物語','Nisemonogatari','ニセモノガタリ'])assert.deepEqual(C.filter(items,{query:q}).map(i=>i.bangumiId),['23161']);
 for(const q of ['伤物语 II','傷物語 II','傷物語 Ⅱ'])assert.deepEqual(C.filter(items,{query:q}).map(i=>i.bangumiId),['148036']);
 assert.equal(C.seriesBase('伤物语〈II 热血篇〉'),'伤物语');
});
test('v4.7 手动归属与独立决定保持不变；当前版本断网仍保留正式系列名称',()=>{
 const manual=all().map(i=>({...i,series:'我自己整理的精选',seriesId:'manual-collection',seriesLocked:true,seriesSource:'manual'}));assert.deepEqual(S.analyse(manual,cache,subjects).items,manual);
 const result=S.analyse(all(),cache,subjects);const offline=S.analyse(result.items);assert.equal(offline.items.find(i=>i.bangumiId==='1671').series,'物语系列');assert.equal(C.groupSeries(offline.items).length,2);
});
test('v4.7 插件索引不再把小圆续作识别为物语，也不传送个人备注',()=>{
 const result=S.analyse([subjects['1671'].item],cache,subjects);result.items[0].note='PRIVATE-SECRET';const idx=S.minimalIndex(result.items,{version:1},cache,subjects);
 assert.equal(S.classify('148036',idx,cache).state,'related');assert.equal(S.classify('9717',idx,cache).state,'absent');assert.equal(JSON.stringify(idx).includes('PRIVATE-SECRET'),false);
});
