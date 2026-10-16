'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom'),{IDBFactory}=require('fake-indexeddb');
const base=require('node:path').resolve(__dirname,'..');
const C=require(base+'/src/core.js');
const initial={items:[]};
class MemoryStorage{constructor(){this.map=new Map()}getItem(k){return this.map.get(k)??null}setItem(k,v){this.map.set(k,String(v))}removeItem(k){this.map.delete(k)}}
async function setup(options={}){
 const html=fs.readFileSync(base+'/editor.html','utf8'),{window,document}=parseHTML(html);
 const proto=window.HTMLElement.prototype;
 proto.showModal=function(){this.setAttribute('open','');this.open=true};
 proto.close=function(){this.open=false;this.removeAttribute('open');this.dispatchEvent(new window.Event('close'))};
 proto.focus=function(){};
 proto.checkValidity=function(){return true};
 Object.defineProperty(proto,'elements',{configurable:true,get(){const list=[...this.querySelectorAll('input,select,textarea,button')];for(const el of list)if(el.name)list[el.name]=el;return list}});
 class DOMFormData{constructor(form){this.values=[];for(const el of form.querySelectorAll('input,select,textarea')){if(!el.name||el.disabled)continue;if(el.type==='checkbox'&&!(el.checked??el.hasAttribute('checked')))continue;this.values.push([el.name,el.type==='checkbox'?(el.value||'on'):(el.value??'')])}}get(k){return this.values.find(([key])=>k===key)?.[1]??null}[Symbol.iterator](){return this.values[Symbol.iterator]()}}
 const localStorage=new MemoryStorage(),sessionStorage=new MemoryStorage();
 if(options.legacy)localStorage.setItem('animeWatchlistData_v1',JSON.stringify(options.legacy));
 const ctx={document,window,Shelf:C,crypto:global.crypto,indexedDB:options.indexedDB||new IDBFactory(),localStorage,sessionStorage,location:options.location||{protocol:'file:',href:'file:///product/editor.html',hash:'',origin:'null'},navigator:{onLine:true},matchMedia:()=>({matches:false}),setTimeout:(fn,ms)=>{const h=setTimeout(fn,ms);h.unref?.();return h},clearTimeout,setInterval:(fn,ms)=>{const t=setInterval(fn,ms);t.unref();return t},clearInterval,URL,Blob,TextEncoder,TextDecoder,AbortController,FormData:DOMFormData,HTMLImageElement:window.HTMLImageElement,Image:window.HTMLImageElement,btoa,atob,console,confirm:()=>true,fetch:options.fetch||(async()=>{throw new Error('Unexpected network access')})};
 window.Shelf=C;window.ShelfSeries=require(base+'/src/series.js');window.scrollTo=()=>{};window.postMessage=()=>{};
 document.getElementById('boot-data').textContent=JSON.stringify(options.boot||{role:'editor',seed:initial});
 const app=fs.readFileSync(base+'/src/app.js','utf8').replace(/\}\)\(\);\s*$/,'window.__qa={seriesManage,seriesDetail,readSeriesParts,renderSeriesPicks,saveSeries,seriesSuggestionsDialog,applySeriesSuggestions,seriesRelations,saveSeriesRelations,state,render,detail,editForm,saveForm,mutate,increment,payload,storeGet,storePut,persist,buildHTML,publish,remoteSnapshot,pullGithub,importDialog,doSearch,doAccount,renderImportPreview,commitImport,doBulk,batchRemaining,readPreviewControls,updateSearchInput,settingsHTML,loadViewer,tagPicker,selectedTags,setWatchPosition,updateWatchFields,setPending:(v,k)=>{pending=v;pendingKind=k},getAutomation:()=>automation,startAutomation,autoDialog,readBackup,updateHTML,setConfig:(v,t,p)=>{config=v;ghToken=t;password=p}};})();');
 vm.createContext(ctx);if(options.automation){ctx.setInterval=(fn,ms)=>{const t=setInterval(fn,ms);t.unref();return t;};ctx.clearInterval=clearInterval;vm.runInContext(fs.readFileSync(base+'/src/automation.js','utf8'),ctx);}await vm.runInContext(app,ctx);assert.ok(window.__qa,'app booted');
 if(options.view!==null){window.__qa.state.view=options.view||'library';window.__qa.render();}
 return {q:window.__qa,window,document,ctx,localStorage};
}
function field(doc,name,value){const e=doc.querySelector(`[name="${name}"]`);assert.ok(e,'field exists '+name);if(e.tagName==='SELECT'){for(const o of e.options)o.removeAttribute('selected');[...e.options].find(o=>o.value===value)?.setAttribute('selected','');}else if(e.type==='checkbox'){e.checked=!!value;}else e.value=String(value);return e;}
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});

module.exports={setup,field,response};
