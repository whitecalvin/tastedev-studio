import type {Job,Run} from '../core/domain.ts';
import type {GraphExecution,GraphOverview} from './execution.ts';

export interface RecoveryAuditRow {
 nodeId:string;activationId:string;attempt:number;status:string;
 kind:'run'|'approval'|'ai'|'not-started';state:'retained'|'pending'|'reconcile'|'blocked'|'failed';
 jobId?:string;runId?:string;agentId?:string;reason?:string;source?:{snapshotId:string;checksum:string};
}
export interface RecoveryAudit {
 projectId:string;executionId:string;revision:number;checksum:string;checkedAt:string;
 ready:boolean;rows:RecoveryAuditRow[];executionAuthorized:false;
}
/** Checks persisted identities, not process liveness. Each completed Run is
 * compared with its own immutable Job Source, including pre-adoption results. */
export function auditRecovery(execution:GraphExecution,read:{job:(id:string)=>Job|undefined;run:(id:string)=>Run|undefined},now=new Date().toISOString()):RecoveryAudit{
 const latest=new Map<string,GraphExecution['activations'][number]>();
 const knownSources=new Set<string>();
 const currentSource=execution.definition.source;if(currentSource)knownSources.add(currentSource.snapshotId+':'+currentSource.checksum);
 for(const adoption of execution.sourceAdoptions??[]){knownSources.add(adoption.fromSnapshotId+':'+adoption.fromChecksum);knownSources.add(adoption.toSnapshotId+':'+adoption.checksum);}
 for(const a of execution.activations){const before=latest.get(a.nodeId);if(!before||a.attempt>=before.attempt)latest.set(a.nodeId,a);}
 const rows:RecoveryAuditRow[]=[];
 for(const a of latest.values()){
  const node=execution.definition.graph.nodes.find(n=>n.id===a.nodeId);
  const aiTask=!!execution.definition.aiTasks&&Object.hasOwn(execution.definition.aiTasks,a.nodeId);
  const row:RecoveryAuditRow={nodeId:a.nodeId,activationId:a.id,attempt:a.attempt,status:a.status,kind:node?.kind==='approval'?'approval':aiTask?'ai':a.jobId?'run':'not-started',state:a.status==='passed'?'retained':['failed','cancelled'].includes(a.status)?'failed':'pending',jobId:a.jobId,runId:a.runId,agentId:a.agentId};
  const block=(reason:string)=>{row.state='blocked';row.reason=reason;};
  if(!node)block('Saved execution identity is inconsistent.');
  else if(row.kind==='approval'){
   if(a.status==='passed'&&(!a.approvedBy||!a.approvedAt))block('Saved approval evidence is unavailable.');
  }else if(row.kind!=='ai'){
   if(!a.jobId){if(a.status==='passed'||a.runId)block('Saved run identity is inconsistent.');}
   else{
    const job=read.job(a.jobId),run=a.runId?read.run(a.runId):undefined;
    if(!job||job.projectId!==execution.projectId||!Array.isArray(job.payload?.steps)||job.payload.steps.some(s=>!s||typeof s!=='object')||a.runId&&(!run||run.projectId!==execution.projectId||run.jobId!==job.id||run.agentId!==a.agentId))block('Saved run identity is inconsistent.');
    else{
     const captured=job.payload.steps.find(s=>s.source?.provider==='snapshot')?.source;
     const source=captured?.provider==='snapshot'?captured.snapshot:undefined;
     const validSource=!captured||!!source&&typeof source.snapshotId==='string'&&source.snapshotId.length<=100&&/^[a-f0-9]{64}$/.test(source.checksum)&&knownSources.has(source.snapshotId+':'+source.checksum);
     if(source&&validSource)row.source={snapshotId:source.snapshotId,checksum:source.checksum};
     let contextValid=true;
     for(const step of job.payload.steps){const raw=step.env?.TASTEDEV_GRAPH_CONTEXT;if(!raw)continue;try{const c=JSON.parse(raw);if(c.executionId!==execution.id||c.activationId!==a.id||c.nodeId!==a.nodeId||c.attempt!==a.attempt||c.revision!==execution.revision||c.snapshotId!==source?.snapshotId||c.sourceChecksum!==source?.checksum)contextValid=false;}catch{contextValid=false;}}
     if(!validSource)block('Saved Source identity is inconsistent.');
     else if(!contextValid)block('Saved execution identity is inconsistent.');
     else if(a.status==='passed'){
      if(!run||run.status!=='passed'||run.exitCode!==0||!run.finishedAt)block('Saved successful Run evidence is unavailable.');
      else if(execution.definition.source&&!source||source&&(source.projectId!==execution.projectId||run.revision?.snapshotId!==source.snapshotId||run.revision?.commit!==source.checksum))block('Saved Source identity is inconsistent.');
     }else if(run&&['passed','failed','cancelled','timedout'].includes(run.status))row.state='reconcile';
    }
   }
  }
  rows.push(row);
 }
 return{projectId:execution.projectId,executionId:execution.id,revision:execution.revision,checksum:execution.checksum,checkedAt:now,ready:!rows.some(r=>r.state==='blocked'),rows,executionAuthorized:false};
}
export function recoveryReviewKey(session:number,execution:GraphOverview['executions'][number],nodeId:string){
 return JSON.stringify([session,execution.id,execution.revision,execution.checksum,execution.inputChecksum,execution.deadline,execution.source?.snapshotId,execution.source?.checksum,nodeId,execution.status,execution.activations.map(a=>[a.id,a.nodeId,a.attempt,a.status,a.jobId,a.runId,a.agentId,a.fixAttemptId])]);
}
