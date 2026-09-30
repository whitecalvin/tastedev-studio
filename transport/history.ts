import type {IncomingMessage,ServerResponse} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import type {AnalysisRecord} from '../src/features/ai/domain.ts';
import {aiPath,uuid} from '../src/features/ai/security.ts';
import {applyEdits,contentHash,type FixAttempt} from '../src/features/ai/fix-service.ts';
import type {CoreStore} from './storage.ts';
export type HistoryKind='analysis'|'attempt';
export interface HistoryRow {version:number;value:AnalysisRecord|FixAttempt}
/** Project-scoped record CAS. This endpoint stores review data; it cannot execute tools. */
export class HistoryStore {
 private memory=new Map<string,HistoryRow>();private store?:CoreStore;
 constructor(store?:CoreStore){this.store=store;}
 private key(project:string,kind:HistoryKind,id:string){return `history:${project}:${kind}:${id}`;}
 list(project:string,kind:HistoryKind){const prefix=`history:${project}:${kind}:`,names=this.store?this.store.names(prefix):[...this.memory.keys()].filter(k=>k.startsWith(prefix));return names.map(name=>({id:name.slice(prefix.length),version:(this.store?.get<HistoryRow>(name)??this.memory.get(name))!.version}));}
 get(project:string,kind:HistoryKind,id:string){return structuredClone(this.store?.get<HistoryRow>(this.key(project,kind,id))??this.memory.get(this.key(project,kind,id)));}
 async put(project:string,kind:HistoryKind,id:string,expectedVersion:number,value:AnalysisRecord|FixAttempt){
  uuid(id);if(value.id!==id||value.projectId!==project||!Number.isSafeInteger(expectedVersion)||expectedVersion<0||!Number.isFinite(Date.parse(value.createdAt)))throw Error('Invalid history record.');
  if(kind==='attempt'){
   const a=value as FixAttempt;uuid(a.proposalId);uuid(a.analysisId);if(!Number.isInteger(a.attempt)||a.attempt<1||a.attempt>10||!['proposed','approved','applied','validating','retesting','passed','failed','reverted','cancelled','rejected','recovery-required'].includes(a.status)||!Array.isArray(a.patches)||!a.patches.length||a.patches.length>8)throw Error('Invalid attempt.');
   for(const p of a.patches){aiPath(p.path);if(typeof p.base!=='string'||typeof p.result!=='string'||p.base.length>32768||p.result.length>32768||await contentHash(p.base)!==p.baseHash||await contentHash(p.result)!==p.resultHash||applyEdits(p.base,p.edits)!==p.result)throw Error('Invalid stored patch.');}
   if(a.approval&&(a.approval.proposalId!==a.proposalId||a.approval.changeHash!==await contentHash(JSON.stringify(a.patches))||a.approval.files.length!==a.patches.length||new Set(a.approval.files).size!==a.patches.length||a.approval.files.some(p=>!a.patches.some(f=>f.path===p))))throw Error('Invalid approval scope.');
  }else{
   const a=value as AnalysisRecord;uuid(a.conversationId);if(!a.result||typeof a.result.summary!=='string'||!Array.isArray(a.context)||!a.originals||Object.entries(a.originals).some(([p,v])=>{try{aiPath(p);return typeof v!=='string'||v.length>32768;}catch{return true;}}))throw Error('Invalid analysis.');
  }
  // Recheck after async hash validation; concurrent writers cannot both win.
  const key=this.key(project,kind,id),old=this.store?.get<HistoryRow>(key)??this.memory.get(key);
  if((old?.version??0)!==expectedVersion)throw Error('HISTORY_CONFLICT');
  if(old){if(old.value.createdAt!==value.createdAt)throw Error('History identity is immutable.');if(kind==='analysis'&&JSON.stringify(old.value)!==JSON.stringify(value))throw Error('Analysis is immutable.');if(kind==='attempt'){const before=old.value as FixAttempt,after=value as FixAttempt;if(before.proposalId!==after.proposalId||before.analysisId!==after.analysisId||JSON.stringify(before.patches)!==JSON.stringify(after.patches)||JSON.stringify(before.approval)!==JSON.stringify(after.approval)&&before.approval)throw Error('Reviewed proposal is immutable.');}}
  const row={version:expectedVersion+1,value:structuredClone(value)};this.store?.put(key,row);if(!this.store)this.memory.set(key,row);return row.version;
 }
}
export function historyGateway(store:HistoryStore,token:string,origins:string[],project:(id:string)=>boolean){return async(req:IncomingMessage,res:ServerResponse)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');const origin=req.headers.origin;
 if(origin&&!origins.includes(origin)){res.statusCode=403;res.end('{"error":"permission"}');return;}if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Project-Id');if(req.method==='OPTIONS'){res.end();return;}
 try{const actual=req.headers.authorization?.slice(7)??'';if(!req.headers.authorization?.startsWith('Bearer ')||!timingSafeEqual(createHash('sha256').update(actual).digest(),createHash('sha256').update(token).digest())){res.statusCode=401;throw Error('Authentication required.');}
  const p=String(req.headers['x-project-id']??'');if(!project(p))throw Error('Project boundary.');if(req.method!=='POST'||req.url!=='/history/request')throw Error('Invalid history request.');req.setTimeout(15000,()=>req.destroy());const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1048576)throw Error('History record exceeds safe limit.');chunks.push(Buffer.from(chunk));}
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8')) as {action:string;kind:HistoryKind;id:string;version:number;value:AnalysisRecord|FixAttempt};if(!['analysis','attempt'].includes(input.kind))throw Error('Invalid history kind.');let value:unknown;
  if(input.action==='list')value=store.list(p,input.kind);else{uuid(input.id);if(input.action==='get')value=store.get(p,input.kind,input.id)??null;else if(input.action==='put')value=await store.put(p,input.kind,input.id,input.version,input.value);else throw Error('Invalid history action.');}res.end(JSON.stringify({value}));
 }catch(e){if(res.statusCode===200)res.statusCode=e instanceof Error&&e.message==='HISTORY_CONFLICT'?409:400;if(!res.destroyed)res.end(JSON.stringify({error:e instanceof Error?e.message:'History persistence failed.'}));}
};}
