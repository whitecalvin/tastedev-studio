import {activeRun,type CoreSnapshot} from './domain.ts';
export interface HistoryQuery {limit?:number;after?:string;search?:string;status?:string;from?:string;to?:string}
export function historyQuery(value:unknown):Required<Pick<HistoryQuery,'limit'|'search'|'status'>>&HistoryQuery {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['limit','after','search','status','from','to'].includes(k)))throw Error('Invalid history query.');
 const q=value as HistoryQuery;
 if(q.limit!==undefined&&(!Number.isSafeInteger(q.limit)||q.limit<1||q.limit>100)||q.search!==undefined&&(typeof q.search!=='string'||q.search.length>120)||q.status!==undefined&&(typeof q.status!=='string'||q.status.length>40))throw Error('Invalid history query.');
 for(const date of [q.from,q.to])if(date!==undefined&&(typeof date!=='string'||!Number.isFinite(Date.parse(date))))throw Error('Invalid history query.');
 if(q.from&&q.to&&q.from>q.to)throw Error('Invalid history query.');
 if(q.after!==undefined){if(typeof q.after!=='string'||q.after.length>256)throw Error('Invalid history cursor.');const a=JSON.parse(q.after);if(!Array.isArray(a)||a.length!==2||typeof a[0]!=='string'||!Number.isFinite(Date.parse(a[0]))||typeof a[1]!=='string'||a[1].length>100)throw Error('Invalid history cursor.');}
 return {...q,limit:q.limit??25,search:q.search??'',status:q.status??''};
}
export function pageHistory<T extends {id:string;createdAt:string;status?:string;name?:string}>(rows:T[],input:unknown){
 const q=historyQuery(input),after=q.after?JSON.parse(q.after) as [string,string]:null;
 const matches=rows.filter(r=>(!q.search||`${r.name??''} ${r.id}`.toLowerCase().includes(q.search.toLowerCase()))&&(!q.status||r.status===q.status)&&(!q.from||Date.parse(r.createdAt)>=Date.parse(q.from))&&(!q.to||Date.parse(r.createdAt)<=Date.parse(q.to))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
 const eligible=after?matches.filter(r=>r.createdAt<after[0]||r.createdAt===after[0]&&r.id<after[1]):matches;
 const items=eligible.slice(0,q.limit),last=items.at(-1);return {items,total:matches.length,next:eligible.length>q.limit&&last?JSON.stringify([last.createdAt,last.id]):null};
}
export function liveSnapshot(snapshot:CoreSnapshot){
 const recent=[...snapshot.runs].filter(r=>!activeRun(r)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).slice(0,100);
 const runIds=new Set([...recent,...snapshot.runs.filter(activeRun)].map(r=>r.id)),jobIds=new Set(snapshot.runs.filter(r=>runIds.has(r.id)).map(r=>r.jobId));
 for(const job of [...snapshot.jobs].filter(j=>!['queued','assigned','running'].includes(j.status)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).slice(0,100))jobIds.add(job.id);
 return {...snapshot,runs:snapshot.runs.filter(r=>runIds.has(r.id)),jobs:snapshot.jobs.filter(j=>jobIds.has(j.id)||['queued','assigned','running'].includes(j.status)),steps:snapshot.steps.filter(s=>runIds.has(s.runId)),artifacts:snapshot.artifacts.filter(a=>runIds.has(a.runId)),events:snapshot.events.slice(-200)};
}
