'use client';
import {useEffect,useRef,useState} from 'react';
import {useAI} from '../ai/views';
import {useCore} from '../core/context';
import {useFiles} from '../editor/session';
import {useWorkspace} from '../workspace/context';
import {useI18n} from '@/i18n/react';
import {remoteCore} from '../core/remote-client';
import {contentHash} from '../ai/fix-service';
import type {AnalysisRecord} from '../ai/domain';
import type {GraphActivation,GraphOverview} from './execution';
import {graphReviewLocation} from './review-navigation';
import {graphFixScope,verifiedGraphFix,failedGraphFix} from './graph-fix';
export function GraphFixReview({execution,activation,disabled,reviewDisabled=false,onOverview}:{execution:GraphOverview['executions'][number];activation:GraphActivation;disabled:boolean;reviewDisabled?:boolean;onOverview:(value:GraphOverview)=>void}){
 const ai=useAI(),core=useCore(),files=useFiles(),{dispatch}=useWorkspace(),{t}=useI18n();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const live=useRef(true),locked=useRef(false);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const attempts=graphFixScope(execution,activation,ai.fixes.history),latest=attempts.at(-1);
 async function perform(action:'review'|'finish'|'reject'|'reanalyze'){
  if(locked.current||(action==='review'?reviewDisabled:disabled)||!ai.historyReady||!core.connection.connected)return;locked.current=true;setBusy(true);setError('');const generation=remoteCore.generation;
  const check=()=>{if(!live.current||generation!==remoteCore.generation||!core.connection.connected)throw Error('Graph fix connection changed.');};
  try{
   if(action==='review'){
    const record=ai.service.history.find(r=>r.id===activation.analysisId)??(await core.connection.historyRequest<{value:AnalysisRecord}|null>({action:'get',kind:'analysis',id:activation.analysisId},execution.projectId))?.value;
    check();if(!record||record.projectId!==execution.projectId||record.task?.graph?.executionId!==execution.id||record.task.graph.activationId!==activation.id||record.task.graph.leaseId!==activation.leaseId||!record.result.proposal.length)throw Error('No matching patch proposal. Reject this fix gate or review the analysis.');
    if(!ai.service.history.some(r=>r.id===record.id))ai.service.history.push(record);
    ai.selectRecord(record);ai.setGraphReview(graphReviewLocation(execution.projectId,execution,activation,record));ai.setProposal({record,index:0});dispatch({type:'activity',value:'ai'});return;
   }
   if(action==='reanalyze'){await ai.fixes.flush();failedGraphFix(execution.projectId,execution.id,activation,latest,core.snapshot);check();const approval=await files.ask({title:t('Re-analyze failed retest'),message:t('Keep the failed attempt and applied changes. Create a new analysis review using this failed Run and its masked logs and evidence. No AI request or patch is sent now.'),choices:[{value:'review',label:t('Re-analyze failed retest')},{value:'cancel',label:t('Cancel')}]});if(approval!=='review')return;check();}
   else if(action==='finish'){
    await ai.fixes.flush();if(files.documents.snapshot().dirtyEditors.length)throw Error('Save current edits before completing graph fix.');
    const verified=verifiedGraphFix(execution.projectId,execution.id,activation,latest,core.snapshot);
    for(const p of latest!.patches)if(await contentHash((await files.files.read(p.path)).content)!==p.resultHash)throw Error('PATCH_CONFLICT');
    check();const approval=await files.ask({title:t('Complete verified graph fix'),message:verified.testName+' · '+verified.runId+'\n'+latest!.patches.map(p=>p.path).join(', ')+'\n\n'+t('Continue the graph using this approved patch and matching successful remote Run?'),choices:[{value:'continue',label:t('Complete verified graph fix')},{value:'cancel',label:t('Cancel')}]});
    if(approval!=='continue')return;check();if(files.documents.snapshot().dirtyEditors.length)throw Error('PATCH_CONFLICT');
    for(const p of latest!.patches)if(await contentHash((await files.files.read(p.path)).content)!==p.resultHash)throw Error('PATCH_CONFLICT');
   }else{const approval=await files.ask({title:t('Reject graph fix'),message:t('Reject this fix gate and follow the failure path. Applied changes stay available for explicit Revert.'),choices:[{value:'reject',label:t('Reject graph fix')},{value:'cancel',label:t('Cancel')}]});if(approval!=='reject')return;check();}
   const overview=await remoteCore.graphRequest<GraphOverview>(action==='reanalyze'?'ai-reanalyze':action==='finish'?'ai-fix-complete':'ai-fix-reject',{executionId:execution.id,activationId:activation.id,revision:execution.revision,checksum:execution.checksum,attemptId:latest?.id});check();onOverview(overview);
  }catch(e){if(live.current)setError(e instanceof Error?e.message:'Graph fix unavailable.');}finally{locked.current=false;if(live.current)setBusy(false);}
 }
 return <section className="orch-graph-fix" aria-label={t('Graph fix workflow')}><p>{t('Graph fix workflow')} · {t(activation.status)}</p>{attempts.map(a=><div key={a.id}><strong>{t('Attempt')} {a.attempt} · {t(a.status)}</strong><p>{a.patches.map(p=>p.path).join(', ')}</p>{a.snapshot?.schemaVersion===2&&a.retestRunId&&<button className="fs-button" onClick={()=>ai.openSnapshot({runId:a.retestRunId!,snapshotId:a.snapshot!.snapshotId,checksum:a.snapshot!.checksum},undefined,undefined,graphReviewLocation(execution.projectId,execution,activation))}>{t('Review tested Snapshot source')}</button>}{a.validation?.map((v,i)=><small key={i}>{v.name} · {v.status} · {v.durationMs}ms </small>)}{a.retestRunId&&<button className="fs-button" onClick={()=>void ai.openRun(a.retestRunId!)}>{t('Open Run')} · {a.retestRunId.slice(0,8)}</button>}</div>)}<button className="fs-button" disabled={reviewDisabled||busy||!ai.historyReady||!core.connection.connected} onClick={()=>void perform('review')}>{t('Review graph fix proposal')}</button>{activation.status==='ai-fix-review'&&execution.status==='running'&&<>{latest?.status==='failed'&&latest.retestRunId&&<button className="fs-button" disabled={disabled||busy} onClick={()=>void perform('reanalyze')}>{t('Re-analyze failed retest')}</button>}<button className="fs-button" disabled={disabled||busy||latest?.status!=='passed'} onClick={()=>void perform('finish')}>{t('Complete verified graph fix')}</button><button className="fs-button" disabled={disabled||busy} onClick={()=>void perform('reject')}>{t('Reject graph fix')}</button></>}{error&&<p role="status">{error}</p>}</section>;
}
