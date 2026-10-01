import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import type { CoreService } from '../src/features/core/service.ts';
import {activeRun,type BrowserResult} from '../src/features/core/domain.ts';
import { LocalArtifactStore, artifactId, artifactMime, ARTIFACT_LIMIT } from './artifact-store.ts';
const equal=(a:string,b:string)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
export interface ArtifactGrant {runId:string;stepId:string;projectId:string;expires:number}
export interface GrantPersistence {load():[string,ArtifactGrant][];save(grants:[string,ArtifactGrant][]):void}
export function artifactGateway(service:CoreService,root:string,studioToken:string,origins:string[],persistence?:GrantPersistence){
 const store=new LocalArtifactStore(root),grants=new Map<string,ArtifactGrant>(persistence?.load()??[]);
 function commit(next:Map<string,ArtifactGrant>){persistence?.save([...next]);grants.clear();for(const [key,value]of next)grants.set(key,value);}
 function grant(runId:string,stepId:string,base:string){const next=new Map(grants);for(const [key,value]of next)if(value.expires<Date.now())next.delete(key);const run=service.repository.read().runs.find(r=>r.id===runId)!;const token=randomBytes(32).toString('hex');next.set(token,{runId,stepId,projectId:run.projectId,expires:Date.now()+3700000});commit(next);return{url:`${base}/artifacts/${runId}/${stepId}`,token};}
 function revoke(stepId:string){const next=new Map(grants);for(const [key,value]of next)if(value.stepId===stepId)next.delete(key);if(next.size!==grants.size)commit(next);}
 async function handle(req:IncomingMessage,res:ServerResponse){
  try{
   if(req.headers.origin&&!origins.includes(req.headers.origin)){res.writeHead(403).end();return;}
   if(req.headers.origin)res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
   res.setHeader('Vary','Origin');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
   res.setHeader('Access-Control-Expose-Headers','ETag,Content-Range,Accept-Ranges');
   if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET,DELETE,PUT,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization,X-Project-Id,Range,If-Match,Content-Type,X-Artifact-Type,X-Artifact-Name,X-Artifact-Size,X-Artifact-Checksum');res.writeHead(204).end();return;}
   const parts=(req.url??'').split('/');if(parts[1]!=='artifacts'){res.writeHead(404).end();return;}
   const runId=artifactId(parts[2]),token=(req.headers.authorization??'').replace(/^Bearer /,'');
   if(req.method==='PUT'&&parts.length===5){
    const stepId=artifactId(parts[3]),id=artifactId(parts[4]),g=grants.get(token);const snapshot=service.repository.read();
    if(!g||g.expires<Date.now()||g.runId!==runId||g.stepId!==stepId||snapshot.steps.find(s=>s.id===stepId)?.status!=='running'){res.writeHead(403).end();return;}
    const size=Number(req.headers['x-artifact-size']);if(!Number.isSafeInteger(size)||size<1||size>ARTIFACT_LIMIT){res.writeHead(413).end();return;}
    const type=String(req.headers['x-artifact-type']);if(!Object.hasOwn(artifactMime,type)){res.writeHead(400).end();return;}
    req.setTimeout(15000,()=>req.destroy());
    const meta=await store.put({id,runId,runStepId:stepId,projectId:g.projectId,type:type as keyof typeof artifactMime,name:String(req.headers['x-artifact-name']),mimeType:artifactMime[type as keyof typeof artifactMime],size,checksum:String(req.headers['x-artifact-checksum']),createdAt:new Date().toISOString(),location:''},req);
    service.repository.transaction(tx=>{if(tx.steps.get(stepId)?.status==='running')tx.artifacts.save(meta);});
    res.writeHead(201,{'Content-Type':'application/json'}).end(JSON.stringify({id:meta.id,size:meta.size,checksum:meta.checksum}));return;
   }
   if(!equal(token,studioToken)){res.writeHead(403).end();return;}
   const id=artifactId(parts[3]);if(parts.length!==4){res.writeHead(404).end();return;}
   const snapshot=service.repository.read(),reference=snapshot.artifacts.find(a=>a.id===id&&a.runId===runId),run=snapshot.runs.find(r=>r.id===runId);
   if(!reference||!run||run.projectId!==req.headers['x-project-id']){res.writeHead(404).end();return;}
   if(req.headers['if-match']&&req.headers['if-match']!==`"${reference.checksum}"`){res.writeHead(412).end();return;}
   if(req.method==='DELETE'){
    if(activeRun(run)){res.writeHead(409).end();return;}
    if(req.headers['if-match']!==`"${reference.checksum}"`){res.writeHead(412).end();return;}
    if(!reference.deletedAt){await store.get(runId,id);service.repository.transaction(tx=>{const current=tx.artifacts.get(id)!;if(current.checksum!==reference.checksum||activeRun(tx.runs.get(runId)!))throw Error('Evidence changed before deletion.');tx.artifacts.save({...current,deletedAt:new Date().toISOString()});});}
    await store.purge(runId,id);res.writeHead(204).end();return;
   }
   if(reference.deletedAt){res.writeHead(410).end();return;}
   const value=await store.get(runId,id);
   if(value.meta.projectId!==req.headers['x-project-id']){res.writeHead(403).end();return;}
   if(req.method==='GET'){
    const headers={'Content-Type':value.meta.mimeType,'ETag':`"${value.meta.checksum}"`,'Accept-Ranges':'bytes','Content-Disposition':`attachment; filename="${value.meta.name}"`};
    if(req.headers.range){const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!range||req.headers['if-match']!==`"${value.meta.checksum}"`){res.writeHead(412).end();return;}const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),value.bytes.length-1):value.bytes.length-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=value.bytes.length){res.writeHead(416,{'Content-Range':`bytes */${value.bytes.length}`}).end();return;}res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${value.bytes.length}`});res.end(value.bytes.subarray(start,end+1));return;}
    res.writeHead(200,{...headers,'Content-Length':value.bytes.length});res.end(value.bytes);return;
   }
   res.writeHead(405).end();
  }catch(e){if(!res.headersSent)res.writeHead((e as NodeJS.ErrnoException).code==='ENOENT'?404:400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Artifact operation failed: check identity, integrity, storage and limits.'}));}
 }
 return {handle,grant,revoke,store};
}
export function browserResult(input:unknown,secrets:string[]):BrowserResult{
 if(!input||typeof input!=='object'||JSON.stringify(input).length>32768)throw Error('Invalid browser result');
 const v=input as BrowserResult;for(const key of ['total','passed','failed','skipped','duration','consoleErrors','pageErrors','networkFailures'] as const)if(!Number.isFinite(v[key])||v[key]<0||v[key]>3600000)throw Error('Invalid browser counts');
 if(v.total!==v.passed+v.failed+v.skipped||!Array.isArray(v.failures)||v.failures.length>20||!Array.isArray(v.evidenceWarnings)||v.evidenceWarnings.length>80)throw Error('Invalid browser result');
 const clean=(text:unknown)=>{let s=typeof text==='string'?text.slice(0,4000):'';for(const secret of secrets.filter(Boolean))s=s.split(secret).join('[redacted]');return s.replace(/(authorization|password|token|secret)\s*[:=]\s*\S+/gi,'$1=[redacted]');};
 return {total:v.total,passed:v.passed,failed:v.failed,skipped:v.skipped,duration:v.duration,consoleErrors:v.consoleErrors,pageErrors:v.pageErrors,networkFailures:v.networkFailures,browserVersion:clean(v.browserVersion),playwrightVersion:clean(v.playwrightVersion),classification:clean(v.classification),failures:v.failures.map(f=>({name:clean(f.name),message:clean(f.message),stack:clean(f.stack),location:clean(f.location)})),evidenceWarnings:v.evidenceWarnings.map(clean)};
}
