'use client';
import type { Agent, Artifact, CoreSnapshot } from './domain';
import type { Project } from '../projects/types/project';
import type { CreateJob } from './service';
import { matchAgent } from './matcher.ts';
import {IssueError,type IssueErrorCode} from '../issues/domain.ts';
export interface RemoteLog { sequence:number;stream:'stdout'|'stderr';text:string;runStepId?:string }
const empty=():CoreSnapshot=>({agents:[],jobs:[],runs:[],steps:[],artifacts:[],events:[]});
export class RemoteCoreClient {
  enabled=false;connected=false;status='Not connected';logs:Record<string,RemoteLog[]>={};
  private state=empty();private version=0;private listeners=new Set<()=>void>();private ws:WebSocket|null=null;private timer:ReturnType<typeof setTimeout>|undefined;private retry=500;private token='';private endpoint='';private project:Project|null=null;
  private pending=new Map<string,{resolve:(value:unknown)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  readonly repository={subscribe:(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};},revision:()=>this.version,read:()=>this.state};
  private changed(){this.version++;for(const fn of this.listeners)fn();}
  snapshot(projectId:string){const s=this.state;const runs=s.runs.filter(r=>r.projectId===projectId);const ids=new Set(runs.map(r=>r.id));return {...s,jobs:s.jobs.filter(j=>j.projectId===projectId),runs,steps:s.steps.filter(s=>ids.has(s.runId)),artifacts:s.artifacts.filter(a=>ids.has(a.runId)),events:s.events.filter(e=>!e.projectId||e.projectId===projectId)};}
  connect(endpoint:string,token:string,project:Project){const url=new URL(endpoint);if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password||url.search||url.pathname!=='/studio')throw new Error('Use a ws:// or wss:// Core /studio endpoint.');if(token.length<16)throw new Error('Enter the configured Studio token.');this.disconnect();this.enabled=true;this.endpoint=url.href;this.token=token;this.project=project;this.retry=500;this.open();}
  private open(){if(!this.enabled)return;this.status='Connecting to Core…';this.changed();const ws=new WebSocket(this.endpoint);this.ws=ws;
    ws.onopen=()=>{ws.send(JSON.stringify({type:'subscribe',protocolVersion:1,token:this.token,project:this.project}));};
    ws.onmessage=event=>{try{if(typeof event.data!=='string'||event.data.length>4000000)throw new Error('Core response exceeds limit.');const m=JSON.parse(event.data);if(m.protocolVersion!==1)throw new Error('Core protocol mismatch.');if(m.type==='snapshot'){
      if(!m.snapshot||!['agents','jobs','runs','steps','artifacts','events'].every(k=>Array.isArray(m.snapshot[k])))throw new Error('Invalid Core snapshot.');
      this.state=m.snapshot;this.logs=m.logs??{};this.connected=true;this.status='Connected to Core';this.retry=500;this.changed();
    }else if(m.type==='reply'){const p=this.pending.get(m.requestId);if(p){clearTimeout(p.timer);this.pending.delete(m.requestId);if(m.error)p.reject(new Error(m.error));else p.resolve(m.value);}}
    else if(m.type==='error'){this.status=typeof m.error==='string'?m.error:'Core rejected the connection.';this.changed();}
    }catch{this.status='Invalid Core response. Reconnect to retry.';ws.close();}};
    ws.onerror=()=>{this.status='Core unavailable. Retrying…';this.changed();};
    ws.onclose=()=>{if(this.ws!==ws)return;this.connected=false;this.status='Core disconnected. Retrying…';for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Core disconnected; refresh state before retrying.'));}this.pending.clear();this.changed();if(this.enabled){this.timer=setTimeout(()=>this.open(),this.retry);this.retry=Math.min(this.retry*2,10000);}};
  }
  setProject(project:Project){this.project=project;if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify({type:'subscribe',protocolVersion:1,project}));}
  disconnect(){this.enabled=false;this.connected=false;clearTimeout(this.timer);const ws=this.ws;this.ws=null;ws?.close();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Core disconnected.'));}this.pending.clear();this.state=empty();this.logs={};this.token='';this.status='Not connected';this.changed();}
  private call<T>(method:string,args:unknown[]):Promise<T>{if(!this.connected||this.ws?.readyState!==WebSocket.OPEN)return Promise.reject(new Error('Connect to Core before changing remote state.'));const requestId=crypto.randomUUID(),payload=JSON.stringify({type:'rpc',protocolVersion:1,requestId,method,args});if(new TextEncoder().encode(payload).length>60000)return Promise.reject(new Error('Core request exceeds the safe transfer limit. Reduce the workspace snapshot or Protocol plan.'));return new Promise<T>((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error('Core request timed out. Inspect state before retrying.'));},10000);this.pending.set(requestId,{resolve:value=>resolve(value as T),reject,timer});this.ws!.send(payload);});}
  async artifact(a:Pick<Artifact,'location'|'size'|'checksum'>,projectId:string,signal?:AbortSignal){const endpoint=new URL(this.endpoint);endpoint.protocol=endpoint.protocol==='wss:'?'https:':'http:';endpoint.pathname=a.location;endpoint.search='';const response=await fetch(endpoint,{headers:{Authorization:'Bearer '+this.token,'X-Project-Id':projectId},signal});if(!response.ok)throw new Error('Artifact unavailable. Reconnect or check retention.');const blob=await response.blob();if(blob.size!==a.size)throw new Error('Artifact size mismatch.');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==a.checksum)throw new Error('Artifact integrity check failed.');return blob;}
  async aiRequest(body:unknown,projectId:string,signal:AbortSignal){if(!this.connected||this.project?.id!==projectId)throw new Error('Core connection required.');const url=new URL(this.endpoint);url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/ai/request';url.search='';return fetch(url,{method:'POST',headers:{Authorization:'Bearer '+this.token,'X-Project-Id':projectId,'Content-Type':'application/json'},body:JSON.stringify(body),signal});}
  async issueRequest<T>(body:unknown,projectId:string):Promise<T>{if(!this.connected||this.project?.id!==projectId)throw new IssueError('unavailable');const url=new URL(this.endpoint);url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/issues/request';url.search='';try{const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+this.token,'X-Project-Id':projectId,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(65000)});const result=await response.json();if(result.error)throw new IssueError(result.error as IssueErrorCode);if(!response.ok)throw new IssueError('unavailable');return result.value as T;}catch(e){if(e instanceof IssueError)throw e;throw new IssueError('unavailable');}}
  registerAgent(input:Pick<Agent,'name'|'platform'|'architecture'|'capabilities'>){return this.call<Agent>('registerAgent',[input]);}
  removeAgent(id:string){return this.call<void>('removeAgent',[id]);}
  createJob(_projectId:string,input:CreateJob){return this.call<CoreSnapshot['jobs'][number]>('createJob',[input]);}
  cancelJob(_projectId:string,id:string){return this.call<CoreSnapshot['jobs'][number]>('cancelJob',[id]);}
  retryJob(_projectId:string,id:string){return this.call<CoreSnapshot['jobs'][number]>('retryJob',[id]);}
  schedulerRequest<T>(action:string,...args:unknown[]){return this.call<T>('scheduler',[action,...args]);}
  async historyRequest<T>(body:unknown,projectId:string):Promise<T>{
    if(!this.connected||this.project?.id!==projectId)throw new Error('Core connection required for durable history.');
    const text=JSON.stringify(body);if(new TextEncoder().encode(text).length>1048576)throw new Error('History record exceeds safe limit.');
    const url=new URL(this.endpoint);url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/history/request';url.search='';
    const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+this.token,'X-Project-Id':projectId,'Content-Type':'application/json'},body:text,signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok||result.error)throw new Error(typeof result.error==='string'?result.error:'Core history persistence failed.');return result.value as T;
  }
  dispatch(_projectId?:string,jobId?:string){void _projectId;return this.call<{job:CoreSnapshot['jobs'][number]}|null>('dispatch',jobId?[jobId]:[]);}
  matches(projectId:string,id:string){const job=this.snapshot(projectId).jobs.find(j=>j.id===id);return job?this.state.agents.map(a=>matchAgent(a,job.requirements)):[];}
}
export const remoteCore=new RemoteCoreClient();



