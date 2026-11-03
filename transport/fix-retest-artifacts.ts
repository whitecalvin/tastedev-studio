import {createHash} from 'node:crypto';
import type {HistoryStore} from './history.ts';
import type {CoreService,CreateJob} from '../src/features/core/service.ts';
import type {FixAttempt} from '../src/features/ai/fix-service.ts';
import type {BuildArtifact,BuildArtifactOrigin} from '../src/features/orchestration/build-artifact.ts';
import {validatePayload} from '../src/features/core/matcher.ts';
import {activeRun} from '../src/features/core/domain.ts';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Server-owned authority: a client-selected job key alone never grants artifact access. */
export function fixRetestArtifacts(core:CoreService,history:HistoryStore,now=Date.now,persistence?:{load:()=>string[];save:(values:string[])=>void}){
 const closed=new Set(persistence?.load()??[]);
 function reviewed(projectId:string,input:CreateJob){
  const id=input.idempotencyKey?.replace(/^fix:/,'');
  if(closed.has(projectId+':'+id))throw Error('Fix submission was closed.');
  const a=id?history.get(projectId,'attempt',id)?.value as FixAttempt|undefined:undefined;
  if(!a||a.projectId!==projectId||a.status!=='retesting'||!a.approval||a.approval.proposalId!==a.proposalId||a.approval.changeHash!==hash(a.directories?.length?{patches:a.patches,directories:a.directories.map(d=>d.path)}:a.patches)||a.patches.some(p=>!a.approval!.files.includes(p.path)))throw Error('Reviewed fix retest required.');
  const payload=validatePayload(input.payload),plan=payload.testPlan,snapshot=a.snapshot;
  const approval=a.executionApprovals?.find(v=>v.kind==='remote-test'&&v.proposalId===a.proposalId&&v.name===plan?.testName&&v.definitionHash===hash(plan));
  const sources=payload.steps.filter(s=>s.source?.provider==='snapshot');
  if(!approval||!snapshot||snapshot.schemaVersion!==2||sources.length!==1)throw Error('Reviewed fix retest required.');
  const source=sources[0].source!;if(source.provider!=='snapshot')throw Error('Snapshot required.');
  const s=source.snapshot;
  if(s.schemaVersion!==2||s.projectId!==projectId||s.proposalId!==a.proposalId||s.attempt!==a.attempt||s.snapshotId!==snapshot.snapshotId||s.checksum!==snapshot.checksum||s.baseRevision!==snapshot.baseRevision||a.patches.some(p=>p.operation==='delete'?snapshot.files.some(f=>f.path===p.path):snapshot.files.find(f=>f.path===p.path)?.checksum!==p.resultHash))throw Error('Fix Snapshot scope changed.');
  return {a,approval,payload,snapshot};
 }
 function allowed(project:string,input:CreateJob){try{reviewed(project,input);return true;}catch{return false;}}
 async function recover(project:string,id:string){
  const row=history.get(project,'attempt',id),a=row?.value as FixAttempt|undefined;
  if(!row||!a||a.projectId!==project)throw Error('Fix attempt not found.');
  const job=core.repository.read().jobs.find(j=>j.projectId===project&&(j.idempotencyKey===id||j.idempotencyKey===`fix:${id}`||j.id===a.retestJobId));
  if(job||a.status!=='retesting')return {job:job??null,row:{version:row.version,value:a}};
  // Close admission synchronously before asynchronous CAS validation. A delayed
  // createJob cannot enter the queue after recovery has observed no job.
  const key=project+':'+id,next=[...closed,key];persistence?.save(next);closed.add(key);
  a.status='failed';a.error='Retest submission did not reach the Core queue.';
  (a.events??=[]).push({id:crypto.randomUUID(),status:'failed',phase:'recovery',timestamp:new Date(now()).toISOString()});
  const version=await history.put(project,'attempt',id,row.version,a);
  return {job:null,row:{version,value:a}};
 }
 function context(jobId:string){
  const job=core.repository.readEntity?.('jobs',jobId)??core.repository.read().jobs.find(j=>j.id===jobId);
  if(!job)throw Error('Fix retest job missing.');
  const review=reviewed(job.projectId,job),state=core.snapshot(job.projectId),run=state.runs.find(r=>r.jobId===job.id&&activeRun(r));
  if(!run||job.cancellationRequestedAt||review.a.retestJobId&&review.a.retestJobId!==job.id)throw Error('Active fix retest required.');
  return {...review,job,run,state};
 }
 function buildArtifactOrigin(jobId:string,stepId:string){
  const c=context(jobId),step=c.state.steps.find(s=>s.id===stepId&&s.runId===c.run.id),definition=step?c.payload.steps[step.order]:undefined,declaration=definition?.buildArtifacts;
  if(!step||step.status!=='running'||!declaration)throw Error('Active declared fix step required.');
  const deadline=Date.parse(step.startedAt??'')+(definition.timeoutMs??60000);
  if(!Number.isFinite(deadline)||now()>=deadline)throw Error('Fix artifact deadline reached.');
  return {deadline,declaration,origin:{projectId:c.job.projectId,executionId:c.a.id,graphRevision:c.a.attempt,producerActivationId:c.approval.id,producerNodeId:c.payload.testPlan!.testName,producerRunId:c.run.id,producerStepId:step.id,snapshotId:c.snapshot.snapshotId,sourceChecksum:c.snapshot.checksum} satisfies BuildArtifactOrigin};
 }
 function buildArtifactProducer(jobId:string,stepId:string,fromTask:string,name:string){
  const c=context(jobId),current=buildArtifactOrigin(jobId,stepId);
  if(!current.declaration.inputs.some(i=>i.fromTask===fromTask&&i.name===name))throw Error('Undeclared fix artifact input.');
  const consumer=c.state.steps.find(s=>s.id===stepId)!,producers=c.state.steps.filter(s=>s.runId===c.run.id&&s.order<consumer.order&&s.status==='passed'&&(c.payload.steps[s.order].taskReference??c.payload.steps[s.order].name)===fromTask&&c.payload.steps[s.order].buildArtifacts?.outputs.some(o=>o.name===name));
  if(producers.length!==1)throw Error('Verified fix artifact producer required.');
  return {...current.origin,producerStepId:producers[0].id};
 }
 function recordBuildArtifactOutputs(jobId:string,stepId:string,outputs:BuildArtifact[]){
  const {origin,declaration}=buildArtifactOrigin(jobId,stepId);
  if(outputs.length!==declaration.outputs.length||new Set(outputs.map(o=>o.name)).size!==outputs.length||outputs.some(o=>Object.entries(origin).some(([k,v])=>o[k as keyof BuildArtifact]!==v)||!declaration.outputs.some(d=>d.name===o.name&&d.path===o.path&&d.executable===o.executable)))throw Error('Fix output receipt scope mismatch.');
 }
 return {allowed,recover,buildArtifactOrigin,buildArtifactProducer,recordBuildArtifactOutputs};
}
