import {activeRun,type Artifact} from '../src/features/core/domain.ts';import type {CoreService} from '../src/features/core/service.ts';import {pageHistory,historyQuery} from '../src/features/core/history-query.ts';import {identifier,type RunLogs} from './protocol.ts';import type {CoreStore} from './storage.ts';
export class RunHistory {
 private service:CoreService;private logs:RunLogs;private store?:CoreStore;private policies=new Map<string,number>();
 constructor(service:CoreService,logs:RunLogs,store?:CoreStore){this.service=service;this.logs=logs;this.store=store;}
 request(projectId:string,action:unknown,input:unknown){
  if(action==='page'&&this.store)return this.store.pageRuns(projectId,input);
  if(action==='statistics'){
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['from','to'].includes(k)))throw Error('Invalid statistics period.');
   const {from,to}=input as {from:string;to:string};if(typeof from!=='string'||typeof to!=='string')throw Error('Invalid statistics period.');historyQuery({from,to});
   if(this.store)return this.store.runStatistics(projectId,from,to);
   const rows=this.service.snapshot(projectId).runs.filter(r=>Date.parse(r.createdAt)>=Date.parse(from)&&Date.parse(r.createdAt)<=Date.parse(to)),days=new Map<string,{day:string;total:number;passed:number;failed:number}>(),durations:number[]=[];
   let passed=0,failed=0;for(const r of rows){const day=new Date(r.createdAt).toISOString().slice(0,10),bucket=days.get(day)??{day,total:0,passed:0,failed:0};bucket.total++;if(r.status==='passed'){passed++;bucket.passed++;}if(['failed','timeout'].includes(r.status)){failed++;bucket.failed++;}days.set(day,bucket);const ms=r.startedAt&&r.finishedAt?Date.parse(r.finishedAt)-Date.parse(r.startedAt):NaN;if(Number.isFinite(ms)&&ms>=0)durations.push(ms);}
   return{sampleCount:rows.length,total:rows.length,limited:false,passed,failed,passRate:passed+failed?passed/(passed+failed):null,meanElapsedMs:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null,days:[...days.values()].sort((a,b)=>a.day.localeCompare(b.day))};
  }
  if(this.store&&['policy','policy-save','retention-preview'].includes(String(action))){
   const key='retention:'+projectId;if(action==='policy-save'){if(!Number.isSafeInteger(input)||(input as number)<1||(input as number)>3650)throw Error('Retention days must be between 1 and 3650.');this.store.put(key,input);}
   const days=this.store.get<number>(key)??30,{ids,...usage}=this.store.evidenceUsage(projectId,new Date(Date.now()-days*86400000).toISOString());
   const candidates=ids.map(id=>{const a=this.store!.get<Artifact>('core-row:artifacts:'+id);if(!a||a.id!==id||a.deletedAt)throw Error('Evidence projection integrity mismatch.');return{id:a.id,runId:a.runId,name:a.name,size:a.size,checksum:a.checksum};});
   return{days,automaticDeletion:false,...usage,candidates};
  }
  const snapshot=this.service.snapshot(projectId,undefined,action==='detail'?identifier(input):undefined);
  if(action==='page'){const jobs=new Map(snapshot.jobs.map(j=>[j.id,j]));return pageHistory(snapshot.runs.map(r=>({id:r.id,createdAt:r.createdAt,status:r.status,name:jobs.get(r.jobId)?.name??r.id,agentId:r.agentId,startedAt:r.startedAt,finishedAt:r.finishedAt})),input);}
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
