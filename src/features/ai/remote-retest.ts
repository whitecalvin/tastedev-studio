import type {FixService} from './fix-service.ts';
import type {WorkspaceFileService} from '../filesystem/file-service.ts';
import type {ProtocolState} from '../protocol/domain.ts';
import type {CoreSnapshot,Job} from '../core/domain.ts';
import type {CreateJob} from '../core/service.ts';
import type {ProjectSnapshot} from './project-snapshot.ts';
import type {WorkspaceSnapshot} from './snapshot.ts';
import {frameworkGameSnapshot} from '../frameworks/source.ts';
import {buildProjectSnapshot} from './project-snapshot.ts';
import {buildSnapshot} from './snapshot.ts';
import {resolveTestPlan} from '../protocol/resolver.ts';
import {planPayload} from '../core/test-plan.ts';
export interface RetestCore {createJob(project:string,input:CreateJob):Job|Promise<Job>;dispatch(project?:string,jobId?:string):unknown;snapshot(project:string):CoreSnapshot}
/** Existing SourceProvider -> Protocol -> Core Queue/Matcher -> Agent pipeline, shared by AI fixes and integrations. */
export async function queueApprovedFixRetest(input:{projectId:string;attemptId:string;testName:string;baseRevision:string;fixes:FixService;files:WorkspaceFileService;protocol:ProtocolState;core:RetestCore;dirty:()=>boolean;framework?:boolean;upload?:(snapshot:ProjectSnapshot)=>Promise<ProjectSnapshot>}){
  if(input.protocol.status!=='Valid')throw Error('A valid Protocol definition is required.');if(input.dirty())throw Error('Save current edits before taking a snapshot.');
  const a=input.fixes.get(input.attemptId),definition=input.protocol.definition;
  const secrets=[...Object.values(definition.environment),...Object.values(definition.environments).flatMap(Object.values),...Object.values(definition.tasks).flatMap(t=>Object.values(t.env)),...Object.values(definition.tests).flatMap(t=>Object.values(t.env??{}))];
  const {snapshot:verified}=await (input.upload?(a.integration?.taskId&&input.framework?frameworkGameSnapshot:buildProjectSnapshot):buildSnapshot)(input.files,{projectId:input.projectId,proposalId:a.proposalId,attempt:a.attempt,baseRevision:input.baseRevision,changedFiles:a.patches.filter(p=>p.operation!=='delete').map(p=>p.path)},secrets);
  const snapshot:WorkspaceSnapshot=input.upload?await input.upload(verified as ProjectSnapshot):verified;
  if(input.dirty())throw Error('Save current edits before retesting.');await input.fixes.recordSnapshot(a.id,verified);
  const plan=resolveTestPlan(input.protocol,input.projectId,input.testName);if(snapshot.schemaVersion===2)plan.requirements={...plan.requirements,sourceSnapshot:2};const hadSource=plan.steps.some(s=>s.stage==='source');plan.steps=plan.steps.filter(s=>s.stage!=='source');if(!hadSource)plan.steps=plan.steps.map(s=>s.stage==='healthcheck'||s.executable==='internal-stop-services'?s:{...s,cwd:s.cwd==='.'?'source':`source/${s.cwd}`});
  plan.steps.unshift({name:'Workspace snapshot',stage:'source',executable:'snapshot',args:[],cwd:'.',source:{provider:'snapshot',repository:'snapshot:'+snapshot.snapshotId,revision:snapshot.baseRevision,snapshot},timeoutMs:120000});
  const approval=await input.fixes.approveExecution(a.id,'remote-test',input.testName,plan);await input.fixes.beginApprovedRetest(a.id,approval.id,plan);
  const job=await input.core.createJob(input.projectId,{idempotencyKey:a.id,name:`Fix Attempt ${a.attempt}: ${input.testName}`,requirements:plan.requirements,payload:planPayload(plan),maxAttempts:1});input.fixes.setRetestJob(a.id,job.id);await input.fixes.flush();
  const dispatched=await input.core.dispatch(input.projectId,job.id),run=input.core.snapshot(input.projectId).runs.find(r=>r.jobId===job.id);if(run)input.fixes.linkRetest(a.id,run.id);await input.fixes.flush();return{job,run,dispatched};
}
