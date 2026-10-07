/* Scope-local cache; GitHub/Bangumi API requests and credentials are never cached. */
const CACHE_PREFIX='hhd-workshelf-'+new URL(self.registration.scope).pathname+'-';
const CACHE=CACHE_PREFIX+'4.0.1';
const BASE=self.registration.scope;
const SHELL=['index.html','editor.html','manifest.webmanifest','icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(p=>new URL(p,BASE).href))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request,u=new URL(req.url),b=new URL(BASE);
  if(req.method!=='GET'||req.headers.has('Authorization'))return;
  const local=u.origin===b.origin&&u.pathname.startsWith(b.pathname);
  const isCover=u.hostname==='lain.bgm.tv'&&(req.destination==='image'||req.mode==='no-cors');
  if(!local&&!isCover)return;
  if(isCover){event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(req);if(cached)return cached;try{const r=await fetch(req);if(r.ok||r.type==='opaque'){await cache.put(req,r.clone());const keys=await cache.keys();const covers=keys.filter(x=>new URL(x.url).hostname==='lain.bgm.tv');if(covers.length>200)await cache.delete(covers[0]);}return r;}catch{return Response.error();}}));return;}
  const name=u.pathname.slice(b.pathname.length)||'index.html';
  if(![...SHELL,'data.json'].includes(name))return;
  const key=new URL(name,BASE).href;
  event.respondWith(caches.open(CACHE).then(async cache=>{try{const r=await fetch(req);if(r.ok){await cache.put(key,r.clone());return r;}const cached=await cache.match(key);return cached||r;}catch{const cached=await cache.match(key);return cached||new Response('离线副本尚未准备好，请联网打开一次。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}}));
});
