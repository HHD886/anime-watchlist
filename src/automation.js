/* Versioned, resumable series analysis. Personal records are never replaced by API data. */
(function(root){'use strict';
  root.ShelfAutomation={create};
  function create(h){
    const C=root.Shelf,S=root.ShelfSeries,cache={},subjects={},scanKey='series-scan-v2',backupKey='before-series-v2';
    const empty=()=>({version:S.VERSION,done:[],failed:{},paused:false,complete:false,finished:false,review:[],bridgeDone:[],bridgeFailed:{},force:false});
    let job=empty(),running=false,started=false,stopped=false,starting=null,generation=0,imports=Promise.resolve(),timer,applying=false,signature='',attemptedBridges=new Set(),sync={at:'',count:0,error:''};
    const copy=x=>JSON.parse(JSON.stringify(x)),send=(type,data={})=>h.post(type,data),ids=()=>[...new Set(h.state.payload.items.map(i=>i.bangumiId).filter(Boolean))];
    const fingerprint=()=>JSON.stringify(h.state.payload.items.map(i=>[i.id,i.bangumiId,i.title,i.originalTitle,i.aliases,i.media,i.series,i.seriesId,i.seriesLocked,i.seriesSource]));
    const client=S.createClient({fetch:(...args)=>fetch(...args),get:async k=>h.get('bgm-'+k),set:async(k,v)=>{await h.put('bgm-'+k,v);if(k.startsWith('relations:'))cache[k.slice(10)]=v;else if(k.startsWith('subject:'))subjects[k.slice(8)]=v;}});
    function reviews(){const byId=new Map(h.state.payload.items.map(i=>[i.id,i]));return (job.review||[]).map(r=>({...r,ids:r.ids.filter(id=>byId.has(id)&&!(byId.get(id).seriesLocked&&!byId.get(id).series))})).filter(r=>r.ids.length>1&&new Set(r.ids.map(id=>byId.get(id).seriesId||id)).size>1);}
    function stats(){const present=new Set(ids()),done=new Set(job.done),review=reviews(),failed=Object.keys(job.failed).filter(id=>present.has(id)).length;return {running,paused:job.paused,complete:job.complete,finished:job.finished,total:present.size,done:[...present].filter(id=>done.has(id)&&!job.failed[id]).length,failed,bridgeFailed:Object.keys(job.bridgeFailed||{}).length,review,reviewWorks:new Set(review.flatMap(r=>r.ids)).size,assigned:h.state.payload.items.filter(i=>i.seriesSource==='auto'&&i.seriesId).length,...S.metrics(h.state.payload.items),sync};}
    function changed(){h.progress(stats());}
    async function saveJob(){await h.put(scanKey,copy(job));changed();}
    function snapshot(){if(!started||h.state.locked||h.state.secondary||h.state.unavailable)return;send('LIBRARY_INDEX',{index:S.minimalIndex(h.state.payload.items,{version:h.state.localRevision,scope:location.href.split('#')[0]},cache)});}
    async function commit(fn,msg='',undo=false){applying=true;try{await h.commit(fn,msg,undo);signature=fingerprint();}finally{applying=false;}}
    async function apply(expected=generation){
      while(h.state.busy&&!stopped)await new Promise(r=>setTimeout(r,250));if(stopped||expected!==generation)return;
      await commit(()=>{if(expected!==generation)return;const result=S.analyse(h.state.payload.items,cache,subjects);job.review=result.review;if(h.state.payload.seriesSchema===S.VERSION&&h.state.payload.seriesScan?.version===S.VERSION&&h.state.payload.seriesScan.complete===!!job.complete&&JSON.stringify(result.items)===JSON.stringify(h.state.payload.items))return false;h.state.payload.items=result.items;h.state.payload.seriesSchema=S.VERSION;h.state.payload.seriesScan={version:S.VERSION,complete:!!job.complete,at:C.now()};});
      await saveJob();snapshot();
    }
    async function metadata(sid){if(subjects[sid]?.item?.seriesMetadata)return subjects[sid];const value=await client.subject(sid,!!subjects[sid]);subjects[sid]=value;return value;}
    async function enrich(sid,expected){
      const rows=cache[sid]?.rows||[],local=new Set(ids());
      // Ambiguous alternate-setting works need official aliases plus creator evidence.
      const worlds=rows.filter(r=>/世界观|Setting/.test(r.relation)&&local.has(r.id)).slice(0,2);
      if(worlds.length){await metadata(sid);for(const r of worlds){if(expected!==generation)return;await metadata(r.id);}}
      // A bounded bridge lookup connects missing middle seasons / original books.
      const bridges=rows.filter(r=>!local.has(r.id)&&(S.relationLevel(r)==='high'||['书籍','动画','漫画','小说'].includes(r.relation))).slice(0,2);
      for(const r of bridges){if(expected!==generation||job.paused||stopped)return;if(job.bridgeDone.includes(r.id)||attemptedBridges.has(r.id))continue;if(job.bridgeDone.length+attemptedBridges.size>=120)break;attemptedBridges.add(r.id);
        try{cache[r.id]=await client.relations(r.id,job.force);delete job.bridgeFailed[r.id];job.bridgeDone.push(r.id);}catch(e){job.bridgeFailed[r.id]=e.message;}
      }
    }
    async function scan(){
      if(running||job.paused||stopped||!started)return;running=true;attemptedBridges=new Set();const expected=generation;changed();
      try{
        // Always analyse all records, even if all network requests were completed earlier.
        await apply(expected);if(expected!==generation)return;
        for(const sid of Object.keys(job.bridgeFailed)){if(expected!==generation||job.paused||stopped)break;attemptedBridges.add(sid);try{cache[sid]=await client.relations(sid,true);if(expected!==generation)return;delete job.bridgeFailed[sid];if(!job.bridgeDone.includes(sid))job.bridgeDone.push(sid);}catch(e){if(expected!==generation)return;job.bridgeFailed[sid]=e.message;}}
        const done=new Set(job.done.filter(id=>!job.failed[id]));let batch=0;
        for(const sid of ids()){
          if(job.paused||stopped||expected!==generation)break;if(done.has(sid))continue;
          while(h.state.busy&&!job.paused&&!stopped)await new Promise(r=>setTimeout(r,250));if(job.paused||stopped)break;
          try{
            cache[sid]=await client.relations(sid,job.force||!!job.failed[sid]||cache[sid]?.rows?.length===0);if(expected!==generation)return;
            await enrich(sid,expected);if(expected!==generation)return;if(job.paused||stopped)break;
            done.add(sid);delete job.failed[sid];
          }catch(e){if(expected!==generation)return;done.delete(sid);job.failed[sid]=e.message;}
          job.done=[...done];await saveJob();if(++batch%12===0)await apply(expected);
        }
        if(expected!==generation)return;
        job.finished=!job.paused&&ids().every(sid=>done.has(sid)||job.failed[sid]);job.complete=job.finished&&ids().every(sid=>done.has(sid))&&!Object.keys(job.bridgeFailed).length;
        await apply(expected);await saveJob();
      }catch(e){job.paused=true;job.complete=false;sync.error='自动整理暂停：'+e.message;h.toast(sync.error);await saveJob().catch(()=>{});}
      finally{running=false;changed();if(expected!==generation&&!job.paused&&!stopped)schedule();}
    }
    function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if(!job.paused)scan().catch(e=>{sync.error=e.message;changed();});},800);}
    function start(){if(starting)return starting;starting=initialize().catch(e=>{starting=null;throw e;});return starting;}
    async function initialize(){
      if(started||h.state.locked||h.state.secondary||h.state.unavailable)return;
      if(!await h.get(backupKey))await h.put(backupKey,{at:C.now(),payload:copy(h.state.payload)});
      const old=await h.get(scanKey),legacy=old?null:await h.get('series-scan-v1');
      const published=h.state.payload.seriesSchema===S.VERSION&&h.state.payload.seriesScan?.version===S.VERSION&&h.state.payload.seriesScan.complete;
      job=old?{...empty(),...old}:legacy?{...empty(),done:(legacy.done||[]).filter(id=>!legacy.failed?.[id]),failed:legacy.failed||{}}:published?{...empty(),done:ids(),complete:true,finished:true}:empty();
      const all=[...new Set([...ids(),...job.bridgeDone])];for(let n=0;n<all.length;n+=32)await Promise.all(all.slice(n,n+32).map(async sid=>{const [r,s]=await Promise.all([h.get('bgm-relations:'+sid),h.get('bgm-subject:'+sid)]);if(r)cache[sid]=r;if(s)subjects[sid]=s;}));
      // v1 "done" may include failed/empty responses, and did not inspect bridge/alias data.
      if(!old&&!published)job.done=[];
      for(const i of h.state.payload.items){if(cache[i.bangumiId]||!i.seriesEvidence?.length)continue;cache[i.bangumiId]={at:0,partial:true,rows:i.seriesEvidence.filter(e=>e.level==='high'&&e.source!=='titles').map(e=>({id:e.from===i.bangumiId?e.to:e.from,relation:e.relation,type:2}))};}
      started=true;if(!job.paused)await apply();else signature=fingerprint();changed();snapshot();if(!job.paused&&!job.complete)schedule();
    }
    function saved(){if(!started)return;snapshot();if(applying)return;if(fingerprint()!==signature){job.complete=false;job.finished=false;schedule();}}
    async function rescan(){generation++;await h.put('before-series-rescan',{at:C.now(),payload:copy(h.state.payload)});job={...empty(),force:true};await apply();await saveJob();schedule();}
    async function pause(){job.paused=true;await saveJob();}
    async function resume(){job.paused=false;job.done=job.done.filter(id=>!job.failed[id]);job.complete=false;job.finished=false;sync.error='';await saveJob();schedule();}
    async function decide(ids,name){await commit(()=>{if(name)h.state.payload.items=C.assignSeries(h.state.payload.items,{name,ids});else h.state.payload.items=h.state.payload.items.map(i=>ids.includes(i.id)?{...i,series:'',seriesId:'',seriesSource:'manual',seriesLocked:true,seriesCover:false}:i);},name?'已确认系列，后续扫描会保留你的决定':'已保留为独立作品',true);await apply();}
    async function automatic(ids){await commit(()=>{h.state.payload.items=h.state.payload.items.map(i=>ids.includes(i.id)?{...i,seriesLocked:false,seriesSource:'auto'}:i);},'已恢复自动识别',true);await apply();}
    function receive(message){
      if(message.type==='SYNC_STATUS'){sync={at:message.at||'',count:message.count||0,error:message.error||''};changed();return;}
      if(message.type==='EXTENSION_READY'){snapshot();return;}if(message.type!=='IMPORT_JOB'||!started)return;
      imports=imports.catch(()=>{}).then(async()=>{const request=message.job;if(!request?.item?.bangumiId||!request.receipt)return;if(h.state.busy){send('IMPORT_RESULT',{receipt:request.receipt,error:'作品库正在发布或读取，请稍后重试'});return;}
        try{const sid=C.subjectId(request.item.bangumiId);if(request.relations){const entry={at:Date.now(),rows:S.cleanRelations(request.relations)};await h.put('bgm-relations:'+sid,entry);cache[sid]=entry;}
          await commit(()=>{const merged=C.merge(h.state.payload.items,[request.item],'fill'),result=S.analyse(merged.items,cache,subjects);h.state.payload.items=result.items;job.review=result.review;},'已从 Bangumi 收录「'+request.item.title+'」');
          send('IMPORT_RESULT',{receipt:request.receipt,index:S.minimalIndex(h.state.payload.items,{version:h.state.localRevision,scope:location.href.split('#')[0]},cache)});job.complete=false;job.finished=false;await saveJob();schedule();
        }catch(e){send('IMPORT_RESULT',{receipt:request.receipt,error:e.message});sync.error=e.message;changed();}
      });
    }
    function retrySync(){snapshot();send('SYNC_REQUEST');}
    async function backup(){const b=await h.get(backupKey);if(!b)throw new Error('尚无本次修复前备份');return b;}
    async function restore(){const b=await backup();await pause();generation++;await commit(()=>{h.state.payload=C.parsePayload(b.payload);},'已恢复修复前备份，自动扫描已暂停',true);job={...empty(),paused:true};await saveJob();snapshot();}
    function stop(){stopped=true;generation++;clearTimeout(timer);}
    return {start,saved,snapshot,stats,rescan,pause,resume,decide,automatic,receive,retrySync,backup,restore,stop,scan,cache,subjects,client};
  }
})(typeof window!=='undefined'?window:globalThis);
