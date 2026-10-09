// Optional source rebuild. Never overwrite data.json during a rebuild.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const dir=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
const C=require('./src/core.js');
fs.copyFileSync(path.join(dir,'src/series.js'),path.join(dir,'Bangumi-Watchlist-Importer-v2/series.js'));
// Share normalization and import options with the browser extension.
fs.copyFileSync(path.join(dir,'src/core.js'),path.join(dir,'Bangumi-Watchlist-Importer-v2/core.js'));
const read=f=>fs.readFileSync(path.join(dir,'src',f),'utf8');
const assets=Object.fromEntries(['sw.js','icon.svg','manifest.webmanifest'].map(f=>[f,read(f)]));
const standalone=process.argv.includes('--standalone');
const dataPath=path.join(dir,'data.json');
const data=fs.existsSync(dataPath)?JSON.parse(fs.readFileSync(dataPath,'utf8')):{items:[]};
if(standalone&&data.encrypted)throw new Error('加密数据请通过网站解锁，不能嵌入离线编辑包。');
const seed=standalone?C.parsePayload(data):{items:[]};
const configPath=path.join(dir,'site-config.json');
const cfg=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8')):{};
const config={owner:cfg.owner||'',repo:cfg.repo||'',branch:cfg.branch||'main',pagesUrl:cfg.pagesUrl||'',encrypted:!!data.encrypted};
const json=o=>JSON.stringify(o).replace(/</g,'\\u003c');
const script=s=>s.replace(/<\/script/gi,'<\\/script');
function html(role,payload){return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f6f5f1"><meta name="anime-watchlist-template" content="4"><meta name="referrer" content="no-referrer"><meta name="description" content="王之宝库 · 记录你喜欢的动画、漫画与小说"><title>王之宝库</title><link rel="icon" href="./icon.svg" type="image/svg+xml"><link rel="manifest" href="./manifest.webmanifest"><style id="app-style">${read('style.css')}</style></head>
<body><div id="app"><div class="loading">正在打开作品库…</div></div><script id="boot-data" type="application/json">${json({role,seed:payload,config})}</script><script id="core-script">${script(read('core.js'))}</script><script id="series-script">${script(read('series.js'))}</script><script id="automation-script">${script(read('automation.js'))}</script><script id="app-script">${script(read('app.js'))}</script><script id="asset-data" type="application/json">${json(assets)}</script></body></html>`;}
fs.writeFileSync(path.join(dir,'editor.html'),html('editor',seed));
fs.writeFileSync(path.join(dir,'index.html'),html('viewer',{items:[]}));
if(!fs.existsSync(dataPath))fs.writeFileSync(dataPath,JSON.stringify(C.parsePayload(data),null,2));
for(const [f,text] of Object.entries(assets))fs.writeFileSync(path.join(dir,f),text);
fs.writeFileSync(path.join(dir,'.nojekyll'),'');
console.log('Built editor.html, index.html and PWA assets. data.json preserved. Embedded records:',seed.items.length);
