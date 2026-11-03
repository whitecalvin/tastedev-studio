import {createHash} from 'node:crypto';
import type {FrameworkSession} from '../src/features/frameworks/session.ts';
import {frameworkTurnCompleted} from '../src/features/frameworks/session.ts';
import {frameworkChanges} from '../src/features/frameworks/integration.ts';
import {frameworkOperation} from '../src/features/frameworks/operation.ts';
import {projectManifest,verifyProjectManifest,type ProjectSnapshot} from '../src/features/ai/project-snapshot.ts';
import {snapshotHasSecret} from '../src/features/ai/snapshot-content-policy.ts';
import {frameworkSourceHash} from './framework-sessions.ts';
import type {Job} from '../src/features/core/domain.ts';
export const retryHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function validationRetryRequest(session:FrameworkSession|undefined,value:unknown){
 const v=value as Record<string,unknown>;const keys=['sessionId','nativeSessionId','workspaceId','configurationChecksum','sourceChecksum','requestId'];
 if(!session||!v||Object.keys(v).some(k=>!keys.includes(k))||!frameworkTurnCompleted(session)||!session.effectiveSourceChecksum||v.sessionId!==session.id||v.nativeSessionId!==session.nativeSessionId||v.workspaceId!==session.scope.workspaceId||v.configurationChecksum!==session.scope.configurationChecksum||v.sourceChecksum!==session.effectiveSourceChecksum||typeof v.requestId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v.requestId))throw Error('Exact sealed native validation approval required.');
 return v.requestId;
}
/** Reconstruct only server-recorded text changes. Never read a live Agent tree or replay the model. */
export async function validationRetrySource(session:FrameworkSession,job:Job,base:ProjectSnapshot,requestId:string,attempt:number){
 const original=job.payload.steps.find(s=>s.framework)?.framework,operation=frameworkOperation(original),changes=frameworkChanges(session);
 if(job.projectId!==session.scope.projectId||base.projectId!==session.scope.projectId||base.checksum!==session.scope.sourceChecksum||retryHash([operation,base.checksum])!==session.scope.configurationChecksum||!frameworkTurnCompleted(session)||frameworkSourceHash(base.checksum,session.scope.manifest,changes.slice().sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0).map(c=>[c.path,c.afterHash]))!==session.effectiveSourceChecksum)throw Error('Sealed native Source mismatch.');
 const files=new Map(base.files.map(f=>[f.path,{...f,content:''}])),bodies=new Map<string,Buffer>();
 if(new Set(changes.map(c=>c.path)).size!==changes.length)throw Error('Duplicate native changes.');
 const secrets=job.payload.steps.flatMap(s=>Object.values(s.env??{}));
 for(const c of changes){if(!operation.writablePaths.includes(c.path)||c.manualReview||c.beforeHash!==(files.get(c.path)?.checksum??null)||c.afterHash!==(c.content===null?null:createHash('sha256').update(c.content).digest('hex')))throw Error('Native change precondition mismatch.');if(c.content===null){files.delete(c.path);continue;}if(snapshotHasSecret(c.path,c.content,secrets))throw Error('Native Source secret excluded.');const bytes=Buffer.from(c.content);files.set(c.path,{path:c.path,content:'',encoding:'utf8',size:bytes.length,checksum:c.afterHash!});bodies.set(c.afterHash!,bytes);}
 const snapshot:ProjectSnapshot={schemaVersion:2,provider:'snapshot',snapshotId:requestId,projectId:base.projectId,proposalId:session.id,attempt,baseRevision:base.baseRevision,changedFiles:changes.filter(c=>c.content!==null).map(c=>c.path).sort(),files:[...files.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),checksum:''};
 snapshot.checksum=createHash('sha256').update(projectManifest(snapshot)).digest('hex');await verifyProjectManifest(snapshot);return {snapshot,bodies};
}
export function validationRetryPlan(job:Job){
 const plan=structuredClone(job.payload.testPlan);if(!plan||job.payload.steps.filter(s=>s.framework).length!==1)throw Error('Original framework TestPlan required.');
 const test=job.payload.steps.find(s=>s.executable==='internal-framework-godot');if(!test||test.stage!=='test'||test.cwd!=='source'||Object.keys(test.env??{}).length||test.browser||test.framework||test.source)throw Error('Original bounded Godot test required.');
 const source=job.payload.steps.find(s=>s.source?.provider==='snapshot');if(!source||job.payload.steps.some(s=>!['source','build','test','cleanup'].includes(s.stage??'')))throw Error('Original validation plan mismatch.');
 plan.steps=[structuredClone(source),structuredClone(test),{name:'Cleanup',stage:'cleanup',executable:'internal-stop-services',args:[],cwd:'.',timeoutMs:10000}];return plan;
}
