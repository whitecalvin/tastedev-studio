import test from 'node:test';
import assert from 'node:assert/strict';
import {auditRecovery,recoveryReviewKey} from '../src/features/orchestration/recovery-audit.ts';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import type {GraphExecution,GraphOverview} from '../src/features/orchestration/execution.ts';
import type {ProjectSnapshot} from '../src/features/ai/project-snapshot.ts';
import type {Job,Run} from '../src/features/core/domain.ts';
function fixture(){
 const graph=initialGraph('p');graph.nodes.push({...newNode('task','task',1),reference:'unit'});
 const source:ProjectSnapshot={schemaVersion:2,provider:'snapshot',snapshotId:'snapshot',projectId:'p',proposalId:'proposal',attempt:1,baseRevision:'tree',files:[],changedFiles:[],checksum:'a'.repeat(64)};
 const e:GraphExecution={id:'execution',projectId:'p',revision:1,checksum:'b'.repeat(64),inputChecksum:'c'.repeat(64),status:'paused',actor:'user',createdAt:'2026-11-03',deadline:'2026-11-04',definition:{projectId:'p',revision:1,checksum:'b'.repeat(64),inputChecksum:'c'.repeat(64),publishedAt:'2026-11-03',graph,source,agents:{task:['agent']},plans:{}},activations:[{id:'activation',nodeId:'task',attempt:1,status:'passed',agentId:'agent',jobId:'job',runId:'run'}]};
 const job={id:'job',projectId:'p',payload:{steps:[{source:{provider:'snapshot',snapshot:source},env:{TASTEDEV_GRAPH_CONTEXT:JSON.stringify({executionId:e.id,activationId:'activation',nodeId:'task',attempt:1,revision:1,snapshotId:source.snapshotId,sourceChecksum:source.checksum})}}]}} as unknown as Job;
 const run={id:'run',projectId:'p',jobId:'job',agentId:'agent',status:'passed',exitCode:0,finishedAt:'2026-11-03',revision:{snapshotId:source.snapshotId,commit:source.checksum}} as Run;
 return{e,job,run,read:{job:()=>job,run:()=>run}};
}
test('read-only audit retains an exact successful Job/Run/Source without authorizing execution',()=>{
 const f=fixture(),before=JSON.stringify(f);const report=auditRecovery(f.e,f.read);assert(report.ready);assert.equal(report.rows[0].state,'retained');assert.equal(report.executionAuthorized,false);assert.equal(JSON.stringify(f),before);
});
test('foreign identities, incomplete success, context spoof and corrupted payload block recovery',()=>{
 for(const change of [(f:ReturnType<typeof fixture>)=>{f.run.projectId='other';},(f:ReturnType<typeof fixture>)=>{f.job.projectId='other';},(f:ReturnType<typeof fixture>)=>{f.run.agentId='other';},(f:ReturnType<typeof fixture>)=>{f.run.status='failed';},(f:ReturnType<typeof fixture>)=>{f.job.payload.steps[0].env!.TASTEDEV_GRAPH_CONTEXT='{}';},(f:ReturnType<typeof fixture>)=>{f.job.payload.steps=undefined as never;}]){const f=fixture();change(f);assert.equal(auditRecovery(f.e,f.read).ready,false);}
 const f=fixture();assert.equal(auditRecovery(f.e,{...f.read,run:()=>undefined}).ready,false);
});
test('Source corruption blocks, but approved adoption preserves the earlier successful Source',()=>{
 const f=fixture();f.run.revision!.commit='d'.repeat(64);assert.equal(auditRecovery(f.e,f.read).ready,false);
 const g=fixture(),prior=g.e.definition.source!;g.e.definition.source={...prior,snapshotId:'accepted-source',checksum:'d'.repeat(64)};
 assert.equal(auditRecovery(g.e,g.read).ready,false);
 g.e.sourceAdoptions=[{activationId:'fix',proposalId:'proposal',fromSnapshotId:prior.snapshotId,fromChecksum:prior.checksum,toSnapshotId:'accepted-source',checksum:'d'.repeat(64),actor:'user',approvedAt:'2026-11-03',runId:'retest'}];
 assert(auditRecovery(g.e,g.read).ready);assert.equal(auditRecovery(g.e,g.read).rows[0].source?.snapshotId,'snapshot');
});
test('pending unlinked intent remains recoverable and terminal pending Run reconciles without replay',()=>{
 const f=fixture();f.e.activations[0]={id:'intent',nodeId:'task',attempt:1,status:'launching'};assert(auditRecovery(f.e,f.read).ready);
 const g=fixture();g.e.activations[0].status='running';const r=auditRecovery(g.e,g.read);assert(r.ready);assert.equal(r.rows[0].state,'reconcile');
});
test('recovery review changes with Source, deadline, sibling progress and connection generation',()=>{
 const {e}=fixture();const execution={...e,definition:undefined,nodeLabels:{task:'Task'},source:e.definition.source} as GraphOverview['executions'][number];
 const key=recoveryReviewKey(1,execution,'task');
 for(const modified of [{...execution,deadline:'2026-11-05'},{...execution,source:{...execution.source!,checksum:'d'.repeat(64)}},{...execution,activations:[...execution.activations,{id:'sibling',nodeId:'task2',attempt:1,status:'ready' as const}]}])assert.notEqual(recoveryReviewKey(1,modified,'task'),key);
 assert.notEqual(recoveryReviewKey(2,execution,'task'),key);
});
test('prototype-named nodes cannot impersonate a saved AI task and bypass Run evidence',()=>{
 const {e,read}=fixture();e.definition.graph.nodes.find(n=>n.id==='task')!.id='constructor';e.definition.aiTasks={};
 e.activations=[{id:'prototype-control',nodeId:'constructor',attempt:1,status:'passed'}];
 const report=auditRecovery(e,read);assert.equal(report.ready,false);assert.equal(report.rows[0].kind,'not-started');assert.equal(report.rows[0].state,'blocked');
});
