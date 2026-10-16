'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const scope='https://hhd886.github.io/anime-watchlist/',prefix='hhd-workshelf-/anime-watchlist/-';
function worker(fetcher=async()=>new Response('online')){
 const buckets=new Map(),listeners={},key=q=>typeof q==='string'?q:q.url,counts={keys:0,fetch:0};let quota=false;
 const caches={keys:async()=>[...buckets.keys()],delete:async k=>buckets.delete(k),open:async name=>{if(!buckets.has(name))buckets.set(name,new Map());const entries=buckets.get(name);return {match:async q=>entries.get(key(q))?.clone(),put:async(q,r)=>{if(quota)throw new Error('quota');entries.set(key(q),r.clone());},keys:async()=>{counts.keys++;return [...entries.keys()].map(url=>({url}));},delete:async q=>entries.delete(key(q)),addAll:async urls=>{for(const u of urls)entries.set(u,new Response('shell'));}};}};
 const ctx={URL,Response,Promise,caches,self:{registration:{scope},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,fn)=>listeners[name]=fn},fetch:async q=>{counts.fetch++;return fetcher(q);}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/sw.js','utf8'),ctx);
 async function request(url,extra={}){const tasks=[];let response;listeners.fetch({request:{url,method:'GET',headers:new Headers(),destination:'',mode:'cors',...extra},respondWith:p=>{response=p;},waitUntil:p=>tasks.push(p)});if(!response)return null;const r=await response;await Promise.all(tasks);return r;}
 const fire=async name=>{let p;listeners[name]({waitUntil:v=>{p=v;}});await p;};return {caches,buckets,counts,request,fire,quota:v=>{quota=v;}};
}
const cover=n=>'https://lain.bgm.tv/pic/cover/l/'+n+'.jpg';
test('service worker upgrades retain data and existing covers, isolate caches by site and reuse the logo',async()=>{
 const w=worker(),old=await w.caches.open(prefix+'4.7.0');await old.put(scope+'data.json',new Response('private library'));await old.put(cover(1),new Response('old cover'));await w.caches.open('another-site');await w.fire('install');await w.fire('activate');
 assert.equal(w.buckets.has(prefix+'4.7.0'),false);assert.equal(w.buckets.has('another-site'),true);assert.equal(await (await w.caches.open(prefix+'runtime-v1')).match(scope+'data.json').then(r=>r.text()),'private library');assert.equal(await (await w.request(cover(1),{destination:'image'})).text(),'old cover');assert.equal(await (await w.request(scope+'icon.svg')).text(),'shell');assert.equal(w.counts.fetch,0);
});
test('network and cache-write failure never turn a successfully fetched cover into a broken image',async()=>{
 const w=worker();w.quota(true);const r=await w.request(cover(1),{destination:'image'});assert.equal(r.status,200);assert.equal(await r.text(),'online');
 const offline=worker(async()=>{throw new Error('offline');}),cache=await offline.caches.open(prefix+'runtime-v1');await cache.put(scope+'data.json',new Response('offline data'));await cache.put(cover(2),new Response('offline image'));
 assert.equal(await (await offline.request(scope+'data.json?t=now')).text(),'offline data');assert.equal(await (await offline.request(cover(2),{destination:'image'})).text(),'offline image');
});
test('simultaneous cover requests share one fetch; eviction enumerates caches in batches',async()=>{
 let release;const gate=new Promise(r=>release=r),w=worker(async()=>{await gate;return new Response('cover');});const jobs=[w.request(cover(1),{destination:'image'}),w.request(cover(1),{destination:'image'})];for(let n=0;n<10&&!w.counts.fetch;n++)await new Promise(r=>setImmediate(r));release();const rs=await Promise.all(jobs);assert.equal(w.counts.fetch,1);assert.deepEqual(await Promise.all(rs.map(r=>r.text())),['cover','cover']);
 for(let n=2;n<=41;n++)await w.request(cover(n),{destination:'image'});assert.equal(w.counts.keys,2);
});
test('quota failure during migration leaves the old cache recoverable; API and authenticated requests bypass cache',async()=>{
 const w=worker(),old=await w.caches.open(prefix+'4.7.0');await old.put(scope+'data.json',new Response('saved'));w.quota(true);await w.fire('activate');assert.ok(w.buckets.has(prefix+'4.7.0'));
 assert.equal(await w.request('https://api.bgm.tv/v0/subjects/1'),null);assert.equal(await w.request(scope+'data.json',{headers:new Headers({Authorization:'secret'})}),null);assert.equal(w.counts.fetch,0);
});
