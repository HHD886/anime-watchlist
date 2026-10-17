/* Scope-local caches; API requests and credentials are never cached. */
const CACHE_PREFIX='hhd-workshelf-'+new URL(self.registration.scope).pathname+'-';
const CACHE=CACHE_PREFIX+'4.8.1',RUNTIME=CACHE_PREFIX+'runtime-v1';
const BASE=self.registration.scope,SHELL=['index.html','editor.html','manifest.webmanifest','icon.svg'];
const covers=new Map();let coverWrites=0,trim=Promise.resolve(),legacyKeys;
const isCoverURL=u=>new URL(u).hostname==='lain.bgm.tv';
const safePut=async(cache,key,response)=>{try{await cache.put(key,response);return true;}catch{return false;}};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(p=>new URL(p,BASE).href))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
  const runtime=await caches.open(RUNTIME),data=new URL('data.json',BASE).href;
  for(const key of (await caches.keys()).filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE&&k!==RUNTIME)){
    const old=await caches.open(key);let copied=true;
    for(const req of await old.keys())if(req.url===data||isCoverURL(req.url))if(!await runtime.match(req))copied=await safePut(runtime,req,await old.match(req))&&copied;
    // Retain the old cache if migration cannot be saved (e.g. quota exhausted).
    if(copied)await caches.delete(key);
  }
  await self.clients.claim();
})());});
function trimCovers(cache){
  // Do not enumerate the whole cache on every image load. Keep the existing 200-cover bound.
  if(++coverWrites%20)return Promise.resolve();
  trim=trim.catch(()=>{}).then(async()=>{const keys=(await cache.keys()).filter(r=>isCoverURL(r.url));await Promise.all(keys.slice(0,Math.max(0,keys.length-200)).map(k=>cache.delete(k)));});return trim;
}
async function legacyMatch(req){for(const k of await (legacyKeys||(legacyKeys=caches.keys().then(keys=>keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE&&k!==RUNTIME))))){const r=await (await caches.open(k)).match(req);if(r)return r;}}
self.addEventListener('fetch',event=>{
  const req=event.request,u=new URL(req.url),b=new URL(BASE);
  if(req.method!=='GET'||req.headers.has('Authorization'))return;
  const local=u.origin===b.origin&&u.pathname.startsWith(b.pathname),cover=isCoverURL(u.href)&&(req.destination==='image'||req.mode==='no-cors');
  if(!local&&!cover)return;
  if(cover){event.respondWith((async()=>{
    const cache=await caches.open(RUNTIME),cached=await cache.match(req)||await legacyMatch(req);if(cached)return cached;
    if(!covers.has(req.url))covers.set(req.url,(async()=>{const r=await fetch(req);if(r.ok||r.type==='opaque'){await safePut(cache,req,r.clone());event.waitUntil(trimCovers(cache).catch(()=>{}));}return r;})().finally(()=>covers.delete(req.url)));
    try{return (await covers.get(req.url)).clone();}catch{return Response.error();}
  })());return;}
  const name=u.pathname.slice(b.pathname.length)||'index.html';
  if(![...SHELL,'data.json'].includes(name))return;
  const key=new URL(name,BASE).href;
  event.respondWith((async()=>{
    const cache=await caches.open(name==='data.json'?RUNTIME:CACHE);
    if(name==='icon.svg'||name==='manifest.webmanifest'){const cached=await cache.match(key);if(cached)return cached;}
    try{const r=await fetch(req);if(r.ok){event.waitUntil(safePut(cache,key,r.clone()));return r;}return await cache.match(key)||await legacyMatch(key)||r;}
    catch{return await cache.match(key)||await legacyMatch(key)||new Response('离线副本尚未准备好，请联网打开一次。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}
  })());
});
