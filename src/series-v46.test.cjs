'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('./core.js'),S=require('./series.js'),fixture=require('./fixtures/series-v46.json');
const works=name=>fixture.cases[name].map(id=>C.bgmSubject(fixture.subjects[id]));
const cache=Object.fromEntries(Object.entries(fixture.relations).map(([k,v])=>[k,{at:Date.now(),rows:S.cleanRelations(v)}]));
const subjects=Object.fromEntries(Object.entries(fixture.subjects).map(([k,v])=>[k,{at:Date.now(),item:C.bgmSubject(v)}]));
const independent=items=>items.map(i=>({...i,series:i.title,seriesId:'bgm-series-'+i.bangumiId,seriesSource:'auto',seriesLocked:false}));
const personalKeys=['id','bangumiId','title','originalTitle','media','current','total','score','note','review','tags','personalTags','image','priority','comments','seriesKind','seriesLabel','seriesOrder','seriesCover'];
for(const name of ['kaguya','gintama'])test('真实 Bangumi 快照 '+name+'：旧版单作品系列真正合并且资料完整',()=>{
 const before=independent(works(name)).map((i,n)=>({...i,current:n+1,score:9.5,priority:'SSR',note:'自己的备注',review:'自己的评语',image:'https://example.com/custom-'+n+'.jpg',personalTags:['珍藏'],comments:[{id:'note-'+n,text:'自己的评论',at:'2026-10-10',custom:'保留'}]}));
 const result=S.analyse(before,cache,subjects);assert.equal(result.items.length,before.length);assert.equal(C.groupSeries(result.items).length,1);assert.equal(result.merged,before.length-1);assert.equal(result.groupedWorks,before.length);assert.equal(result.review.length,0);
 for(let n=0;n<before.length;n++)for(const k of personalKeys)assert.deepEqual(result.items[n][k],before[n][k],k);
 assert.deepEqual(S.analyse(result.items,cache,subjects).items,result.items);
});
test('接口暂不可用时，七部辉夜凭双语标题与版本信息仍能合为一组',()=>{const before=independent(works('kaguya')).map(i=>({...i,aliases:[]}));const result=S.analyse(before);assert.equal(C.groupSeries(result.items).length,1);assert.equal(result.merged,6);});
test('旧资料没有别名时，补充官方元数据能识别银八外传；只有不同世界观仍不够',()=>{
 const before=independent(works('gintama')).map(i=>({...i,aliases:[],seriesMetadata:undefined}));const result=S.analyse(before,cache,subjects);assert.equal(C.groupSeries(result.items).length,1);
 const unrelated=[C.normalize({id:'a',bangumiId:'9001',title:'独立作品甲',seriesMetadata:{creators:['同一作者']}}),C.normalize({id:'b',bangumiId:'9002',title:'独立作品乙',seriesMetadata:{creators:['同一作者']}})];assert.equal(C.groupSeries(S.analyse(unrelated,{'9001':{rows:[{id:'9002',type:2,relation:'相同世界观'}]}}).items).length,2);
});
for(const [name,rows] of Object.entries(fixture.extra))test('更多真实系列 '+name+'：季度、上下部与剧场版',()=>{const result=S.analyse(independent(rows.map(C.normalize)),cache,subjects);if(name==='名侦探柯南'){assert.equal(C.groupSeries(result.items).length,2);assert.equal(C.groupSeries(result.items).find(g=>g.members?.some(i=>i.bangumiId==='899')).members.length,19);assert.ok(result.review.some(r=>r.ids.includes('bgm-6776')));}else assert.equal(C.groupSeries(result.items).length,1);assert.equal(result.items.length,rows.length);});
test('同名无关作品与名字相近的辉夜作品不合并',()=>{
 const rows=[C.normalize({id:'a',title:'同名故事',originalTitle:'Different Original A',year:'1990'}),C.normalize({id:'b',title:'同名故事',originalTitle:'Different Original B',year:'2024'}),C.normalize({id:'c',title:'辉夜姬物语',originalTitle:'かぐや姫の物語'}),...works('kaguya')];const result=S.analyse(rows);assert.equal(C.groupSeries(result.items).length,4);assert.ok(result.review.some(r=>r.ids.includes('a')&&r.ids.includes('b')));
});
test('人工指定的独立作品与互不相同的手动合集始终受保护',()=>{
 const before=works('kaguya').map((i,n)=>({...i,series:n===0?'自选一':n===1?'自选二':'',seriesId:n===0?'manual-a':n===1?'manual-b':'',seriesSource:'manual',seriesLocked:true}));const after=S.analyse(before,cache,subjects).items;for(let i=0;i<before.length;i++)assert.deepEqual(after[i],before[i]);
});
test('跨媒介书籍关联需要完整名称依据，关联的游戏大乱斗不会混入',()=>{
 const anime=works('kaguya'),book=C.bgmSubject(fixture.subjects['135218']),other=C.normalize({id:'crossover',bangumiId:'270',title:'Jump明星大乱斗',media:'other'});const result=S.analyse([...anime,book,other],{...cache,'135218':{rows:[...cache['135218'].rows,{id:'270',type:4,relation:'游戏',name:'ジャンプスーパースターズ',name_cn:'Jump明星大乱斗'}]}});assert.equal(C.groupSeries(result.items).length,2);assert.equal(result.items.find(i=>i.id===book.id).media,'manga');
});
test('仅有单作品系列时实际合并数必须为零',()=>{const result=S.analyse([C.normalize({id:'a',title:'作品甲'}),C.normalize({id:'b',title:'作品乙'})]);assert.equal(result.assigned,2);assert.equal(result.merged,0);assert.equal(result.groupedWorks,0);});
test('自动系列标志兼容旧导出；顶层偏好、评论扩展字段和评分历史不丢失',()=>{
 const raw={items:[{id:'a',title:'作品',series:'自动系列',seriesId:'bgm-series-1',seriesSource:'auto',comments:[{id:'c',text:'评论',at:'2026',color:'blue'}],scoreHistory:[{score:9,at:'2026',source:'myself'}]}],customPreferences:{coverFit:'contain'}};const p=C.parsePayload(raw);assert.equal(p.items[0].seriesLocked,false);assert.deepEqual(p.customPreferences,raw.customPreferences);assert.equal(p.items[0].comments[0].color,'blue');assert.equal(p.items[0].scoreHistory[0].source,'myself');
});
