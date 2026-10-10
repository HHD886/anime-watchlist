/* Resumable local series scan and acknowledged extension imports. */
(function(root){'use strict';
  root.ShelfAutomation={create};
  function create(h){
    const C=root.Shelf,S=root.ShelfSeries,cache={},scanKey='series-scan-v1',backupKey='before-auto-series-v1';
    let job={done:[],failed:{},paused:false,complete:false,review:[],assigned:0},running=false,started=false,stopped=false,starting=null,generation=0,imports=Promise.resolve(),timer,sync={at:'',count:0,error:''};
    const copy=x=>JSON.parse(JSON.stringify(x)),send=(type,data={})=>h.post(type,data);
    const client=S.createClient({fetch:(...args)=>fetch(...args),get:async k=>h.get('bgm-'+k),set:async(k,v)=>{await h.put('bgm-'+k,v);if(k.startsWith('relations:'))cache[k.slice(10)]=v;}});
    function reviews(){const byId=new Map(h.state.payload.items.map(i=>[i.id,i]));return (job.review||[]).map(r=>({...r,ids:r.ids.filter(id=>byId.has(id)&&!(byId.get(id).seriesLocked&&!byId.get(id).series))})).filter(r=>r.ids.length>1&&new Set(r.ids.map(id=>byId.get(id).seriesId||id)).size>1);}
    const stats=()=>({running,paused:job.paused,complete:job.complete,total:h.state.payload.items.filter(i=>i.bangumiId).length,done:h.state.payload.items.filter(i=>i.bangumiId&&job.done.includes(i.bangumiId)).length,failed:h.state.payload.items.filter(i=>job.failed[i.bangumiId]).length,review:reviews(),assigned:h.state.payload.items.filter(i=>i.seriesSource==='auto'&&i.seriesId).length,seriesCount:new Set(h.state.payload.items.map(i=>i.seriesId).filter(Boolean)).size,sync});
    function changed(){h.progress(stats());}
    async function saveJob(){await h.put(scanKey,copy(job));changed();}
    function snapshot(){if(!started||h.state.locked||h.state.secondary||h.state.unavailable)return;send('LIBRARY_INDEX',{index:S.minimalIndex(h.state.payload.items,{version:h.state.localRevision,scope:location.href.split('#')[0]},cache)});}
    async function apply(expected=generation){
      while(h.state.busy&&!stopped)await new Promise(r=>setTimeout(r,250));if(stopped)return;
      await h.commit(()=>{if(expected!==generation)return;const result=S.analyse(h.state.payload.items,cache);h.state.payload.items=result.items;job.review=result.review;job.assigned=(job.assigned||0)+result.assigned;h.state.payload.seriesSchema=1;h.state.payload.seriesScan={complete:!!job.complete,at:C.now()};},'');
      await saveJob();snapshot();
    }
    async function scan(){
      if(running||job.paused||stopped||!started)return;if(job.complete&&h.state.payload.items.every(i=>(i.series||i.seriesLocked)&&(!i.bangumiId||job.done.includes(i.bangumiId))))return;running=true;const scanGeneration=generation;changed();
      try{
        const done=new Set(job.done),ids=[...new Set(h.state.payload.items.map(i=>i.bangumiId).filter(Boolean))];let batch=0;
        for(const sid of ids){
          if(job.paused||stopped||scanGeneration!==generation)break;if(done.has(sid))continue;
          while(h.state.busy&&!job.paused&&!stopped)await new Promise(r=>setTimeout(r,250));if(job.paused||stopped)break;
          try{cache[sid]=await client.relations(sid);if(scanGeneration!==generation)return;delete job.failed[sid];}catch(e){if(scanGeneration!==generation)return;job.failed[sid]=e.message;}
          done.add(sid);job.done=[...done];await saveJob();
          if(++batch%16===0)await apply(scanGeneration);
        }
        if(scanGeneration!==generation)return;job.complete=!job.paused&&ids.every(sid=>done.has(sid));await apply(scanGeneration);await saveJob();
      }catch(e){job.paused=true;sync.error='自动整理暂停：'+e.message;h.toast(sync.error);await saveJob().catch(()=>{});}
      finally{running=false;changed();if(scanGeneration!==generation&&!job.paused&&!stopped)schedule();}
    }
    function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if(!job.paused)scan().catch(e=>{sync.error=e.message;changed();});},800);}
    function start(){if(starting)return starting;starting=initialize().catch(e=>{starting=null;throw e;});return starting;}
    async function initialize(){
      if(started||h.state.locked||h.state.secondary)return;
      const original=copy(h.state.payload);
      if(!await h.get(backupKey))await h.put(backupKey,{at:C.now(),payload:original});
      job=await h.get(scanKey)||(h.state.payload.seriesScan?.complete?{...job,done:h.state.payload.items.map(i=>i.bangumiId).filter(Boolean),complete:true}:job);
      const ids=[...new Set(h.state.payload.items.map(i=>i.bangumiId).filter(Boolean))];
      await Promise.all(ids.map(async sid=>{const v=await h.get('bgm-relations:'+sid);if(v)cache[sid]=v;}));
      for(const i of h.state.payload.items){if(cache[i.bangumiId]||!i.seriesEvidence?.length)continue;cache[i.bangumiId]={at:0,partial:true,rows:i.seriesEvidence.filter(e=>e.level==='high').map(e=>({id:e.from===i.bangumiId?e.to:e.from,relation:e.relation,type:2}))};}
      started=true;
      if(!h.state.payload.seriesSchema)await apply();
      changed();snapshot();schedule();
    }
    function saved(){if(!started)return;snapshot();if(h.state.payload.items.some(i=>!i.series&&!i.seriesLocked||i.bangumiId&&!job.done.includes(i.bangumiId)))schedule();}
    async function rescan(){
      generation++;
      await h.put('before-series-rescan', {at:C.now(),payload:copy(h.state.payload)});
      job={done:[],failed:{},paused:false,complete:false,review:[],assigned:0};await saveJob();schedule();
    }
    async function pause(){job.paused=true;await saveJob();}
    async function resume(){job.paused=false;const failed=new Set(Object.keys(job.failed));job.done=job.done.filter(id=>!failed.has(id));job.failed={};job.complete=false;await saveJob();schedule();}
    async function decide(ids,name){
      await h.commit(()=>{if(name)h.state.payload.items=C.assignSeries(h.state.payload.items,{name,ids});else h.state.payload.items=h.state.payload.items.map(i=>ids.includes(i.id)?{...i,series:'',seriesId:'',seriesSource:'manual',seriesLocked:true,seriesCover:false}:i);},name?'已确认系列，后续扫描会保留你的决定':'已保留为独立作品',true);
      await apply();
    }
    async function automatic(ids){await h.commit(()=>{h.state.payload.items=h.state.payload.items.map(i=>ids.includes(i.id)?{...i,seriesLocked:false,seriesSource:'auto'}:i);},'已恢复自动识别',true);await apply();}
    function receive(message){
      if(message.type==='SYNC_STATUS'){sync={at:message.at||'',count:message.count||0,error:message.error||''};changed();return;}
      if(message.type==='EXTENSION_READY'){snapshot();return;}
      if(message.type!=='IMPORT_JOB'||!started)return;
      imports=imports.catch(()=>{}).then(async()=>{
        const request=message.job;if(!request?.item?.bangumiId||!request.receipt)return;
        if(h.state.busy){send('IMPORT_RESULT',{receipt:request.receipt,error:'作品库正在发布或读取，请稍后重试'});return;}
        try{
          const sid=C.subjectId(request.item.bangumiId);
          if(request.relations){const entry={at:Date.now(),rows:S.cleanRelations(request.relations)};await h.put('bgm-relations:'+sid,entry);cache[sid]=entry;}
          await h.commit(()=>{const merged=C.merge(h.state.payload.items,[request.item],'fill');const result=S.analyse(merged.items,cache);h.state.payload.items=result.items;job.review=result.review;job.assigned+=result.assigned;},'已从 Bangumi 收录「'+request.item.title+'」');
          // A receipt is sent only after the database transaction has completed.
          send('IMPORT_RESULT',{receipt:request.receipt,index:S.minimalIndex(h.state.payload.items,{version:h.state.localRevision,scope:location.href.split('#')[0]},cache)});
          await saveJob();schedule();
        }catch(e){send('IMPORT_RESULT',{receipt:request.receipt,error:e.message});sync.error=e.message;changed();}
      });
    }
    function retrySync(){snapshot();send('SYNC_REQUEST');}
    async function backup(){const b=await h.get(backupKey);if(!b)throw new Error('尚无升级前备份');return b;}
    async function restore(){const b=await backup();await pause();generation++;await h.commit(()=>{h.state.payload=C.parsePayload(b.payload);},'已恢复升级前备份，自动扫描已暂停',true);job={done:[],failed:{},paused:true,complete:false,review:[],assigned:0};await saveJob();snapshot();}
    function stop(){stopped=true;generation++;clearTimeout(timer);}
    return {start,saved,snapshot,stats,rescan,pause,resume,decide,automatic,receive,retrySync,backup,restore,stop,scan,cache,client};
  }
})(typeof window!=='undefined'?window:globalThis);
