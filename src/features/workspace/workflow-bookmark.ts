import {coreEndpoint} from '../core/connection-profiles.ts';
export interface WorkflowBookmark {version:1;projectId:string;endpoint:string;path?:string;analysisId?:string;attemptId?:string;runId?:string}
const id=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f-]{36}$/i.test(value);
export const workflowKey=(projectId:string)=>'tastedev.studio.workflow.v1:'+projectId;
export function workflowBookmark(value:unknown,projectId:string,endpoint:string):WorkflowBookmark {
 if(!value||typeof value!=='object')throw Error('Saved workflow is unavailable.');
 const row=value as Record<string,unknown>;
 if(Object.keys(row).some(key=>!['version','projectId','endpoint','path','analysisId','attemptId','runId'].includes(key))||row.version!==1||!id(projectId)||row.projectId!==projectId||typeof row.endpoint!=='string'||coreEndpoint(row.endpoint)!==coreEndpoint(endpoint))throw Error('Saved workflow belongs to another project or Core.');
 const result:WorkflowBookmark={version:1,projectId,endpoint:coreEndpoint(endpoint)};
 for(const key of ['analysisId','attemptId','runId'] as const)if(row[key]!==undefined){if(!id(row[key]))throw Error('Invalid workflow identity.');result[key]=row[key];}
 if(row.path!==undefined){if(typeof row.path!=='string'||row.path.length>512||/^[\\/]|[:\x00-\x1f]/.test(row.path)||row.path.split(/[\\/]/).some(p=>!p||p==='.'||p==='..'))throw Error('Invalid workflow source path.');result.path=row.path;}
 return result;
}
export function resolveWorkflow<A extends {id:string;projectId:string},T extends {id:string;projectId:string;analysisId:string;retestRunId?:string}>(bookmark:WorkflowBookmark,analyses:A[],attempts:T[]){
 const analysis=bookmark.analysisId?analyses.find(a=>a.id===bookmark.analysisId&&a.projectId===bookmark.projectId):undefined;
 const attempt=bookmark.attemptId?attempts.find(a=>a.id===bookmark.attemptId&&a.projectId===bookmark.projectId):undefined;
 if(bookmark.analysisId&&!analysis||bookmark.attemptId&&(!attempt||attempt.analysisId!==analysis?.id)||attempt&&bookmark.runId&&attempt.retestRunId!==bookmark.runId)throw Error('Saved workflow history is unavailable.');
 return {analysis,attempt};
}
