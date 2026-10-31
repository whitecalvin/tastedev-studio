'use client';
import {findInstruction} from '../frameworks/catalog';
import {useEffect,useEffectEvent,useRef,useState} from 'react';
import {graphReviewLocation} from './review-navigation';
import {GraphFixReview} from './graph-fix-review';
import {useAI} from '../ai/views';
import {useFiles} from '../editor/session';
import {useWorkspace} from '../workspace/context';
import {remoteCore} from '../core/remote-client';
import {useI18n} from '@/i18n/react';
import type {GraphOverview,GraphActivation} from './execution';
import type {TaskAIRequest} from './task-ai';
type Execution=GraphOverview['executions'][number];
export function GraphAIReview({execution,activation,plan,disabled,reviewDisabled=false,onOverview}:{execution:Execution;activation:GraphActivation;plan:TaskAIRequest;disabled:boolean;reviewDisabled?:boolean;onOverview:(value:GraphOverview)=>void}){
 const ai=useAI(),files=useFiles(),{dispatch}=useWorkspace(),{t}=useI18n();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const stop=useRef(ai.stop);
 const autoClaim=useRef('');
 const locked=useRef(false),lease=useRef<string|undefined>(undefined),live=useRef(true),latest=useRef({execution,activation,disabled});
 useEffect(()=>{stop.current=ai.stop;latest.current={execution,activation,disabled};if(lease.current&&(activation.leaseId!==lease.current||activation.status!=='ai-running'||execution.status!=='running'))ai.stop();},[execution,activation,disabled,ai]);
 useEffect(()=>{live.current=true;return()=>{live.current=false;if(lease.current)stop.current();};},[]);
 async function run(contractApproved=false){
  if(locked.current||disabled||ai.status==='generating'||!ai.historyReady)return;
  locked.current=true;setBusy(true);setError('');const session=remoteCore.generation,folder=files.files.connection?.id;
  const input={executionId:execution.id,activationId:activation.id,revision:execution.revision,checksum:execution.checksum};
  const current=()=>live.current&&session===remoteCore.generation&&files.files.connection?.id===folder&&files.files.connection?.permission==='granted'&&!files.documents.snapshot().dirtyEditors.length&&!latest.current.disabled&&latest.current.execution.status==='running'&&latest.current.activation.id===activation.id;
  try{
   if(!current())throw Error('Review the connected saved workspace first.');
   const approved=contractApproved&&execution.factory?'run':await files.ask({title:t('Run graph AI'),message:plan.label+'\n'+plan.route.connectionId+' · '+plan.route.model+'\n\n'+plan.question+(plan.instructionRef?'\n\n'+findInstruction(plan.instructionRef).raw:'')+'\n\n'+(activation.failure?'Retest Run: '+activation.failure.runId+'\nOriginal Run: '+activation.failure.originalRunId+'\nAttempt: '+activation.failure.attemptId+'\nImmutable failed-Run Snapshot snippets, masked failure logs and evidence will be included. Current workspace source is excluded.\n\n':'')+(activation.failure?t('Re-analysis reads the failed Run Snapshot and masked logs and evidence. Current editor content and Git diff are excluded. Source changes require separate approval.'):t('Graph AI reads the currently connected saved workspace, Protocol context and masked read-tool results. Analysis completion is not a test PASS. Source changes require separate approval.')),choices:[{value:'run',label:t('Run graph AI')},{value:'cancel',label:t('Cancel AI task')}]});
   if(approved!=='run')return;if(!current()||latest.current.activation.status!=='ai-review')throw Error('AI review scope changed.');
   const claimed=await remoteCore.graphRequest<GraphOverview>('ai-start',input),a=claimed.executions.find(e=>e.id===execution.id)?.activations.find(a=>a.id===activation.id);
   if(!a?.leaseId)throw Error('AI activation claim unavailable.');lease.current=a.leaseId;if(!current())throw Error('AI review scope changed.');onOverview(claimed);
   const result=await ai.send(plan.question,false,false,{...structuredClone(plan),...(a.failure?{failure:a.failure}:{}),graph:{executionId:execution.id,activationId:activation.id,leaseId:a.leaseId}});
   if(!current())throw Error('AI connection or workspace changed.');
   const completed=await remoteCore.graphRequest<GraphOverview>(result?'ai-complete':'ai-fail',{...input,leaseId:a.leaseId,...(result?{analysisId:result.id}:{})});if(live.current)onOverview(completed);
  }catch(e){
   // A recorded claim is never retried silently after an uncertain network reply.
   if(lease.current&&session===remoteCore.generation)try{const failed=await remoteCore.graphRequest<GraphOverview>('ai-fail',{...input,leaseId:lease.current});if(live.current)onOverview(failed);}catch{/* Core deadline or restart recovery owns the unresolved activation. */}
   if(live.current)setError(e instanceof Error?e.message:'AI analysis unavailable.');
  }finally{lease.current=undefined;locked.current=false;if(live.current)setBusy(false);}
 }
 const runAutomatic=useEffectEvent(()=>void run(true));
 useEffect(()=>{
  if(files.files.connection?.permission!=='granted'||files.documents.snapshot().dirtyEditors.length||!execution.factory||execution.status!=='running'||activation.status!=='ai-review'||disabled||ai.status==='generating'||!ai.historyReady||autoClaim.current===activation.id)return;
  autoClaim.current=activation.id;queueMicrotask(()=>runAutomatic());
 },[files.files.connection?.id,files.files.connection?.permission,files.documents,files.editor.dirtyEditors.length,execution.factory,execution.status,activation.id,activation.status,disabled,ai.status,ai.historyReady]);
 function open(){try{const record=ai.service.history.find(r=>r.id===activation.analysisId);if(record){const origin=graphReviewLocation(execution.projectId,execution,activation,record);ai.selectRecord(record);ai.setGraphReview(origin);dispatch({type:'activity',value:'ai'});}}catch{setError('Graph review analysis mismatch.');}}
 return <div className="orch-graph-ai"><details><summary>{t('AI prompt')}</summary><p>{plan.route.connectionId} · {plan.route.model} · {plan.budget.maxProviderRequests} / {plan.budget.timeoutMs/1000}s</p><p>{t('AI completion policy')}: {t(plan.completion==='verified-fix'?'Fix verified by remote test':'Analysis completed')}</p><pre>{plan.question}</pre>{plan.instructionRef&&<pre>{findInstruction(plan.instructionRef).raw}</pre>}<p>{t('Analysis completion is not a test PASS.')}</p></details>{activation.status==='ai-review'&&execution.status==='running'&&<button className="fs-button" disabled={disabled||busy||ai.status==='generating'||!ai.historyReady} onClick={()=>void run()}>{t('Run graph AI')}</button>}{busy&&<button className="fs-button" onClick={()=>ai.stop()}>{t('Stop')}</button>}{activation.analysisId&&<button className="fs-button" disabled={reviewDisabled||busy||!ai.historyReady} onClick={open}>{t('Open AI analysis')}</button>}{activation.analysisId&&plan.completion==='verified-fix'&&<GraphFixReview execution={execution} activation={activation} disabled={disabled||busy} reviewDisabled={reviewDisabled||busy} onOverview={onOverview}/ >}{activation.reason&&<span>{activation.reason}</span>}{error&&<span role="status">{error}</span>}</div>;
}
