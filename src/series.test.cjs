'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('./core.js'),S=require('./series.js');
const work=(id,title,extra={})=>C.normalize({id:'work-'+id,bangumiId:String(id),title,...extra});
const relation=(id,relation='续集',type=2)=>({id:String(id),relation,type,name:'关联作品'+id});
const entry=rows=>({at:Date.now(),rows});
test('可靠关联把第一季、第二季、OVA 收进同一格，独立进度及个人字段不变',()=>{
 const original=[work(1,'测试第一季',{current:7,priority:'SSR',score:9.8,note:'备注',review:'评语',image:'https://example.com/cover.jpg',personalTags:['珍藏']}),work(2,'测试第二季',{current:3}),work(3,'测试 OVA',{status:'done'})];
 const result=S.analyse(original,{'1':entry([relation(2),relation(3,'番外篇')]),'2':entry([relation(1,'前传')]),'3':entry([relation(1,'主线故事')])});
 assert.equal(new Set(result.items.map(i=>i.seriesId)).size,1);assert.equal(C.groupSeries(result.items).length,1);
 for(const originalItem of original)for(const k of ['id','bangumiId','current','priority','score','note','review','image','personalTags','status'])assert.deepEqual(result.items.find(i=>i.id===originalItem.id)[k],originalItem[k]);
 assert.equal(C.seriesKind(result.items[2]),'ova');
});
test('导入新季沿用已存在系列 ID；新作自动建立单作品系列；重复运行幂等',()=>{
 const first=S.analyse([work(1,'测试 第一季')],{'1':entry([])}).items;
 const result=S.analyse([...first,work(2,'测试 第二季')],{'2':entry([relation(1,'前传')])});assert.equal(result.items[1].seriesId,first[0].seriesId);
 assert.deepEqual(S.analyse(result.items,{'2':entry([relation(1,'前传')])}).items,result.items);
 const novel=S.analyse([work(99,'全新故事')],{'99':entry([])});assert.equal(novel.items[0].seriesId,'bgm-series-99');assert.equal(novel.items[0].series,'全新故事');
});
test('同名、世界观、角色客串不自动合并；需要确认的建议不改变记录数量',()=>{
 const input=[work(1,'故事 第一季'),work(2,'故事 第二季'),work(3,'独立宇宙'),work(4,'客串')];const result=S.analyse(input,{'1':entry([relation(3,'相同世界观'),relation(4,'角色出演')])});
 assert.equal(new Set(result.items.map(i=>i.seriesId)).size,4);assert.ok(result.review.some(r=>r.ids.includes('work-1')&&r.ids.includes('work-2')));assert.ok(result.review.some(r=>r.reason.includes('世界观')));
});
test('动画、原作漫画、小说和音乐跨媒介关联，各自媒介和类型不变',()=>{
 const input=[work(1,'动画',{media:'anime'}),work(2,'原作漫画',{media:'manga'}),work(3,'原作小说',{media:'novel'}),C.bgmSubject({id:4,type:3,name:'音乐'})];
 const result=S.analyse(input,{'1':entry([relation(2,'改编',1)]),'2':entry([relation(3,'改编',1)]),'4':entry([relation(1,'其他',2)])});assert.equal(result.items[0].seriesId,result.items[2].seriesId);assert.equal(result.items[1].media,'manga');assert.equal(result.items[2].media,'novel');assert.equal(result.items[3].media,'other');assert.notEqual(result.items[3].seriesId,result.items[0].seriesId);
});
test('手动确认的系列和拆出的独立作品受保护；冲突系列进入待确认',()=>{
 const input=[work(1,'作品甲',{series:'我的 A'}),work(2,'作品乙',{series:'我的 B'}),work(3,'独立',{seriesLocked:true})];const result=S.analyse(input,{'1':entry([relation(2),relation(3)])});assert.equal(result.items[0].series,'我的 A');assert.equal(result.items[1].series,'我的 B');assert.equal(result.items[2].series,'');assert.equal(result.review.length,1);
 const separate=S.analyse([work(5,'名称 第一季',{seriesLocked:true}),work(6,'名称 第二季',{seriesLocked:true})]);assert.equal(separate.review.length,0);
});
test('显示五种入库状态，删除后完整替换索引，过期索引不能误报未入库',()=>{
 const items=S.analyse([work(1,'第一季')],{'1':entry([relation(2)])}).items,cache={'1':entry([relation(2)]),'2':entry([relation(1,'前传')]),'3':entry([])};
 const index=S.minimalIndex(items,{version:7},cache);assert.equal(S.classify('1',index,cache).state,'present');assert.equal(S.classify('2',index,cache).state,'related');assert.equal(S.classify('3',index,cache).state,'absent');assert.equal(S.classify('3',index,cache,[{bangumiId:'3'}]).state,'pending');assert.equal(S.classify('9',null,cache).state,'unknown');
 const deleted=S.minimalIndex([],{version:8},cache);assert.equal(S.classify('1',deleted,cache).state,'absent');assert.equal(S.classify('2',{...index,at:new Date(Date.now()-130000).toISOString()},cache).state,'unknown');
});
test('插件索引不携带任何备注、评论、评分、封面、个人标签或凭据',()=>{
 const i=work(1,'作品',{series:'系列',note:'SECRET',review:'SECRET',comments:[{text:'SECRET'}],personalTags:['SECRET'],image:'https://example.com/SECRET',token:'SECRET',score:9.9});const index=S.minimalIndex([i]);assert.equal(JSON.stringify(index).includes('SECRET'),false);assert.equal(index.items[0].score,undefined);
});
test('真实发行日期优先，手动顺序优先于日期；英文 Season / Part 可识别',()=>{
 const items=[work(1,'Season 2 Part 2',{date:'2024-06-01'}),work(2,'Season 2 Part 1',{date:'2024-01-01'}),work(3,'OVA',{date:'2025-01-01',seriesOrder:0})];assert.deepEqual(S.arrange(items).map(i=>i.bangumiId),['3','2','1']);assert.deepEqual(S.position(items[0]),{season:2,part:2});assert.equal(C.seriesLabel(items[0]),'Season 2');
});
test('客户端复用缓存，合并并发请求；网络失败重试三次且不写入空缓存',async()=>{
 const cache=new Map();let calls=0;const client=S.createClient({get:async k=>cache.get(k),set:async(k,v)=>cache.set(k,v),interval:0,delay:async()=>{},fetch:async()=>{calls++;return {ok:true,json:async()=>[relation(2)]};}});
 await Promise.all([client.relations('1'),client.relations('1')]);assert.equal(calls,1);await client.relations('1');assert.equal(calls,1);
 const bad=S.createClient({get:async()=>null,set:async()=>assert.fail('must not cache failure'),interval:0,delay:async()=>{},fetch:async()=>{calls++;throw new Error('offline');}});await assert.rejects(bad.relations('3'),/offline/);assert.equal(calls,4);
});
test('重复添加同一 Subject ID 不创建新记录，也不覆盖自定义字段',()=>{
 const original=work(1,'我的命名',{current:8,total:12,review:'自己写的',image:'https://example.com/custom.jpg',score:9.9,priority:'SSR',inWatchlist:false});let items=[original];for(let n=0;n<2;n++)items=S.analyse(C.merge(items,[work(1,'API 标题',{current:0,score:6})]).items).items;assert.equal(items.length,1);for(const k of ['title','current','review','image','score','priority','inWatchlist'])assert.equal(items[0][k],original[k]);
});

test('作品库关闭后仍可查看已收录的缓存标签，明确显示上次同步；未收录结论过期为未知',()=>{const index=S.minimalIndex([work(1)]);index.at=new Date(Date.now()-86400000).toISOString();const status=S.classify('1',index);assert.equal(status.state,'present');assert.equal(status.cached,true);assert.match(status.reason,/上次同步/);assert.equal(S.classify('2',index,{'2':entry([])}).state,'unknown');});
