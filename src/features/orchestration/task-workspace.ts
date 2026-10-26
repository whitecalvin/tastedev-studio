import {nativeBridge,type NativeBridge} from '../runtime/native-hosts.ts';
import type {FolderConnection} from '../filesystem/contracts.ts';
export interface TaskWorkspaceBaseline {head:string;dirty:boolean;baseMode:'committed-head'}
export interface TaskWorkspace {taskId:string;projectId:string;baseRevision:string;state:'ready'|'incomplete'|'unavailable'|'archived';baseMode:'committed-head';path?:string;connection?:FolderConnection}
export interface TaskWorkspaceScope {projectId:string;workspaceId:string}
export interface TaskComparison {projectId:string;taskId:string;baseRevision:string;parentHead:string;fingerprint:string;files:{path:string;base:string|null;parent:string|null;modified:string|null;conflict:boolean;supported:boolean}[]}
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const sha=(v:unknown):v is string=>typeof v==='string'&&/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(v);
export const taskWorkspaceErrors:Record<string,string>={
  'worktree-identity':'Choose a valid work task identity.',
  'worktree-conflict':'The repository or task workspace changed. Review its baseline again.',
  'worktree-state':'Saved task workspace metadata is invalid. Existing files were preserved.',
  'worktree-file-mode':'This baseline contains unsupported links or submodules. No task workspace was checked out.',
  'worktree-path-length':'The managed workspace path is too long for Git. Choose a shorter application data location.',
  'worktree-limit':'Task workspace capacity reached. Existing workspaces were preserved.',
  'workspace-busy':'Another native workspace operation is active. Retry after it finishes.',
  'access':'Connect the original project folder before managing its task workspaces.',
};
export function taskWorkspace(value:unknown,project:string):TaskWorkspace {
  const v=value as TaskWorkspace;
  if(!v||!uuid(v.taskId)||v.projectId!==project||!sha(v.baseRevision)||v.baseMode!=='committed-head'||!['ready','incomplete','unavailable','archived'].includes(v.state))throw Error('Invalid task workspace response.');
  if(v.state==='ready'&&(!v.path||v.connection?.workspacePath!==v.path||!uuid(v.connection.id)||v.connection.permission!=='granted'))throw Error('Invalid task workspace connection.');
  return structuredClone(v);
}
/** Native host owns repository/path authorization. The caller never supplies a destination or shell. */
export class TaskWorkspaceHost {
  private bridge:NativeBridge;
  constructor(bridge:NativeBridge=nativeBridge){this.bridge=bridge;}
  private async call<T>(scope:TaskWorkspaceScope,operation:string,extra:Record<string,unknown>={}):Promise<T>{
    if(!uuid(scope.projectId)||!uuid(scope.workspaceId))throw Error('Choose a valid work task identity.');
    try{return await this.bridge.invoke<T>('task_worktree_action',{request:{...scope,operation,...extra}});}catch(e){const code=e&&typeof e==='object'&&'code'in e?String(e.code):'';throw Error(taskWorkspaceErrors[code]??'Task workspace operation failed. Existing files were preserved.');}
  }
  async baseline(scope:TaskWorkspaceScope){const v=await this.call<TaskWorkspaceBaseline>(scope,'baseline');if(!sha(v.head)||typeof v.dirty!=='boolean'||v.baseMode!=='committed-head')throw Error('Invalid task workspace baseline.');return v;}
  async list(scope:TaskWorkspaceScope){const v=await this.call<{workspaces:unknown[]}>(scope,'list');if(!Array.isArray(v.workspaces)||v.workspaces.length>100)throw Error('Invalid task workspace response.');const list=v.workspaces.map(v=>taskWorkspace(v,scope.projectId));if(new Set(list.map(v=>v.taskId)).size!==list.length)throw Error('Duplicate task workspace identity.');return list;}
  async compare(scope:TaskWorkspaceScope,taskId:string){if(!uuid(taskId))throw Error('Choose a valid work task identity.');const v=await this.call<TaskComparison>(scope,'compare',{taskId});if(v.projectId!==scope.projectId||v.taskId!==taskId||!sha(v.baseRevision)||!sha(v.parentHead)||!/^[a-f0-9]{64}$/.test(v.fingerprint)||!Array.isArray(v.files)||v.files.length>8||new Set(v.files.map(f=>f.path)).size!==v.files.length||v.files.some(f=>typeof f.path!=='string'||[f.base,f.parent,f.modified].some(s=>s!==null&&typeof s!=='string')||typeof f.conflict!=='boolean'||typeof f.supported!=='boolean'))throw Error('Invalid task comparison.');return v;}
  async create(scope:TaskWorkspaceScope,taskId:string,baseline:TaskWorkspaceBaseline,approved:boolean){if(!uuid(taskId)||!sha(baseline.head)||!approved)throw Error('Review and approve the committed baseline first.');return taskWorkspace(await this.call(scope,'create',{taskId,expectedHead:baseline.head,acknowledgeCommittedBase:true}),scope.projectId);}
  async open(scope:TaskWorkspaceScope,taskId:string,childProjectId:string){if(!uuid(taskId)||!uuid(childProjectId))throw Error('Choose a valid work task identity.');try{await this.bridge.invoke('task_worktree_open',{request:{...scope,operation:'inspect',taskId},childProjectId});}catch(e){const code=e&&typeof e==='object'&&'code'in e?String(e.code):'';throw Error(taskWorkspaceErrors[code]??'Task workspace could not be opened.');}}
  async archive(scope:TaskWorkspaceScope,taskId:string,restore=false){if(!uuid(taskId))throw Error('Choose a valid work task identity.');return taskWorkspace(await this.call(scope,restore?'restore':'archive',{taskId,acknowledgeCommittedBase:true}),scope.projectId);}
  async inspect(scope:TaskWorkspaceScope,taskId:string){if(!uuid(taskId))throw Error('Choose a valid work task identity.');return taskWorkspace(await this.call(scope,'inspect',{taskId}),scope.projectId);}
}
