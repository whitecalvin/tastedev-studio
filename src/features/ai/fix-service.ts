import type { WorkspaceFileService } from '../filesystem/file-service.ts';
import type { Documents } from '../editor/documents.ts';
import type { AnalysisRecord } from './domain.ts';
import type {WorkspaceSnapshot} from './snapshot.ts';
import {validateImpactPlan,type ValidationImpactPlan} from './validation-impact.ts';
import { aiPath, uuid, args } from './security.ts';

export type FixStatus = 'proposed'|'approved'|'applied'|'validating'|'retesting'|'passed'|'failed'|'reverted'|'cancelled'|'rejected'|'recovery-required';
export class FixError extends Error { readonly code:string;constructor(code:string){super(code);this.code=code;this.name='FixError';} }
export async function contentHash(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
export interface Edit { start:number; remove:string; insert:string }
export interface FilePatch { path:string; baseHash:string; resultHash:string; base:string; result:string; edits:Edit[] }
export interface PatchJournal {operation:'apply'|'revert';startedAt:string;completedAt?:string;files:{path:string;beforeHash:string;afterHash:string}[]}
export interface ExecutionApproval {id:string;proposalId:string;kind:'local-task'|'remote-test';name:string;definitionHash:string;timestamp:string}
export interface FixEvent {id:string;status:FixStatus;phase:'proposal'|'approval'|'patch'|'validation'|'retest'|'recovery'|'result';timestamp:string}
export type FixSnapshot=Omit<WorkspaceSnapshot,'files'> & {files:{path:string;checksum:string;encoding?:'utf8'|'base64';size?:number}[]};
export interface FixAttempt {validationPlans?:ValidationImpactPlan[];id:string;projectId:string;runId?:string;originRunId?:string;analysisId:string;proposalId:string;attempt:number;status:FixStatus;createdAt:string;patches:FilePatch[];approval?:{proposalId:string;files:string[];changeHash:string;timestamp:string};journal?:PatchJournal;executionApprovals?:ExecutionApproval[];snapshot?:FixSnapshot;events?:FixEvent[];error?:string;retestJobId?:string;retestRunId?:string;validation?:{name:string;status:string;durationMs:number}[]}
export const fixTools = [{name:'apply_patch',permission:'write',approval:'proposal-and-content'}, {name:'validation_task',permission:'validate',approval:'protocol-task'}, {name:'remote_retest',permission:'validate',approval:'protocol-test'}] as const;
export function structuredEdit(base:string,result:string):Edit[]{let start=0;while(start<base.length&&start<result.length&&base[start]===result[start])start++;let end=0;while(end<base.length-start&&end<result.length-start&&base[base.length-end-1]===result[result.length-end-1])end++;return base===result?[]:[{start,remove:base.slice(start,base.length-end),insert:result.slice(start,result.length-end)}];}
export function applyEdits(base:string,edits:Edit[]){let value=base;let previous=base.length+1;for(const e of [...edits].sort((a,b)=>b.start-a.start)){if(!Number.isSafeInteger(e.start)||e.start<0||e.start+e.remove.length>previous||value.slice(e.start,e.start+e.remove.length)!==e.remove)throw new FixError('INVALID_PATCH');value=value.slice(0,e.start)+e.insert+value.slice(e.start+e.remove.length);previous=e.start;}return value;}
export interface FixPersistence {save(attempt:FixAttempt):Promise<void>}
/** The model proposes data; only an explicitly approved immutable attempt can write. */
export class FixService {
 readonly history:FixAttempt[]=[];private busy=false;private persistence?:FixPersistence;private saves:Promise<void>=Promise.resolve();private persistenceFailed=false;
 readonly projectId:string;readonly files:Pick<WorkspaceFileService,'read'|'write'>;readonly documents?:Documents;private attemptLimit:number;
 get maximumAttempts(){return this.attemptLimit;}
 setMaximumAttempts(value:number){if(this.busy)throw new FixError('BUSY');if(!Number.isInteger(value)||value<1||value>10)throw new FixError('INVALID_LIMIT');this.attemptLimit=value;}
 constructor(projectId:string,files:Pick<WorkspaceFileService,'read'|'write'>,documents?:Documents,maximumAttempts=3){this.projectId=projectId;this.files=files;this.documents=documents;this.attemptLimit=maximumAttempts;uuid(projectId);if(!Number.isInteger(maximumAttempts)||maximumAttempts<1||maximumAttempts>10)throw new FixError('INVALID_LIMIT');}
 setPersistence(persistence:FixPersistence|undefined){this.persistence=persistence;this.persistenceFailed=false;}
 restore(history:FixAttempt[]){if(this.busy)throw new FixError('BUSY');if(history.some(a=>a.projectId!==this.projectId))throw new FixError('PROJECT_BOUNDARY');this.history.splice(0,this.history.length,...structuredClone(history));}
 private changed(a:FixAttempt){
  const last=a.events?.at(-1);if(!last||last.status!==a.status){const phase:FixEvent['phase']=a.status==='proposed'?'proposal':['approved','rejected'].includes(a.status)?'approval':a.status==='validating'||last?.status==='validating'?'validation':a.status==='retesting'||last?.status==='retesting'?'retest':a.status==='recovery-required'?'recovery':['applied','reverted'].includes(a.status)?'patch':'result';(a.events??=[]).push({id:crypto.randomUUID(),status:a.status,phase,timestamp:new Date().toISOString()});}
  const value=structuredClone(a),p=this.persistence;if(p)this.saves=this.saves.then(async()=>{if(this.persistenceFailed)return;await p.save(value);}).catch(()=>{this.persistenceFailed=true;});
 }
 async flush(){await this.saves;if(this.persistenceFailed)throw new FixError('PERSISTENCE_FAILED');}
 private own(id:string){const a=this.history.find(a=>a.id===id);if(!a||a.projectId!==this.projectId)throw new FixError('PROJECT_BOUNDARY');return a;}
 private dirty(path:string){return this.documents?.snapshot().openEditors.some(d=>d.path===path&&d.content!==d.savedContent);}
 async propose(record:AnalysisRecord,indices=record.result.proposal.map((_,i)=>i)){
  if(record.projectId!==this.projectId)throw new FixError('PROJECT_BOUNDARY');const originRunId=this.history.find(a=>a.retestRunId===record.runId)?.originRunId??record.runId;const attempt=this.history.filter(a=>a.originRunId===originRunId).length+1;if(attempt>this.maximumAttempts)throw new FixError('RETRY_LIMIT');
  if(!indices.length||new Set(indices).size!==indices.length)throw new FixError('INVALID_PATCH');const patches:FilePatch[]=[];
  for(const i of indices){const p=record.result.proposal[i];if(!p)throw new FixError('INVALID_PATCH');const path=aiPath(p.path),base=record.originals[path];if(typeof base!=='string'||base.includes('[redacted]')||p.proposed.includes('[redacted]')||patches.some(p=>p.path===path))throw new FixError('REDACTED_OR_DUPLICATE_PATCH');const edits=structuredEdit(base,p.proposed);if(!edits.length||applyEdits(base,edits)!==p.proposed)throw new FixError('INVALID_PATCH');patches.push({path,base,result:p.proposed,baseHash:await contentHash(base),resultHash:await contentHash(p.proposed),edits});}
  const a:FixAttempt={id:crypto.randomUUID(),projectId:this.projectId,runId:record.runId,originRunId,analysisId:record.id,proposalId:crypto.randomUUID(),attempt,status:'proposed',createdAt:new Date().toISOString(),patches};this.history.push(a);this.changed(a);await this.flush();return structuredClone(a);
 }
 async approve(id:string,files:string[]){const a=this.own(id);if(a.status!=='proposed'||files.length!==a.patches.length||new Set(files).size!==files.length||files.some(p=>!a.patches.some(f=>f.path===p)))throw new FixError('APPROVAL_SCOPE');a.approval={proposalId:a.proposalId,files:[...files],changeHash:await contentHash(JSON.stringify(a.patches)),timestamp:new Date().toISOString()};a.status='approved';this.changed(a);await this.flush();}
 reject(id:string){const a=this.own(id);if(a.status!=='proposed')throw new FixError('INVALID_STATE');a.status='rejected';this.changed(a);}
 cancel(id:string){const a=this.own(id);if(!['proposed','approved'].includes(a.status))throw new FixError('INVALID_STATE');a.status='cancelled';this.changed(a);}
 private async preflight(a:FixAttempt,reverse=false){for(const p of a.patches){aiPath(p.path);if(this.dirty(p.path))throw new FixError('DIRTY_EDITOR');const file=await this.files.read(p.path);if(file.content!==(reverse?p.result:p.base)||await contentHash(file.content)!==(reverse?p.resultHash:p.baseHash))throw new FixError('PATCH_CONFLICT');}}
 private async sync(a:FixAttempt){for(const p of a.patches){const d=this.documents?.snapshot().openEditors.find(d=>d.path===p.path);if(d)await this.documents!.reload(d.id);}}
 private async journal(a:FixAttempt,operation:'apply'|'revert'){
  a.journal={operation,startedAt:new Date().toISOString(),files:a.patches.map(p=>({path:p.path,beforeHash:p.baseHash,afterHash:p.resultHash}))};
  a.status='recovery-required';this.changed(a);await this.flush();
 }
 private completeJournal(a:FixAttempt){if(a.journal)a.journal.completedAt=new Date().toISOString();}
 /** Reconcile durable intent with disk; never infer success from a saved status. */
 async recoverInterrupted(id:string){
  await this.flush();if(this.busy)throw new FixError('BUSY');const a=this.own(id);
  if(!a.journal||a.journal.completedAt)return this.get(id);
  this.busy=true;
  try{
   if(a.approval?.proposalId!==a.proposalId||a.approval.changeHash!==await contentHash(JSON.stringify(a.patches))||a.patches.some(p=>!a.approval!.files.includes(p.path)))throw new FixError('APPROVAL_REQUIRED');
   const states=await Promise.all(a.patches.map(async p=>{
    if(this.dirty(p.path))throw new FixError('DIRTY_EDITOR');
    const hash=await contentHash((await this.files.read(p.path)).content);
    if(hash!==p.baseHash&&hash!==p.resultHash)throw new FixError('PATCH_CONFLICT');
    return hash===p.resultHash;
   }));
   if(a.journal.operation==='apply'&&states.every(Boolean)){a.status='applied';}
   else{
    // A partial apply compensates only exact AI results. An interrupted Revert
    // finishes the already-approved restoration. Expected content guards races.
    for(let i=a.patches.length-1;i>=0;i--){if(states[i]){const p=a.patches[i];if(this.dirty(p.path))throw new FixError('DIRTY_EDITOR');await this.files.write(p.path,p.base,p.result);if(await contentHash((await this.files.read(p.path)).content)!==p.baseHash)throw new FixError('WRITE_VERIFY_FAILED');}}
    a.status=a.journal.operation==='revert'?'reverted':states.some(Boolean)?'failed':'approved';
   }
   await this.sync(a);delete a.error;this.completeJournal(a);this.changed(a);await this.flush();return this.get(id);
  }catch(error){a.status='recovery-required';a.error=error instanceof Error?error.message:'RECOVERY_FAILED';this.changed(a);await this.flush();throw error;}finally{this.busy=false;}
 }
 async apply(id:string){await this.flush();if(this.busy)throw new FixError('BUSY');const a=this.own(id),written:FilePatch[]=[];this.busy=true;try{
  if(a.status!=='approved'||a.approval?.proposalId!==a.proposalId||a.approval.changeHash!==await contentHash(JSON.stringify(a.patches))||a.patches.some(p=>!a.approval!.files.includes(p.path)))throw new FixError('APPROVAL_REQUIRED');await this.preflight(a);await this.journal(a,'apply');
  for(const p of a.patches){if(this.dirty(p.path))throw new FixError('DIRTY_EDITOR');const result=applyEdits(p.base,p.edits);if(await contentHash(result)!==p.resultHash)throw new FixError('INVALID_PATCH');await this.files.write(p.path,result,p.base);written.push(p);if((await this.files.read(p.path)).content!==result)throw new FixError('WRITE_VERIFY_FAILED');}a.status='applied';delete a.error;this.completeJournal(a);await this.sync(a);this.changed(a);await this.flush();
 }catch(error){let recovery=false;for(const p of written.reverse()){try{if(this.dirty(p.path))throw new FixError('DIRTY_EDITOR');await this.files.write(p.path,p.base,p.result);}catch{recovery=true;}}a.error=error instanceof Error?error.message:'PATCH_FAILED';if(written.length){a.status=recovery?'recovery-required':'failed';if(!recovery)this.completeJournal(a);try{await this.sync(a);}catch{a.status='recovery-required';}if(a.status==='recovery-required'&&a.journal)delete a.journal.completedAt;}this.changed(a);throw error;}finally{this.busy=false;}}
 async revert(id:string){await this.flush();if(this.busy)throw new FixError('BUSY');const a=this.own(id);if(!['applied','passed','failed','cancelled'].includes(a.status))throw new FixError('INVALID_STATE');this.busy=true;const previousStatus=a.status,restored:FilePatch[]=[];try{await this.preflight(a,true);await this.journal(a,'revert');for(const p of a.patches){if(this.dirty(p.path))throw new FixError('DIRTY_EDITOR');await this.files.write(p.path,p.base,p.result);restored.push(p);}a.status='reverted';this.completeJournal(a);await this.sync(a);this.changed(a);await this.flush();}catch(error){a.status=previousStatus;for(const p of restored.reverse()){try{await this.files.write(p.path,p.result,p.base);}catch{a.status='recovery-required';}}try{await this.sync(a);}catch{a.status='recovery-required';}if(a.status==='recovery-required'&&a.journal)delete a.journal.completedAt;else this.completeJournal(a);this.changed(a);throw error;}finally{this.busy=false;}}
 async execute(name:string,input:unknown){if(name!=='apply_patch')throw new FixError('TOOL_UNAVAILABLE');const a=args(input,['projectId','attemptId']);if(a.projectId!==this.projectId||typeof a.attemptId!=='string')throw new FixError('PROJECT_BOUNDARY');return this.apply(a.attemptId);}
 get(id:string){return structuredClone(this.own(id));}
 async approveExecution(id:string,kind:ExecutionApproval['kind'],name:string,definition:unknown){
  const a=this.own(id);if(a.status!=='applied'||!a.approval||!['local-task','remote-test'].includes(kind)||typeof name!=='string'||!name.trim()||name.length>200||!definition||typeof definition!=='object'||Array.isArray(definition))throw new FixError('VALIDATION_APPROVAL_REQUIRED');
  const approval:ExecutionApproval={id:crypto.randomUUID(),proposalId:a.proposalId,kind,name,definitionHash:await contentHash(JSON.stringify(definition)),timestamp:new Date().toISOString()};
  (a.executionApprovals??=[]).push(approval);this.changed(a);await this.flush();return structuredClone(approval);
 }
 private async approvedExecution(a:FixAttempt,approvalId:string,kind:ExecutionApproval['kind'],definition:unknown){const approval=a.executionApprovals?.find(v=>v.id===approvalId);if(!approval||approval.proposalId!==a.proposalId||approval.kind!==kind||approval.definitionHash!==await contentHash(JSON.stringify(definition)))throw new FixError('VALIDATION_APPROVAL_REQUIRED');}
 async beginApprovedValidation(id:string,approvalId:string,definition:unknown){const a=this.own(id);await this.approvedExecution(a,approvalId,'local-task',definition);this.beginValidation(id);await this.flush();}
 async recordValidationPlan(id:string,plan:ValidationImpactPlan){const a=this.own(id);if(!['proposed','applied'].includes(a.status))throw new FixError('INVALID_STATE');validateImpactPlan(plan,this.projectId,a.proposalId,a.patches.map(p=>p.path));const previous=a.validationPlans?.at(-1);if(previous?.definitionHash===plan.definitionHash)return structuredClone(previous);if((a.validationPlans?.length??0)>=20)throw new FixError('VALIDATION_PLAN_LIMIT');(a.validationPlans??=[]).push(structuredClone(plan));this.changed(a);await this.flush();return structuredClone(plan);}
 async recordSnapshot(id:string,snapshot:WorkspaceSnapshot){
  const a=this.own(id);if(a.status!=='applied'||snapshot.projectId!==this.projectId||snapshot.proposalId!==a.proposalId||snapshot.attempt!==a.attempt)throw new FixError('PROJECT_BOUNDARY');
  await this.preflight(a,true);
  const {verifySnapshot}=await import('./snapshot.ts');await verifySnapshot(snapshot);
  if(a.patches.some(p=>snapshot.files.find(f=>f.path===p.path)?.checksum!==p.resultHash)||snapshot.changedFiles.length!==a.patches.length||snapshot.changedFiles.some(p=>!a.patches.some(f=>f.path===p)))throw new FixError('PATCH_CONFLICT');
  const value:FixSnapshot={...(snapshot.schemaVersion===2?{schemaVersion:2 as const}:{}),provider:'snapshot',snapshotId:snapshot.snapshotId,projectId:snapshot.projectId,proposalId:snapshot.proposalId,attempt:snapshot.attempt,baseRevision:snapshot.baseRevision,changedFiles:[...snapshot.changedFiles],checksum:snapshot.checksum,files:snapshot.files.map(({path,checksum,encoding,size})=>({path,checksum,...(snapshot.schemaVersion===2?{encoding,size}:{})}))};if(a.snapshot&&JSON.stringify(a.snapshot)!==JSON.stringify(value))throw new FixError('SNAPSHOT_IDENTITY_CONFLICT');a.snapshot=value;this.changed(a);await this.flush();
 }
 async beginApprovedRetest(id:string,approvalId:string,definition:unknown){const a=this.own(id);await this.approvedExecution(a,approvalId,'remote-test',definition);if(!a.snapshot)throw new FixError('INVALID_SNAPSHOT');this.beginRetest(id);await this.flush();}
 beginValidation(id:string){const a=this.own(id);if(a.status!=='applied')throw new FixError('INVALID_STATE');a.status='validating';this.changed(a);}
 validationResult(id:string,name:string,status:string,durationMs:number){const a=this.own(id);if(a.status!=='validating')throw new FixError('INVALID_STATE');(a.validation??=[]).push({name,status,durationMs});a.status=status==='passed'?'applied':'failed';this.changed(a);}
 beginRetest(id:string,jobId?:string){const a=this.own(id);if(a.status!=='applied')throw new FixError('INVALID_STATE');a.status='retesting';a.retestJobId=jobId;this.changed(a);}
 setRetestJob(id:string,jobId:string){const a=this.own(id);if(a.status!=='retesting')throw new FixError('INVALID_STATE');uuid(jobId);a.retestJobId=jobId;this.changed(a);}
 linkRetest(id:string,runId:string){const a=this.own(id);if(a.status!=='retesting')throw new FixError('INVALID_STATE');uuid(runId);a.retestRunId=runId;this.changed(a);}
 retestResult(id:string,status:'passed'|'failed'|'cancelled'|'timeout'){const a=this.own(id);if(a.status!=='retesting')throw new FixError('INVALID_STATE');a.status=status==='passed'?'passed':status==='cancelled'?'cancelled':'failed';this.changed(a);}
}
