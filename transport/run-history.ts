import {activeRun} from '../src/features/core/domain.ts';import type {CoreService} from '../src/features/core/service.ts';import {pageHistory} from '../src/features/core/history-query.ts';import {identifier,type RunLogs} from './protocol.ts';import type {CoreStore} from './storage.ts';
export class RunHistory {
 private service:CoreService;private logs:RunLogs;private store?:CoreStore;private policies=new Map<string,number>();
 constructor(service:CoreService,logs:RunLogs,store?:CoreStore){this.service=service;this.logs=logs;this.store=store;}
 request(projectId:string,action:unknown,input:unknown){
  const snapshot=this.service.snapshot(projectId);
  if(action==='page'){const jobs=new Map(snapshot.jobs.map(j=>[j.id,j]));return pageHistory(snapshot.runs.map(r=>({id:r.id,createdAt:r.createdAt,status:r.status,name:jobs.get(r.jobId)?.name??r.id,agentId:r.agentId,finishedAt:r.finishedAt})),input);}
  if(action==='detail'){const id=identifier(input),run=snapshot.runs.find(r=>r.id===id);if(!run)throw Error('Run not found in this project.');const value={...snapshot,runs:[run],jobs:snapshot.jobs.filter(j=>j.id===run.jobId),steps:snapshot.steps.filter(s=>s.runId===id),artifacts:snapshot.artifacts.filter(a=>a.runId===id),events:snapshot.events.filter(e=>e.entityId===id).slice(-100)};if(Buffer.byteLength(JSON.stringify(value))>2000000)throw Error('Run detail exceeds export limit.');return value;}
  if(action==='logs'){if(!input||typeof input!=='object')throw Error('Invalid log resume.');const row=input as {runId:string;cursors:Record<string,number>};if(!snapshot.runs.some(r=>r.id===identifier(row.runId)))throw Error('Run not found in this project.');return this.logs.since(row.runId,row.cursors);}
  const policyKey='retention:'+projectId;
  if(action==='policy-save'){if(!Number.isSafeInteger(input)||(input as number)<1||(input as number)>3650)throw Error('Retention days must be between 1 and 3650.');this.store?.put(policyKey,input);this.policies.set(projectId,input as number);}
  if(action==='policy'||action==='policy-save'||action==='retention-preview'){
   const days=this.store?.get<number>(policyKey)??this.policies.get(projectId)??30,cutoff=Date.now()-days*86400000;
   const terminal=new Set(snapshot.runs.filter(r=>!activeRun(r)).map(r=>r.id));const candidates=snapshot.artifacts.filter(a=>!a.deletedAt&&terminal.has(a.runId)&&Date.parse(a.createdAt)<cutoff);
   return {days,automaticDeletion:false,candidates:candidates.slice(0,100).map(a=>({id:a.id,runId:a.runId,name:a.name,size:a.size,checksum:a.checksum})),candidateCount:candidates.length,candidateBytes:candidates.reduce((n,a)=>n+a.size,0),retainedBytes:snapshot.artifacts.filter(a=>!a.deletedAt).reduce((n,a)=>n+a.size,0),deletedCount:snapshot.artifacts.filter(a=>a.deletedAt).length,runCount:snapshot.runs.length};
  }
  throw Error('Invalid history operation.');
 }
}
