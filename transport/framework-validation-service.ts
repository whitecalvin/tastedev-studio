import type {CoreService} from '../src/features/core/service.ts';
import type {FrameworkSessions} from './framework-sessions.ts';
import type {SourceSnapshotStore} from './source-snapshot-store.ts';
import {projectReference,type ProjectSnapshot} from '../src/features/ai/project-snapshot.ts';
import {projectSnapshotLimits} from '../src/features/ai/snapshot-bytes.ts';
import {sourceContentHash} from '../src/features/core/source-identity.ts';
import {validatePayload} from '../src/features/core/matcher.ts';
import {retryHash,validationRetryPlan,validationRetryRequest,validationRetrySource} from './framework-validation-retry.ts';
/** The caller enforces run/approval ACLs. No caller-provided executable, source body or plan is accepted. */
export async function retryFrameworkValidation(core:CoreService,sessions:FrameworkSessions,store:SourceSnapshotStore,resolve:(s:ProjectSnapshot,p:string)=>Promise<ProjectSnapshot>,projectId:string,input:unknown,actor?:string){
 const raw=input as {sessionId?:string},session=sessions.list(projectId).find(s=>s.id===raw?.sessionId),requestId=validationRetryRequest(session,input);
 if(!session)throw Error('Framework session missing.');
 const state=core.snapshot(projectId),run=state.runs.find(r=>r.id===session.scope.runId),job=state.jobs.find(j=>j.id===run?.jobId);
 if(!run||!['failed','cancelled','timeout'].includes(run.status)||!job)throw Error('Stopped original validation required.');
 const plan=validationRetryPlan(job),planHash=retryHash([job.requirements,plan]),key='framework-validation:'+session.id+':'+requestId;
 const existing=state.jobs.find(j=>j.idempotencyKey===key),prior=session.validationAttempts?.find(a=>a.requestId===requestId);
 if(existing){
  const ref=existing.payload.steps[0]?.source;if(!prior||prior.planHash!==planHash||prior.jobId!==undefined&&prior.jobId!==existing.id||ref?.provider!=='snapshot'||ref.snapshot.snapshotId!==prior.snapshotId||ref.snapshot.checksum!==prior.snapshotChecksum||existing.pinnedAgentId!==session.scope.agentId||existing.maxAttempts!==1||retryHash(existing.requirements)!==retryHash(job.requirements))throw Error('Validation retry identity conflict.');
  const expected=structuredClone(plan);expected.steps[0].source=structuredClone(ref);if(retryHash(existing.payload)!==retryHash(validatePayload({task:'framework-validation',steps:expected.steps,testPlan:expected})))throw Error('Validation retry plan conflict.');
  sessions.linkValidationRetry(projectId,session.id,requestId,{jobId:existing.id});return existing;
 }
 if(state.jobs.some(j=>j.idempotencyKey?.startsWith('framework-validation:'+session.id+':')&&['queued','assigned','running'].includes(j.status)))throw Error('Validation retry already active.');
 if(state.agents.find(a=>a.id===session.scope.agentId)?.status!=='idle')throw Error('Select the original available Agent.');
 const source=job.payload.steps.find(s=>s.source?.provider==='snapshot')?.source;
 if(source?.provider!=='snapshot'||source.snapshot.schemaVersion!==2)throw Error('Original Snapshot required.');
 const base=await resolve(source.snapshot as ProjectSnapshot,projectId);
 // Validate the seal and all changes before consuming an approval attempt.
 await validationRetrySource(session,job,base,requestId,prior?.attempt??2);
 const fresh=sessions.list(projectId).find(s=>s.id===session.id)!,pending=fresh.validationAttempts?.find(a=>!a.jobId&&a.requestId!==requestId),active=core.snapshot(projectId).jobs.some(j=>j.idempotencyKey?.startsWith('framework-validation:'+session.id+':')&&['queued','assigned','running'].includes(j.status));
 if(pending||active)throw Error('Validation retry already active or preparing.');
 const approval=sessions.approveValidationRetry(projectId,session.id,requestId,session.effectiveSourceChecksum!,planHash);
 const {snapshot,bodies}=await validationRetrySource(session,job,base,requestId,approval.attempt);
 sessions.linkValidationRetry(projectId,session.id,requestId,{snapshotId:snapshot.snapshotId,snapshotChecksum:snapshot.checksum,contentChecksum:await sourceContentHash(snapshot)});
 await store.begin(snapshot);
 for(const [checksum,body]of bodies){let offset=await store.progress(projectId,snapshot.snapshotId,checksum);while(offset<body.length||body.length===0&&offset===0){const chunk=body.subarray(offset,offset+projectSnapshotLimits.chunkBytes),result=await store.append(projectId,snapshot.snapshotId,checksum,offset,(async function*(){yield chunk;})(),await import('node:crypto').then(({createHash})=>createHash('sha256').update(chunk).digest('hex')));offset=result.offset;if(result.complete)break;}}
 await store.complete(projectId,snapshot.snapshotId);
 const sourceStep=plan.steps[0];sourceStep.source={provider:'snapshot',repository:'snapshot:'+snapshot.snapshotId,revision:snapshot.baseRevision,snapshot:projectReference(snapshot)};
 const created=await core.createJob(projectId,{name:'Validate saved native Source: '+job.name,pinnedAgentId:session.scope.agentId,requirements:job.requirements,maxAttempts:1,idempotencyKey:key,payload:{task:'framework-validation',steps:plan.steps,testPlan:plan}},actor);
 sessions.linkValidationRetry(projectId,session.id,requestId,{jobId:created.id});return created;
}
