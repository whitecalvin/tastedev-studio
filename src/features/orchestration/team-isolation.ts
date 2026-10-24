import type {FactoryTask} from './factory.ts';
import {pathContains} from './factory.ts';
import type {GraphOverview} from './execution.ts';
import type {FixAttempt} from '../ai/fix-service.ts';
import type {Run} from '../core/domain.ts';
export interface TeamIsolation {taskId:string;mode:'serialized-source-isolated-retest';baselineChecksum:string;paths:string[];executionId?:string;attempts:{id:string;proposalId:string;status:string;files:{path:string;baseHash:string;resultHash:string;approved:boolean}[];snapshotId?:string;snapshotChecksum?:string;runId?:string;runStatus?:string;sourceMatchesRun:boolean}[];issues:string[]}
/** Metadata only: file bodies and credential-bearing execution environments never enter this report. */
export function teamIsolation(task:FactoryTask,graph:GraphOverview,attempt:(id:string)=>FixAttempt|undefined,run:(id:string)=>Run|undefined):TeamIsolation {
  const executionId=task.attempts.at(-1)?.executionId,e=graph.executions.find(e=>e.id===executionId),issues:string[]=[];
  const result:TeamIsolation={taskId:task.contract.taskId,mode:'serialized-source-isolated-retest',baselineChecksum:task.contract.sourceChecksum,paths:[...task.contract.paths],executionId,attempts:[],issues};
  for(const id of new Set(e?.activations.flatMap(a=>a.fixAttemptId?[a.fixAttemptId]:[])??[])){
    const f=attempt(id);if(!f||f.projectId!==task.contract.projectId){issues.push('Fix attempt unavailable.');continue;}
    const r=f.retestRunId?run(f.retestRunId):undefined,matches=!!f.snapshot&&r?.projectId===task.contract.projectId&&r.revision?.commit===f.snapshot.checksum;
    if(!Array.isArray(f.patches))issues.push('Fix patch metadata unavailable.');
    const files=(f.patches??[]).map(p=>({path:p.path,baseHash:p.baseHash,resultHash:p.resultHash,approved:f.approval?.proposalId===f.proposalId&&f.approval.files.includes(p.path)}));
    if(files.some(p=>!task.contract.paths.some(scope=>pathContains(scope,p.path))))issues.push('Patch exceeds the reviewed contract scope.');
    if(['applied','validating','retesting','passed'].includes(f.status)&&files.some(p=>!p.approved))issues.push('Applied patch approval is unavailable.');
    if(r&&!matches)issues.push('Retest Source identity does not match the Snapshot.');
    result.attempts.push({id:f.id,proposalId:f.proposalId,status:f.status,files,snapshotId:f.snapshot?.snapshotId,snapshotChecksum:f.snapshot?.checksum,runId:f.retestRunId,runStatus:r?.status,sourceMatchesRun:matches});
  }
  return result;
}
