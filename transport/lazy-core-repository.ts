import type {CoreRepositories,CoreRepository,EntityRepository} from '../src/features/core/repository.ts';
import type {CoreSnapshot} from '../src/features/core/domain.ts';
import {CoreStore,EagerSqliteCoreRepository,historyRows,artifactUsageRows} from './storage.ts';

const kinds=['agents','jobs','runs','steps','artifacts','events'] as const;
type Kind=typeof kinds[number];type Row=CoreSnapshot[Kind][number];
interface Summary {id:string;projectId?:string;runId?:string;runStepId?:string;jobId?:string;agentId?:string;status?:string;createdAt?:string;order?:number;stepCount?:number;idempotencyKey?:string}
interface Index {revision:number;ids:Record<Kind,Summary[]>}
const blank=():CoreSnapshot=>({agents:[],jobs:[],runs:[],steps:[],artifacts:[],events:[]});
function summary(row:Row):Summary {const result:Summary={id:row.id};for(const key of ['projectId','runId','runStepId','jobId','agentId','status','createdAt','order','idempotencyKey'] as const){const value=(row as unknown as Record<string,unknown>)[key];if(value!==undefined&&value!==null)Object.assign(result,{[key]:value});}if('payload' in row)result.stepCount=row.payload.steps.length;return result;}
function indexOf(state:CoreSnapshot,revision:number):Index {const ids={} as Index['ids'];for(const kind of kinds)ids[kind]=state[kind].map(summary);return{revision,ids};}
const name=(kind:Kind,id:string)=>'core-row:'+kind+':'+id;
/** Encrypted lightweight relations stay resident; Source/Step/Evidence bodies are
 * read on demand. A synchronous overlay commits rows and projections together. */
export class SqliteCoreRepository implements CoreRepository {
 private store:CoreStore;private index:Index;private listeners=new Set<()=>void>();private writing=false;private metadata=new Map<Kind,Map<string,Summary>>();
 constructor(store:CoreStore){
  this.store=store;
  const saved=store.get<Index>('core-lazy-index-v1'),manifest=store.get<{revision:number;ids:Record<Kind,string[]>}>('core-manifest-v1');
  if(saved&&saved.revision===manifest?.revision&&store.get('run-history-index-format')===4&&store.get('artifact-usage-format')===1&&Number(store.db.prepare('PRAGMA user_version').get()?.user_version)===3){
   if(!Number.isSafeInteger(saved.revision)||!saved.ids||kinds.some(kind=>!Array.isArray(saved.ids[kind])||saved.ids[kind].some(r=>typeof r.id!=='string'||!r.id)||new Set(saved.ids[kind].map(r=>r.id)).size!==saved.ids[kind].length||JSON.stringify(saved.ids[kind].map(r=>r.id))!==JSON.stringify(manifest.ids[kind])))throw Error('Invalid lazy Core index.');this.index=saved;
  }else{
   const migrated=new EagerSqliteCoreRepository(store);this.index=indexOf(migrated.read(),migrated.revision());store.put('core-lazy-index-v1',this.index);
  }
  this.refreshMetadata();
 }
 private refreshMetadata(){this.metadata=new Map(kinds.map(kind=>[kind,new Map(this.index.ids[kind].map(r=>[r.id,r]))]));}
  private row<K extends Kind>(kind:K,id:string):CoreSnapshot[K][number]|undefined {
  const expected=this.metadata.get(kind)!.get(id);if(!expected)return undefined;
  const value=this.store.get<CoreSnapshot[K][number]>(name(kind,id));if(!value||value.id!==id||JSON.stringify(summary(value))!==JSON.stringify(expected))throw Error('Missing or mismatched stored Core entity.');return value;
 }
 readEntity<K extends Kind>(kind:K,id:string):CoreSnapshot[K][number]|undefined {return this.row(kind,id);}
 readActiveRuns(){return this.index.ids.runs.filter(r=>['pending','running'].includes(r.status??'')).map(r=>this.row('runs',r.id)!);}
 readRows<K extends Kind>(kind:K):CoreSnapshot[K] {return this.index.ids[kind].map(r=>this.row(kind,r.id)!) as CoreSnapshot[K];}
 read():CoreSnapshot {const state=blank();for(const kind of kinds)Object.assign(state,{[kind]:this.readRows(kind)});return state;}
 readProject(projectId:string,terminalLimit?:number,runId?:string):CoreSnapshot {
  if(terminalLimit!==undefined&&(!Number.isInteger(terminalLimit)||terminalLimit<1||terminalLimit>1000))throw Error('Invalid live history limit.');
  const active=(r:Summary)=>['pending','running'].includes(r.status??'');let runs=this.index.ids.runs.filter(r=>r.projectId===projectId&&(!runId||r.id===runId));
  const recent=(rows:Summary[])=>rows.slice().sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??'')||b.id.localeCompare(a.id)).slice(0,terminalLimit);
  if(terminalLimit!==undefined){const keep=new Set([...runs.filter(active),...recent(runs.filter(r=>!active(r)))].map(r=>r.id));runs=runs.filter(r=>keep.has(r.id));}
  const runIds=new Set(runs.map(r=>r.id)),jobIds=new Set(runs.map(r=>r.jobId));if(terminalLimit!==undefined&&!runId)for(const j of recent(this.index.ids.jobs.filter(j=>j.projectId===projectId&&!['queued','assigned','running'].includes(j.status??''))))jobIds.add(j.id);
  const selected:Index['ids']={agents:this.index.ids.agents,runs,jobs:this.index.ids.jobs.filter(j=>j.projectId===projectId&&(runId?jobIds.has(j.id):terminalLimit===undefined||jobIds.has(j.id)||['queued','assigned','running'].includes(j.status??''))),steps:this.index.ids.steps.filter(s=>runIds.has(s.runId!)),artifacts:this.index.ids.artifacts.filter(a=>runIds.has(a.runId!)),events:this.index.ids.events.filter(e=>!e.projectId||e.projectId===projectId)};
  const state=blank();for(const kind of kinds)Object.assign(state,{[kind]:selected[kind].map(r=>this.row(kind,r.id)!)});return state;
 }
 revision=()=>this.index.revision;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 transaction<T>(operation:(repositories:CoreRepositories)=>T):T {
  if(this.writing)throw Error('Nested Core transactions are not allowed.');this.writing=true;
  try {
   const drafts=new Map<Kind,Map<string,Row>>(),removed=new Map<Kind,Set<string>>(),order=new Map<Kind,string[]>(),lists=new Map<Kind,Row[]>();
   for(const kind of kinds){drafts.set(kind,new Map());removed.set(kind,new Set());order.set(kind,this.index.ids[kind].map(r=>r.id));}
   const get=(kind:Kind,id:string):Row|undefined=>{if(removed.get(kind)!.has(id))return undefined;const listed=lists.get(kind);if(listed)return listed.find(r=>r.id===id);const changed=drafts.get(kind)!;if(changed.has(id))return changed.get(id);const value=this.row(kind,id);if(value)changed.set(id,value);return value;};
   const repositories={} as CoreRepositories;
   for(const kind of kinds){const access:EntityRepository<Row>={get:id=>get(kind,id),list(){let rows=lists.get(kind);if(!rows){rows=order.get(kind)!.filter(id=>!removed.get(kind)!.has(id)).map(id=>get(kind,id)!);lists.set(kind,rows);}return rows;},save(value){if(!value||typeof value.id!=='string'||!value.id)throw Error('Invalid Core identity.');const copy=structuredClone(value);drafts.get(kind)!.set(value.id,copy);removed.get(kind)!.delete(value.id);if(!order.get(kind)!.includes(value.id))order.get(kind)!.push(value.id);const rows=lists.get(kind);if(rows){const i=rows.findIndex(r=>r.id===value.id);if(i<0)rows.push(copy);else rows[i]=copy;}},remove(id){removed.get(kind)!.add(id);const rows=lists.get(kind);if(rows){const i=rows.findIndex(r=>r.id===id);if(i>=0)rows.splice(i,1);}}};Object.assign(repositories,{[kind]:access});}
   const result=operation(repositories);if(result instanceof Promise)throw Error('Core transactions must be synchronous.');const detached=structuredClone(result);
   for(const [kind,rows] of lists){const ids=rows.map(r=>r.id);if(new Set(ids).size!==ids.length)throw Error('Duplicate Core identity.');for(const id of order.get(kind)!)if(!ids.includes(id))removed.get(kind)!.add(id);order.set(kind,ids);for(const row of rows)drafts.get(kind)!.set(row.id,row);}
   const eventIds=order.get('events')!.filter(id=>!removed.get('events')!.has(id));for(const id of eventIds.slice(0,Math.max(0,eventIds.length-1000)))removed.get('events')!.add(id);
   const changed=new Map<Kind,Map<string,Row>>(),next:Index={revision:this.index.revision+1,ids:{} as Index['ids']};
   for(const kind of kinds){const map=new Map<string,Row>();for(const [id,row] of drafts.get(kind)!){if(!row||typeof row.id!=='string'||!row.id||row.id!==id)throw Error('Core identities cannot be changed.');if(!removed.get(kind)!.has(id)&&JSON.stringify(this.row(kind,id))!==JSON.stringify(row))map.set(id,structuredClone(row));}changed.set(kind,map);const old=new Map(this.index.ids[kind].map(r=>[r.id,r]));next.ids[kind]=order.get(kind)!.filter(id=>!removed.get(kind)!.has(id)).map(id=>map.has(id)?summary(map.get(id)!):old.get(id)??summary(drafts.get(kind)!.get(id)!));}
   const lookup=(kind:Kind,id:string)=>removed.get(kind)!.has(id)?undefined:changed.get(kind)!.get(id)??this.row(kind,id);
   const jobs=new Map(next.ids.jobs.map(j=>[j.id,j])),runs=new Map(next.ids.runs.map(r=>[r.id,r])),steps=new Map(next.ids.steps.map(s=>[s.id,s])),agents=new Set(next.ids.agents.map(a=>a.id));
   for(const r of next.ids.runs)if(jobs.get(r.jobId!)?.projectId!==r.projectId||(['pending','running'].includes(r.status??'')&&!agents.has(r.agentId!)))throw Error('Invalid Run reference.');
   for(const s of next.ids.steps){const run=runs.get(s.runId!);if(!run||!Number.isInteger(s.order)||s.order!<0||s.order!>=(jobs.get(run.jobId!)?.stepCount??0))throw Error('Invalid Step reference.');}
   for(const a of next.ids.artifacts)if(!runs.has(a.runId!)||(a.runStepId&&steps.get(a.runStepId)?.runId!==a.runId))throw Error('Invalid Evidence reference.');
   for(const row of changed.get('steps')!.values()){const s=row as CoreSnapshot['steps'][number],r=runs.get(s.runId),j=r?lookup('jobs',r.jobId!) as CoreSnapshot['jobs'][number]:undefined;if(!Number.isInteger(s.order)||s.order<0||!j?.payload.steps[s.order])throw Error('Invalid Step order.');}
   const identities=next.ids.jobs.filter(j=>j.idempotencyKey).map(j=>j.projectId+':'+j.idempotencyKey);if(new Set(identities).size!==identities.length)throw Error('Duplicate dispatch identity.');
   const affectedRuns=new Set([...changed.get('runs')!.keys(),...removed.get('runs')!]);for(const r of next.ids.runs)if(changed.get('jobs')!.has(r.jobId!))affectedRuns.add(r.id);
   const affectedArtifacts=new Set([...changed.get('artifacts')!.keys(),...removed.get('artifacts')!]);for(const a of next.ids.artifacts)if(affectedRuns.has(a.runId!))affectedArtifacts.add(a.id);
   const projectionState=(after:boolean)=>{const state=blank(),fetch=(kind:Kind,id:string)=>after?lookup(kind,id):this.row(kind,id);const runIds=new Set(affectedRuns);for(const id of affectedArtifacts){const a=fetch('artifacts',id) as CoreSnapshot['artifacts'][number]|undefined;if(a){state.artifacts.push(a);runIds.add(a.runId);}}const jobIds=new Set<string>();for(const id of runIds){const r=fetch('runs',id) as CoreSnapshot['runs'][number]|undefined;if(r){state.runs.push(r);jobIds.add(r.jobId);}}for(const id of jobIds){const j=fetch('jobs',id) as CoreSnapshot['jobs'][number]|undefined;if(j)state.jobs.push(j);}return state;};
   const before=projectionState(false),after=projectionState(true),values:[string,unknown][]=[['core-lazy-index-v1',next],['core-manifest-v1',{revision:next.revision,ids:Object.fromEntries(kinds.map(k=>[k,next.ids[k].map(r=>r.id)]))}],['run-history-revision',next.revision]],deletions:string[]=[];
   for(const kind of kinds){for(const [id,row] of changed.get(kind)!)values.push([name(kind,id),row]);for(const id of removed.get(kind)!)deletions.push(name(kind,id));}
   this.store.putMany(values,()=>{this.store.saveRunHistory(historyRows(before),after);this.store.saveArtifactUsage(artifactUsageRows(before),after);},deletions);
   this.index=next;this.refreshMetadata();this.writing=false;for(const listener of this.listeners)try{listener();}catch{/* Observers cannot undo durable writes. */}return detached;
  }finally{this.writing=false;}
 }
}
