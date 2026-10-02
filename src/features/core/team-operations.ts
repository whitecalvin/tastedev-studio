import type {SourceRevision} from './test-plan.ts';
export interface TeamManagedUser {id:string;role:'Owner'|'Admin'|'Developer'|'Viewer';projects:string[];disabled?:boolean;etag:string}
export interface TeamManagedSession {id:string;userId:string;expiresAt:string;revokedAt?:string;current:boolean;etag:string}
export interface TeamManagement {users:TeamManagedUser[];sessions:TeamManagedSession[];projects:string[]}
export interface RunLink {id:string;projectId:string;runId:string;kind:'issue'|'pull-request';url:string;revision?:SourceRevision;createdAt:string;createdBy?:string}
export interface OperationsReport {from:string;to:string;sampleCount:number;total:number;limited:boolean;passed:number;failed:number;passRate:number|null;meanElapsedMs:number|null;days:{day:string;total:number;passed:number;failed:number}[];agents:{id:string;name:string;status:string}[];queue:{queued:number;active:number};approvals:{id:string;proposalId:string;runId?:string;status:string;timestamp:string;files:string[]}[];links:RunLink[];agentIssues?:{runId:string;agentId:string;classification:string;timestamp:string}[]}
