'use client';
import {coreAccess,accessFeedback,sessionExpiredMessage,type CoreAccess} from './access.ts';
import {coreEndpoint} from './connection-profiles.ts';
import {ArtifactDownloads} from './artifact-download.ts';
import {applySnapshotDelta} from './snapshot-delta.ts';
import {liveSnapshot} from './history-query.ts';
import type { Agent, Artifact, CoreSnapshot } from './domain';
import type { Project } from '../projects/types/project';
import type { CreateJob } from './service';
import { matchAgent } from './matcher.ts';
import {IssueError,type IssueErrorCode} from '../issues/domain.ts';
export interface RemoteLog { sequence:number;stream:'stdout'|'stderr';text:string;runStepId?:string }
const empty=():CoreSnapshot=>({agents:[],jobs:[],runs:[],steps:[],artifacts:[],events:[]});
export type ConnectionPhase='disabled'|'connecting'|'connected'|'recovering'|'unavailable'|'authentication'|'protocol-error'|'error';
export class RemoteCoreClient {
  enabled=false;connected=false;status='Not connected';logs:Record<string,RemoteLog[]>={};
  access:CoreAccess|null=null;phase:ConnectionPhase='disabled';lastError='';snapshotReceivedAt:string|null=null;
  private liveState=empty();private sequence=0;
  private state=empty();private version=0;private listeners=new Set<()=>void>();private ws:WebSocket|null=null;private timer:ReturnType<typeof setTimeout>|undefined;private retry=500;private token='';private endpoint='';private project:Project|null=null;
  private pending=new Map<string,{resolve:(value:unknown)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  private downloads=new ArtifactDownloads();private historical=new Map<string,CoreSnapshot>();
  get connectionKey(){return this.endpoint+'\0'+(this.project?.id??'');}
  readonly repository={subscribe:(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};},revision:()=>this.version,read:()=>this.state};
  private changed(){this.version++;for(const fn of this.listeners)fn();}
  private retainLogs(incoming:Record<string,RemoteLog[]>){const rows=new Map(Object.entries(this.logs));for(const [id,chunks] of Object.entries(incoming)){rows.delete(id);rows.set(id,chunks.slice(-500));}let bytes=0;const result:Record<string,RemoteLog[]>={};for(const [id,chunks] of [...rows].reverse().slice(0,100)){const size=chunks.reduce((n,row)=>n+new TextEncoder().encode(row.text).length,0);if(bytes+size>1048576)continue;bytes+=size;result[id]=chunks;}this.logs=result;}
  private mergeHistory(state:CoreSnapshot){const merge=<T extends {id:string}>(rows:T[],extra:T[])=>[...rows,...extra.filter(row=>!rows.some(existing=>existing.id===row.id))];for(const cached of this.historical.values())if(!state.runs.some(r=>r.id===cached.runs[0].id)){state.runs=merge(state.runs,cached.runs);state.jobs=merge(state.jobs,cached.jobs);state.steps=merge(state.steps,cached.steps);state.artifacts=merge(state.artifacts,cached.artifacts);}return state;}
  snapshot(projectId:string){const s=this.state;const runs=s.runs.filter(r=>r.projectId===projectId);const ids=new Set(runs.map(r=>r.id));return {...s,jobs:s.jobs.filter(j=>j.projectId===projectId),runs,steps:s.steps.filter(s=>ids.has(s.runId)),artifacts:s.artifacts.filter(a=>ids.has(a.runId)),events:s.events.filter(e=>!e.projectId||e.projectId===projectId)};}
  connect(endpoint:string,token:string,project:Project){const url=new URL(coreEndpoint(endpoint));if(token.length<16||token.length>512||/[\r\n\0]/.test(token))throw new Error('Enter the configured Studio token.');this.disconnect();this.enabled=true;this.endpoint=url.href;this.token=token;this.project=project;this.retry=500;this.open();}
  reconnect(){if(!this.enabled||!this.project)return;if(!this.token){this.status=sessionExpiredMessage;this.lastError=this.status;this.phase='authentication';this.changed();return;}clearTimeout(this.timer);const ws=this.ws;this.ws=null;ws?.close();this.connected=false;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Core disconnected; refresh state before retrying.'));}this.pending.clear();this.open();}
  private open(){if(!this.enabled)return;this.phase=this.snapshotReceivedAt?'recovering':'connecting';this.status='Connecting to Core…';this.changed();const ws=new WebSocket(this.endpoint);this.ws=ws;
    ws.onopen=()=>{if(this.ws===ws)ws.send(JSON.stringify({type:'subscribe',snapshotMode:'delta-v1',protocolVersion:1,token:this.token,project:this.project}));};
    ws.onmessage=event=>{if(this.ws!==ws)return;try{if(typeof event.data!=='string'||event.data.length>4000000)throw new Error('Core response exceeds limit.');const m=JSON.parse(event.data);if(m.protocolVersion!==1)throw new Error('Core protocol mismatch.');if(m.type==='snapshot'){
      if(!m.snapshot||!['agents','jobs','runs','steps','artifacts','events'].every(k=>Array.isArray(m.snapshot[k])))throw new Error('Invalid Core snapshot.');
      if(m.projectId!==undefined&&m.projectId!==this.project!.id)throw Error('Core snapshot project mismatch.');
      this.liveState=structuredClone(m.snapshot);this.sequence=m.sequence??0;
      this.access=coreAccess(m.access,this.project!.id);this.state=this.mergeHistory(m.snapshot);this.retainLogs(m.logs??{});this.connected=true;this.phase='connected';this.lastError='';this.snapshotReceivedAt=new Date().toISOString();this.status='Connected to Core';this.retry=500;this.changed();
    }else if(m.type==='delta'){
      if(m.projectId!==this.project!.id||m.baseSequence!==this.sequence||m.sequence!==this.sequence+1)throw Error('Core delta sequence or project mismatch.');
      const next=applySnapshotDelta(this.liveState,m.delta);
      if(next.runs.some(r=>r.projectId!==this.project!.id)||next.jobs.some(j=>j.projectId!==this.project!.id))throw Error('Core delta project mismatch.');
      this.access=coreAccess(m.access,this.project!.id);this.liveState=next;this.sequence=m.sequence;this.state=this.mergeHistory(structuredClone(next));if(m.logs)this.retainLogs(m.logs);this.snapshotReceivedAt=new Date().toISOString();this.changed();
    }else if(m.type==='reply'){const p=this.pending.get(m.requestId);if(p){clearTimeout(p.timer);this.pending.delete(m.requestId);if(m.error)p.reject(new Error(accessFeedback(String(m.error))));else p.resolve(m.value);}}
    else if(m.type==='error'){this.status=typeof m.error==='string'?accessFeedback(m.error):'Core rejected the connection.';this.lastError=this.status;this.phase=/auth|token|forbidden|TEAM_/i.test(String(m.error))?'authentication':/protocol/i.test(this.status)?'protocol-error':'error';this.changed();}
    }catch(error){this.lastError=error instanceof Error?error.message:'Invalid Core response.';this.phase='protocol-error';this.status='Invalid Core response. Reconnect to retry.';ws.close();}};
    ws.onerror=()=>{if(this.ws!==ws)return;this.phase='unavailable';this.lastError='Core unavailable. Retrying…';this.status=this.lastError;this.changed();};
    ws.onclose=event=>{if(this.ws!==ws)return;this.connected=false;const blocked=this.phase==='authentication'||this.phase==='protocol-error'||event.code===1008;if(event.code===1008&&this.phase!=='protocol-error'){this.phase='authentication';this.lastError=/expired|revoked/i.test(event.reason)?sessionExpiredMessage:(this.lastError||'Core rejected the connection.');this.status=this.lastError;this.token='';}if(!blocked){this.phase=this.snapshotReceivedAt?'recovering':'unavailable';this.status='Core disconnected. Retrying…';}for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Core disconnected; refresh state before retrying.'));}this.pending.clear();this.changed();if(this.enabled&&!blocked){this.timer=setTimeout(()=>this.open(),this.retry);this.retry=Math.min(this.retry*2,10000);}};
  }
  setProject(project:Project){if(this.project?.id!==project.id){this.historical.clear();this.logs={};this.downloads.clear();}this.project=project;if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify({type:'subscribe',protocolVersion:1,project}));}
  disconnect(){this.enabled=false;this.connected=false;clearTimeout(this.timer);const ws=this.ws;this.ws=null;ws?.close();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Core disconnected.'));}this.pending.clear();this.historical.clear();this.downloads.clear();this.liveState=empty();this.sequence=0;this.state=empty();this.logs={};this.access=null;this.token='';this.phase='disabled';this.lastError='';this.snapshotReceivedAt=null;this.status='Not connected';this.changed();}
  private call<T>(method:string,args:unknown[]):Promise<T>{if(!this.connected||this.ws?.readyState!==WebSocket.OPEN)return Promise.reject(new Error('Connect to Core before changing remote state.'));const requestId=crypto.randomUUID(),payload=JSON.stringify({type:'rpc',protocolVersion:1,requestId,method,args});if(new TextEncoder().encode(payload).length>60000)return Promise.reject(new Error('Core request exceeds the safe transfer limit. Reduce the workspace snapshot or Protocol plan.'));return new Promise<T>((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error('Core request timed out. Inspect state before retrying.'));},10000);this.pending.set(requestId,{resolve:value=>resolve(value as T),reject,timer});this.ws!.send(payload);});}
  async artifact(a:Pick<Artifact,'location'|'size'|'checksum'>,projectId:string,signal?:AbortSignal){if(!this.connected||this.project?.id!==projectId||!/^\/artifacts\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(a.location))throw Error('Artifact project boundary.');const endpoint=new URL(this.endpoint);endpoint.protocol=endpoint.protocol==='wss:'?'https:':'http:';endpoint.pathname=a.location;endpoint.search='';const token=this.token;return this.downloads.download(endpoint.href+':'+projectId,{size:a.size,checksum:a.checksum??''},(start,end,signal)=>fetch(endpoint,{headers:{Authorization:'Bearer '+token,'X-Project-Id':projectId,Range:`bytes=${start}-${end}`,'If-Match':`"${a.checksum}"`},signal}),signal);}
  recordsRequest<T>(action:string,input?:unknown){return this.call<T>('records',[action,input]);}
  async loadRun(id:string){const projectId=this.project?.id,detail=await this.recordsRequest<CoreSnapshot>('detail',id);if(this.project?.id!==projectId||!projectId||!detail||detail.runs?.length!==1||detail.runs[0].id!==id||detail.runs[0].projectId!==projectId||detail.jobs?.some(j=>j.projectId!==projectId)||!['agents','jobs','steps','artifacts','events'].every(k=>Array.isArray(detail[k as keyof CoreSnapshot])))throw Error('Historical Run project mismatch.');this.historical.delete(id);this.historical.set(id,detail);while(this.historical.size>8)this.historical.delete(this.historical.keys().next().value!);const ids=new Set(detail.runs.map(r=>r.id));this.state={...this.state,runs:this.state.runs.filter(r=>!ids.has(r.id)),jobs:this.state.jobs.filter(j=>j.id!==detail.jobs[0]?.id),steps:this.state.steps.filter(s=>!ids.has(s.runId)),artifacts:this.state.artifacts.filter(a=>!ids.has(a.runId))};this.state=this.mergeHistory(liveSnapshot(this.state));this.changed();return detail;}
  async resumeLogs(runId:string){const cursors:Record<string,number>={};for(const row of this.logs[runId]??[])cursors[row.runStepId??'']=Math.max(cursors[row.runStepId??'']??0,row.sequence);const value=await this.recordsRequest<{chunks:RemoteLog[];partial:boolean}>('logs',{runId,cursors});const combined=[...(this.logs[runId]??[]),...value.chunks],seen=new Set<string>();this.logs[runId]=combined.filter(row=>{const key=(row.runStepId??'')+':'+row.sequence;if(seen.has(key))return false;seen.add(key);return true;}).slice(-500);this.retainLogs({[runId]:this.logs[runId]});this.changed();return value.partial;}
  async deleteArtifact(a:Artifact,projectId:string){if(this.project?.id!==projectId||!this.connected)throw Error('Artifact project boundary.');const endpoint=new URL(this.endpoint);endpoint.protocol=endpoint.protocol==='wss:'?'https:':'http:';endpoint.pathname=a.location;endpoint.search='';const response=await fetch(endpoint,{method:'DELETE',headers:{Authorization:'Bearer '+this.token,'X-Project-Id':projectId,'If-Match':`"${a.checksum}"`}});if(response.status!==204)throw Error('Evidence deletion refused or purge pending. Refresh before retrying.');await this.loadRun(a.runId);}
  async aiRequest(body:unknown,projectId:string,signal:AbortSignal){if(!this.connected||this.project?.id!==projectId)throw new Error('Core connection required.');const url=new URL(this.endpoint);url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/ai/request';url.search='';return fetch(url,{method:'POST',headers:{Authorization:'Bearer '+this.token,'X-Project-Id':projectId,'Content-Type':'application/json'},body:JSON.stringify(body),signal});}
  async issueRequest<T>(body:unknown,projectId:string):Promise<T>{if(!this.connected||this.project?.id!==projectId)throw new IssueError('unavailable');const url=new URL(this.endpoint);url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/issues/request';url.search='';try{const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+this.token,'X-Project-Id':projectId,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(65000)});const result=await response.json();if(result.error)throw new IssueError(result.error as IssueErrorCode);if(!response.ok)throw new IssueError('unavailable');return result.value as T;}catch(e){if(e instanceof IssueError)throw e;throw new IssueError('unavailable');}}
  registerAgent(input:Pick<Agent,'name'|'platform'|'architecture'|'capabilities'>){return this.call<Agent>('registerAgent',[input]);}
  removeAgent(id:string){return this.call<void>('removeAgent',[id]);}
  createJob(_projectId:string,input:CreateJob){return this.call<CoreSnapshot['jobs'][number]>('createJob',[input]);}
  cancelJob(_projectId:string,id:string){return this.call<CoreSnapshot['jobs'][number]>('cancelJob',[id]);}
  retryJob(_projectId:string,id:string){return this.call<CoreSnapshot['jobs'][number]>('retryJob',[id]);}
  operationsRequest<T>(action:string,input?:unknown){return this.call<T>('operations',[action,input]);}
  teamRequest<T>(action:string,...args:unknown[]){return this.call<T>('team',[action,...args]);}
  schedulerRequest<T>(action:string,...args:unknown[]){return this.call<T>('scheduler',[action,...args]);}
  async historyRequest<T>(body:unknown,projectId:string):Promise<T>{
    if(!this.connected||this.project?.id!==projectId)throw new Error('Core connection required for durable history.');
    const text=JSON.stringify(body);if(new TextEncoder().encode(text).length>1048576)throw new Error('History record exceeds safe limit.');
    const url=new URL(this.endpoint);url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/history/request';url.search='';
    const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+this.token,'X-Project-Id':projectId,'Content-Type':'application/json'},body:text,signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok||result.error)throw new Error(typeof result.error==='string'?accessFeedback(result.error):'Core history persistence failed.');return result.value as T;
  }
  dispatch(_projectId?:string,jobId?:string){void _projectId;return this.call<{job:CoreSnapshot['jobs'][number]}|null>('dispatch',jobId?[jobId]:[]);}
  matches(projectId:string,id:string){const job=this.snapshot(projectId).jobs.find(j=>j.id===id);return job?this.state.agents.map(a=>matchAgent(a,job.requirements)):[];}
}
export const remoteCore=new RemoteCoreClient();



