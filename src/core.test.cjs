'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('./core.js');
test('细评分覆盖 0.0–10.0 每个十分位且无重叠，9.5/9.6 与 5.0 边界正确',()=>{
 for(let n=0;n<=100;n++){const score=n/10;assert.equal(C.gradeBands.filter(b=>score>=b.min&&score<=b.max).length,1,'score '+score);}
 assert.equal(C.grade({score:9.6}),'9.6');assert.equal(C.grade({score:9.5}),'9.0');assert.equal(C.grade({score:9}),'9.0');assert.equal(C.grade({score:8.9}),'8.5');assert.equal(C.grade({score:5}),'5.0');assert.equal(C.grade({score:4.9}),'low');assert.equal(C.grade({score:null}),'unrated');
});
test('多标签交集与并集均支持个人标签，仅作品库记录不会进入待看或被补全导入重新加入',()=>{
 const a=C.normalize({id:'a',title:'A',tags:['日常'],personalTags:['想重看'],inWatchlist:false,score:9.6});
 const b=C.normalize({id:'b',title:'B',tags:['日常'],status:'doing'});
 assert.deepEqual(C.filter([a,b],{tags:['日常','想重看'],tagMode:'all'}).map(i=>i.id),['a']);
 assert.deepEqual(C.filter([a,b],{tags:['想重看','日常'],tagMode:'any'}).map(i=>i.id),['a','b']);
 assert.equal(C.filter([a,b],{tags:['日常','想重看'],grade:'9.0'}).length,0);
 assert.equal(C.isWatching(a),false);assert.equal(C.isWatching(b),true);
 assert.equal(C.isWatching(C.normalize({status:'done',inWatchlist:true})),false);
 assert.equal(C.isWatching(C.normalize({status:'dropped'})),false);
 assert.equal(C.merge([a],[{id:'a',title:'A',inWatchlist:true}]).items[0].inWatchlist,false);
});
const original={version:3,items:[
 {id:'daily',title:'每日作品',type:'daily',subtype:'周四',weekday:'周四',priority:'SSR',current:3,total:12,note:'保留备注',tags:['日常'],bangumiId:'101'},
 {id:'binge',title:'完结作品',type:'binge',subtype:'SSR',weekday:'',priority:'SSR',current:0,total:12,note:'',tags:[],bangumiId:'102'},
 {id:'manga',title:'漫画作品',type:'manga',subtype:'SR',weekday:'',priority:'SR',current:0,total:'',note:'',tags:['校园'],bangumiId:'103'},
 {id:'novel',title:'小说作品',type:'novel',subtype:'R',weekday:'',priority:'R',current:2,total:10,note:'读到第二卷',tags:[],bangumiId:''}
]};
test('旧格式四类记录完整迁移，保留 ID、优先级、进度、标签与备注',()=>{
 const p=C.parsePayload(original);assert.equal(p.items.length,4);
 original.items.forEach((old,n)=>{const i=p.items[n];for(const k of ['id','title','type','current','total','priority','weekday','note','bangumiId'])assert.equal(i[k],old[k]);assert.deepEqual(i.tags,old.tags);assert.equal(i.score,null);});
 assert.equal(p.items[2].media,'manga');assert.equal(p.items[3].unit,'卷');
});
test('评分边界、小数、未评分与无效输入',()=>{
 for(const [input,want] of [[9.9,9.9],[9.85,9.9],[10,10],[0,0],['',null],[null,null],[-1,null],[11,null],['abc',null]])assert.equal(C.score(input),want);
 const a=[9,8.9,8,7.9,7,6.9,null,0,10].map(score=>C.normalize({score}));
 assert.deepEqual(a.map(C.grade),['9.0','8.5','8.0','7.5','7.0','6.5','unrated','low','9.6']);
 assert.deepEqual(C.sort(a,'score').map(x=>x.score),[10,9,8.9,8,7.9,7,6.9,0,null]);
});
test('重复导入保留个人评分、评语、进度、封面与分类',()=>{
 const a=C.normalize({id:'mine',bangumiId:'123',title:'我的标题',score:9.8,current:8,total:12,priority:'SSR',type:'daily',weekday:'周四',review:'我的评语',comments:[{id:'c',text:'感想',at:'2026-10-01'}],image:'https://example.com/my.jpg',tags:['奇幻'],personalTags:['后劲大']});
 const b=C.normalize({id:'incoming',bangumiId:'123',title:'别名',score:6,current:1,type:'binge',summary:'作品简介',image:'https://example.com/new.jpg',review:'导入短评'});
 const r=C.merge([a],[b]);assert.equal(r.items.length,1);assert.equal(r.updated,1);
 for(const k of ['id','title','score','current','priority','type','weekday','review','image'])assert.equal(r.items[0][k],a[k]);assert.deepEqual(r.items[0].comments,a.comments);assert.equal(r.items[0].summary,'作品简介');
 assert.equal(C.merge([a],[b],'skip').skipped,1);assert.equal(C.merge([a],[b],'replace').items[0].score,6);assert.equal(C.merge([a],[b],'replace').items[0].id,'mine');
});
test('没有 Bangumi ID 时同媒介同名去重，动画与漫画保持独立',()=>{
 const a=C.normalize({title:'作品 A',media:'anime'}),b=C.normalize({title:'作品 A',media:'manga'});
 assert.equal(C.merge([a],[b]).added,1);assert.equal(C.merge([a],[{title:'作品 A',media:'anime'}]).added,0);
 const p=C.parsePayload([{id:'same'},{id:'same'}]);assert.notEqual(p.items[0].id,p.items[1].id);
});
test('组合筛选按媒体、标签、分区、状态与关键词工作',()=>{
 const i=C.normalize({title:'蓝色的故事',media:'manga',status:'done',score:9.8,tags:['日常'],personalTags:['后劲大'],review:'非常喜欢人物成长'});
 assert.equal(C.filter([i],{media:'manga',tag:'后劲大',grade:'9.6',status:'done',query:'成长 蓝色'}).length,1);
 assert.equal(C.filter([i],{media:'novel'}).length,0);assert.equal(C.filter([i],{favorite:true}).length,0);
});
test('书籍与动画从 Bangumi 获取正确类型、进度、评分与感想',()=>{
 const book=C.bgmSubject({id:1,type:1,name:'原名',name_cn:'小说',platform:'小说',volumes:8,tags:[{name:'奇幻'}],rating:{score:7.5}}, {type:3,rate:9,vol_status:2,ep_status:50,comment:'短评',tags:['好看']});
 assert.equal(book.media,'novel');assert.equal(book.current,2);assert.equal(book.total,8);assert.equal(book.score,9);assert.equal(book.review,'短评');assert.deepEqual(book.personalTags,['好看']);
 const anime=C.bgmSubject({id:2,type:2,name:'动画',eps:12,infobox:[{key:'放送星期',value:'星期四'}]}, {type:3,rate:0,ep_status:3});assert.equal(anime.type,'daily');assert.equal(anime.weekday,'周四');assert.equal(anime.score,null);assert.equal(anime.current,3);
 assert.equal(C.bgmSubject({id:2,type:4,name:'游戏'}).media,'other');assert.throws(()=>C.bgmSubject({id:2,type:9}),/无法识别/);
});
test('恶意链接与不支持图片被过滤；中文与 HTML 文本作为数据保留',()=>{
 assert.equal(C.safeURL('javascript:alert(1)'), '');assert.equal(C.safeURL('data:text/html,<h1>x</h1>',true),'');
 assert.equal(C.safeURL('https://example.com/a.jpg',true),'https://example.com/a.jpg');
 assert.equal(C.subjectId('https://evil.test/subject/123'),'');assert.equal(C.subjectId('https://bgm.tv/subject/123'),'123');
 const p=C.parsePayload({items:[{title:'</script><img onerror="alert(1)">中文'}]});assert.ok(p.items[0].title.includes('中文'));
 assert.throws(()=>C.parsePayload({}),/作品数组/);
});
test('AES-GCM 加密可恢复全部中文、封面、评分、感想；错误口令与篡改失败',async()=>{
 const p=C.parsePayload(original);p.items[0].score=9.9;p.items[0].review='重看时仍然喜欢。';
 const encrypted=await C.encrypt(p,'qa-password-2026');assert.equal(encrypted.encrypted,true);assert.ok(!JSON.stringify(encrypted).includes(p.items[0].title));
 const result=await C.decrypt(encrypted,'qa-password-2026');assert.deepEqual(result,p);
 await assert.rejects(C.decrypt(encrypted,'wrong-password'),/口令不正确/);
 const modified={...encrypted,ciphertext:(encrypted.ciphertext[0]==='A'?'B':'A')+encrypted.ciphertext.slice(1)};await assert.rejects(C.decrypt(modified,'qa-password-2026'),/损坏/);
 await assert.rejects(C.encrypt(p,'short'),/至少/);
});

test('批量 ID 解析支持三域名、逗号换行、重复及无效输入，限额不截断',()=>{
 const p=C.parseSubjectList('https://bgm.tv/subject/10\n10，https://bangumi.tv/subject/11;https://chii.in/subject/12 13 bad');assert.deepEqual(p.ids,['10','11','12','13']);assert.equal(p.duplicates,1);assert.deepEqual(p.invalid,['bad']);assert.throws(()=>C.parseSubjectList(Array.from({length:2001},(_,i)=>String(i+1)).join('\n')),/2000/);
});
test('批量收藏位置/完成状态/类型与标签应用，保留来源星期和个人记录',()=>{
 const original=C.normalize({id:'a',title:'测试',type:'daily',weekday:'周五',status:'doing',current:3,total:12,score:9.9,review:'评语',personalTags:['原标签']});
 const unchanged=C.applyImportOptions(original,{placement:'keep',status:'keep',type:'keep',weekday:'keep'});assert.equal(unchanged.weekday,'周五');assert.equal(unchanged.current,3);
 const done=C.applyImportOptions(original,{placement:'watch',status:'done',personalTags:'新标签'});assert.equal(done.inWatchlist,false);assert.equal(done.current,12);assert.equal(done.score,9.9);assert.equal(done.review,'评语');assert.deepEqual(done.personalTags,['原标签','新标签']);
 const library=C.applyImportOptions(original,{media:'novel',placement:'library'});assert.equal(library.media,'novel');assert.equal(library.type,'novel');assert.equal(library.unit,'卷');assert.equal(library.inWatchlist,false);
});

test('年份优先使用手填年份、条目日期和旧导入日期，拒绝把观看感想当年份',()=>{
 assert.equal(C.yearOf({year:'2024',date:'2023-04-27',tags:['2022']}),'2024');
 assert.equal(C.yearOf({date:'2023-04-27',tags:['2022']}),'2023');
 assert.equal(C.yearOf({note:'Bangumi · 2018-03-22',tags:['2017']}),'2018');
 assert.equal(C.yearOf({tags:['2026年7月','2026']}),'2026');
 assert.equal(C.yearOf({tags:['2020','2021']}),'');
 assert.equal(C.yearOf({note:'2020 年看过',personalTags:['2020']}),'');
 assert.equal(C.yearOf({year:'0000',date:'未定'}),'');
 const raw={year:'',date:'',note:'Bangumi · 2020-04-01',tags:['2019']};const copy=JSON.stringify(raw);C.yearOf(raw);assert.equal(JSON.stringify(raw),copy);
});
test('年份标签只显示一次，年月日标签与题材标签分离',()=>{
 const i=C.normalize({year:'2026',tags:['2026年7月','2026','2026-07-04','校园'],personalTags:['想重看','校园','2026年']});
 assert.deepEqual(C.topicTags(i),['想重看','校园']);assert.equal(C.yearOf(i),'2026');
 assert.equal(C.yearTag('2026年7月番'),'2026');assert.equal(C.yearTag('2026年春'),'2026');assert.equal(C.yearTag('2000年代'),'');assert.equal(C.yearTag('第2026话'),'');
});
test('多个年份取并集，再与题材和评分筛选组合；年份排序未知置底且不受心头好影响',()=>{
 const items=[{id:'old',year:'2016',favorite:true,score:10,tags:['日常','校园']},{id:'new',date:'2026-07-01',score:9.9,tags:['日常','校园']},{id:'other',year:'2026',score:9.8,tags:['冒险']},{id:'unknown',score:9.7,tags:['日常']}].map(C.normalize);
 assert.deepEqual(C.filter(items,{years:['2016','2026'],tags:['日常','校园'],grade:'9.6'}).map(i=>i.id),['old','new']);
 assert.deepEqual(C.filter(items,{years:['unknown']}).map(i=>i.id),['unknown']);
 assert.deepEqual(C.filter(items,{query:'2026'}).map(i=>i.id),['new','other']);
 const ordered=C.sort(items,'year');assert.equal(C.yearOf(ordered[0]),'2026');assert.equal(C.yearOf(ordered[1]),'2026');assert.equal(ordered.at(-1).id,'unknown');assert.equal(items[0].id,'old');
});

test('系列归类、改名和移出只改变整理资料；个人记录、来源与其他合集完整保留',()=>{
 const input=[{id:'a',title:'第一季',series:'旧合集',score:9.9,review:'长评',current:8,total:12,comments:[{id:'c',text:'随手记',at:'2026'}],seriesCover:true},{id:'b',title:'OVA',series:'旧合集',score:8.8},{id:'c',title:'原作',media:'novel',series:'其他合集',review:'原作评语'}].map(C.normalize),before=JSON.stringify(input);
 const result=C.assignSeries(input,{name:'  新合集  ',source:'旧合集',ids:['a','c'],coverId:'c',parts:{a:{kind:'season',label:'第一季',order:'2'},c:{kind:'original',label:'原作小说',order:'1'}}});
 assert.equal(JSON.stringify(input),before);assert.equal(result.length,3);assert.equal(result[1].series,'');assert.equal(result[0].series,'新合集');assert.equal(result[0].seriesCover,false);assert.equal(result[2].seriesCover,true);assert.equal(result[2].seriesKind,'original');
 for(let n=0;n<input.length;n++)for(const k of ['id','title','score','review','current','total','media','comments','scoreHistory','bangumiId','inWatchlist'])assert.deepEqual(result[n][k],input[n][k],k);
 assert.throws(()=>C.assignSeries(input,{name:'空',ids:[]}),/至少/);assert.throws(()=>C.assignSeries(input,{name:'合',ids:['missing']}),/变动/);
 assert.equal(C.merge(result,[{id:'a',series:'误覆盖',seriesLabel:'错误版本'}]).items[0].series,'新合集');
 const auto=C.assignSeries(result,{name:'新合集',source:'新合集',ids:['a','c'],coverId:'',parts:{a:{kind:''}}});assert.ok(auto.every(i=>!i.seriesCover));assert.equal(auto[0].seriesKind,'');
});
test('系列收起跨媒体只占一格，筛选命中一季仍能展开全部成员，未评分不当作零分',()=>{
 const items=[{id:'a',title:'第一季',series:'合集',year:'2014',score:9.8,media:'anime',tags:['奇幻'],seriesOrder:2},{id:'b',title:'小说',series:'合集',year:'2012',score:null,media:'novel',seriesKind:'original',seriesOrder:1},{id:'c',title:'OVA',series:'合集',year:'2015',score:9.1,tags:['日常']},{id:'single',title:'独立'}].map(C.normalize);
 const groups=C.groupSeries(items);assert.equal(groups.length,2);assert.equal(groups[0].members.length,3);assert.equal(groups[0].year,'2015');assert.equal(groups[0].score,9.8);
 const filtered=C.groupSeries(C.filter(items,{years:['2014'],media:'anime',tags:['奇幻']}),items);assert.equal(filtered.length,1);assert.equal(filtered[0].matches.length,1);assert.equal(filtered[0].members.length,3);assert.equal(filtered[0].year,'2014');assert.deepEqual(C.seriesOrder(items.slice(0,3)).map(i=>i.id),['b','a','c']);
 assert.equal(C.groupSeries([items[1]])[0].score,null);
});
test('系列类型覆盖季度、OVA、OAD、剧场版、特别篇、上下部、篇章与 MV，手填优先',()=>{
 for(const [title,want] of [['作品 第三季','season'],['作品 OVA','ova'],['作品OAD','oad'],['剧场版 作品','movie'],['作品 特别篇','special'],['作品 上篇','part'],['作品 最终篇','arc'],['作品 MV','mv']])assert.equal(C.seriesKind({title}),want,title);
 assert.equal(C.seriesKind({title:'作品 OVA',seriesKind:'other'}),'other');assert.equal(C.seriesLabel({title:'作品 第三季',seriesLabel:'第 25–48 话'}),'第 25–48 话');
 assert.equal(C.seriesKind({title:'「ray 超かぐや姫！Version」MV',tags:['OVA','2026']}),'mv');assert.equal(C.seriesKind({title:'作品 OVA',tags:['OAD']}),'ova');
});
test('名称建议只返回待确认清单，不修改作品，不用未匹配数字创建错误合集',()=>{
 const items=[{id:'a',title:'好故事'},{id:'b',title:'好故事 第二季'},{id:'c',title:'好故事 OVA'},{id:'d',title:'好故事',media:'novel'},{id:'f',title:'另一个故事',series:'已整理'},{id:'g',title:'86'},{id:'h',title:'87'}].map(C.normalize),before=JSON.stringify(items);
 const suggestions=C.seriesSuggestions(items);assert.equal(JSON.stringify(items),before);assert.equal(suggestions.length,1);assert.deepEqual(suggestions[0].ids,['a','b','c','d']);assert.equal(suggestions[0].name,'好故事');
});
test('系列资料随导入选项和加密备份保存，旧数据缺少系列字段仍能读取',async()=>{
 const i=C.applyImportOptions({id:'a',title:'OVA',seriesKind:'ova',seriesLabel:'特别收录',seriesOrder:3,seriesCover:true},{series:'同一系列',placement:'library'}),p=C.parsePayload({items:[i]});
 const restored=await C.decrypt(await C.encrypt(p,'series-password-2026'),'series-password-2026');assert.deepEqual(restored,p);assert.equal(i.series,'同一系列');assert.equal(C.parsePayload([{title:'旧记录'}]).items[0].series,'');
});
test('关联导入的小说改编漫画仍属于漫画，不把小说改标签当作小说媒介',()=>{
 assert.equal(C.bgmSubject({id:200,type:1,name:'小说改编的漫画',platform:'漫画',tags:[{name:'小说改'}]}).media,'manga');
 assert.equal(C.bgmSubject({id:201,type:1,name:'小说原作',tags:[{name:'轻小说'}]}).media,'novel');
});
