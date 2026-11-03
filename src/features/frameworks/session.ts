export type FrameworkSessionStatus='prepared'|'running'|'waiting-question'|'waiting-approval'|'authentication-required'|'interrupted'|'cancelled'|'failed'|'needs-review';
export interface FrameworkScope {projectId:string;runId:string;agentId:string;workspaceId:string;sourceChecksum:string;configurationChecksum:string;manifest:string}
export interface FrameworkRequest {id:string;kind:'question'|'permission';payload:unknown;expiresAt:string;response?:unknown;resolvedAt?:string}
export interface FrameworkValidationAttempt {requestId:string;attempt:number;sourceChecksum:string;planHash:string;approvedAt:string;snapshotId?:string;snapshotChecksum?:string;contentChecksum?:string;jobId?:string;runId?:string}
export interface FrameworkSession {nativeTurnComplete?:boolean;validationAttempts?:FrameworkValidationAttempt[];resumedFrom?:string;resumeOrigin?:string;id:string;scope:FrameworkScope;nativeSessionId?:string;effectiveSourceChecksum?:string;status:FrameworkSessionStatus;createdAt:string;updatedAt:string;sequence:number;requests:FrameworkRequest[];events:{sequence:number;type:string;parentToolUseId?:string;value:unknown}[]}
export interface FrameworkResponse {sessionId:string;projectId:string;runId:string;workspaceId:string;requestId:string;configurationChecksum:string;value:unknown}
export function frameworkTurnCompleted(session:FrameworkSession){return session.nativeTurnComplete===true||Array.isArray(session.events)&&session.events.some(event=>event.type==='completed');}
export function resumableFrameworkSession(session:FrameworkSession){return !!session.nativeSessionId&&Array.isArray(session.events)&&!frameworkTurnCompleted(session)&&['interrupted','cancelled','failed','authentication-required'].includes(session.status);}
export function frameworkRunVerified(session:FrameworkSession,run:{id:string;projectId:string;agentId:string;status:string;revision?:{snapshotId?:string;contentChecksum?:string}}|undefined){
 if(!run||run.status!=='passed'||run.projectId!==session.scope.projectId||run.agentId!==session.scope.agentId)return false;
 if(run.id===session.scope.runId)return true;
 return !!session.effectiveSourceChecksum&&!!session.validationAttempts?.some(a=>a.runId===run.id&&a.sourceChecksum===session.effectiveSourceChecksum&&!!a.snapshotId&&a.snapshotId===run.revision?.snapshotId&&!!a.contentChecksum&&a.contentChecksum===run.revision?.contentChecksum);
}
