'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('./core.js');
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
 assert.deepEqual(a.map(C.grade),['9','8','8','7','7','low','unrated','low','9']);
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
 assert.equal(C.filter([i],{media:'manga',tag:'后劲大',grade:'9',status:'done',query:'成长 蓝色'}).length,1);
 assert.equal(C.filter([i],{media:'novel'}).length,0);assert.equal(C.filter([i],{favorite:true}).length,0);
});
test('书籍与动画从 Bangumi 获取正确类型、进度、评分与感想',()=>{
 const book=C.bgmSubject({id:1,type:1,name:'原名',name_cn:'小说',platform:'小说',volumes:8,tags:[{name:'奇幻'}],rating:{score:7.5}}, {type:3,rate:9,vol_status:2,ep_status:50,comment:'短评',tags:['好看']});
 assert.equal(book.media,'novel');assert.equal(book.current,2);assert.equal(book.total,8);assert.equal(book.score,9);assert.equal(book.review,'短评');assert.deepEqual(book.personalTags,['好看']);
 const anime=C.bgmSubject({id:2,type:2,name:'动画',eps:12,infobox:[{key:'放送星期',value:'星期四'}]}, {type:3,rate:0,ep_status:3});assert.equal(anime.type,'daily');assert.equal(anime.weekday,'周四');assert.equal(anime.score,null);assert.equal(anime.current,3);
 assert.throws(()=>C.bgmSubject({id:2,type:4}),/只支持/);
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
