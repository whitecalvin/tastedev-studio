export type FrameworkSessionStatus='prepared'|'running'|'waiting-question'|'waiting-approval'|'authentication-required'|'interrupted'|'cancelled'|'failed'|'needs-review';
export interface FrameworkScope {projectId:string;runId:string;agentId:string;workspaceId:string;sourceChecksum:string;configurationChecksum:string;manifest:string}
export interface FrameworkRequest {id:string;kind:'question'|'permission';payload:unknown;expiresAt:string;response?:unknown;resolvedAt?:string}
export interface FrameworkSession {resumedFrom?:string;resumeOrigin?:string;id:string;scope:FrameworkScope;nativeSessionId?:string;effectiveSourceChecksum?:string;status:FrameworkSessionStatus;createdAt:string;updatedAt:string;sequence:number;requests:FrameworkRequest[];events:{sequence:number;type:string;parentToolUseId?:string;value:unknown}[]}
export interface FrameworkResponse {sessionId:string;projectId:string;runId:string;workspaceId:string;requestId:string;configurationChecksum:string;value:unknown}
