import type {TaskWorkspace} from './task-workspace.ts';
import type {FixAttempt} from '../ai/fix-service.ts';
import type {Run} from '../core/domain.ts';
export interface TaskWorkspaceRelation {taskId:string;workspace:string;baseline:string;proposalId?:string;snapshotId?:string;checksum?:string;runId?:string;status:string;verified:boolean}
/** Only current original-project Run evidence can verify integration. Child execution is a separate scope. */
export function taskWorkspaceRelations(projectId:string,rows:TaskWorkspace[],attempts:FixAttempt[],runs:Run[]):TaskWorkspaceRelation[]{
 return rows.filter(w=>w.projectId===projectId).map(w=>{const a=attempts.findLast(a=>a.projectId===projectId&&a.integration?.taskId===w.taskId),r=runs.find(r=>r.id===a?.retestRunId&&r.projectId===projectId),verified=w.state==='ready'&&a?.status==='passed'&&r?.status==='passed'&&!!a.snapshot&&r.revision?.commit===a.snapshot.checksum;
 return{taskId:w.taskId,workspace:w.state,baseline:w.baseRevision,proposalId:a?.proposalId,snapshotId:a?.snapshot?.snapshotId,checksum:a?.snapshot?.checksum,runId:r?.id,status:a?.status??'not-run',verified};});
}
