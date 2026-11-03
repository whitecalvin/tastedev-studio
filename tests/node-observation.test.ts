import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import {nodeObservation,type ObservationInput} from '../src/features/orchestration/node-observation.ts';
import type {Agent,CoreSnapshot} from '../src/features/core/domain.ts';
import type {GraphOverview} from '../src/features/orchestration/execution.ts';
import type {Schedule} from '../src/features/scheduler/domain.ts';
import {defaultBudget} from '../src/features/ai/domain.ts';
import type {TaskAIRequest} from '../src/features/orchestration/task-ai.ts';

function fixture():ObservationInput {
 const graph=initialGraph('project');
 graph.nodes.push({...newNode('agent','worker',2),reference:'agent'},newNode('task','task',3));
 graph.edges.push({id:'host',from:'current-pc',to:'worker',relation:'hosts'},{id:'work',from:'role-implementation',to:'task',relation:'performs'});
 const agent:Agent={id:'agent',name:'Registered runtime',status:'busy',platform:'windows',architecture:'x86_64',capabilities:{cpuCores:2,memoryMiB:1024,docker:false,gpu:false,pty:false,runtimes:{},browsers:[]},lastSeenAt:'now',createdAt:'now',updatedAt:'now'};
 const context={executionId:'execution',activationId:'activation',nodeId:'task',attempt:1,revision:1};
 const snapshot:CoreSnapshot={agents:[agent],jobs:[{id:'job',projectId:'project',type:'task',name:'Test',status:'running',requirements:{},payload:{task:'verify',steps:[{name:'Verify',executable:'node',args:[],cwd:'.',env:{TASTEDEV_GRAPH_CONTEXT:JSON.stringify(context)}}]},priority:0,queuedAt:'now',createdAt:'now',updatedAt:'now',agentId:'agent',sourceJobId:null,attempt:1,maxAttempts:1,cancellationRequestedAt:null}],runs:[{id:'run',jobId:'job',projectId:'project',agentId:'agent',status:'running',startedAt:'now',finishedAt:null,exitCode:null,createdAt:'now',result:null}],steps:[{id:'step',runId:'run',name:'Verify',order:0,status:'running',startedAt:'now',finishedAt:null,exitCode:null}],artifacts:[],events:[]};
 const overview:GraphOverview={durable:true,definition:{projectId:'project',revision:1,checksum:'graph',inputChecksum:'inputs',graph,agents:{task:['agent']},publishedAt:'now'},executions:[{id:'execution',projectId:'project',revision:1,checksum:'graph',inputChecksum:'inputs',status:'running',actor:'local',createdAt:'now',deadline:'later',nodeLabels:{task:'Test'},activations:[{id:'activation',nodeId:'task',attempt:1,status:'running',runId:'run',agentId:'agent',jobId:'job'}]}]};
 return {graph,overview,snapshot,nodeId:'task',connected:true};
}
test('node projection binds current step and Run to exact execution without mutation',()=>{
 const input=fixture(),before=JSON.stringify(input),result=nodeObservation(input)!;
 assert.equal(result.work[0].runId,'run');assert.equal(result.work[0].step?.id,'step');assert.equal(result.work[0].next,'run');assert.equal(JSON.stringify(input),before);
 for(const id of ['current-pc','worker','role-implementation']){input.nodeId=id;assert.equal(nodeObservation(input)!.work[0].runId,'run');}
});
test('disconnect, dirty graph and missing explicit history never replay stale statuses',()=>{
 const input=fixture();input.connected=false;assert.deepEqual(nodeObservation(input)!.work,[]);assert.deepEqual(nodeObservation(input)!.agents,[]);
 input.connected=true;input.dirty=true;assert.equal(nodeObservation(input)!.availability,'stale');
 input.dirty=false;input.executionId='missing';assert.equal(nodeObservation(input)!.availability,'stale');
 input.executionId='';input.overview!.definition!.checksum='changed';assert.equal(nodeObservation(input)!.availability,'stale');
});
test('foreign project, wrong Agent and wrong graph context cannot become navigable Runs',()=>{
 for(const mutate of [(i:ObservationInput)=>{i.snapshot.runs[0].projectId='other';},(i:ObservationInput)=>{i.snapshot.runs[0].agentId='other';},(i:ObservationInput)=>{i.snapshot.jobs[0].payload.steps[0].env={TASTEDEV_GRAPH_CONTEXT:'{"executionId":"other"}'};},(i:ObservationInput)=>{delete i.snapshot.jobs[0].payload.steps[0].env;}]){
  const input=fixture();mutate(input);const row=nodeObservation(input)!.work[0];assert.equal(row.identityConflict,true);assert.equal(row.runId,undefined);assert.equal(row.status,'Not reported');
 }
});
test('a reported PASS without successful actual Run cannot claim verified success',()=>{
 const input=fixture();input.overview!.executions[0].activations[0].status='passed';assert.equal(nodeObservation(input)!.work[0].identityConflict,true);
 input.snapshot.runs=[];input.snapshot.jobs=[];const row=nodeObservation(input)!.work[0];assert.equal(row.status,'Not reported');assert.equal(row.runId,undefined);
});
test('a shared role never attributes a sibling Agent run to this Agent or device',()=>{
 const input=fixture();input.graph.nodes.push({...newNode('agent','other-worker',4),reference:'other-agent'},{...newNode('device','other-device',5)});
 input.graph.edges.push({id:'other-host',from:'other-device',to:'other-worker',relation:'hosts'},{id:'other-assignment',from:'other-device',to:'role-implementation',relation:'assigns'});
 input.overview!.definition!.agents.task.push('other-agent');input.nodeId='other-worker';assert.equal(nodeObservation(input)!.work[0].runId,undefined);
 input.nodeId='other-device';assert.equal(nodeObservation(input)!.work[0].status,'Not reported');
 input.nodeId='current-pc';assert.equal(nodeObservation(input)!.work[0].runId,'run');
});
test('queued work retains actual Matcher reasons and approval stays a separate next action',()=>{
 const input=fixture(),a=input.overview!.executions[0].activations[0];delete a.runId;delete a.jobId;a.status='queued';a.waitingReasons=['Required OS execution isolation capability unavailable'];
 assert.deepEqual(nodeObservation(input)!.work[0].reasons,a.waitingReasons);assert.equal(nodeObservation(input)!.work[0].next,'wait');
 input.graph.nodes.push(newNode('approval','approval',4));input.nodeId='approval';input.overview!.executions[0].activations.push({id:'review',nodeId:'approval',status:'approval',attempt:1});
 assert.equal(nodeObservation(input)!.work[0].next,'approval');
});
test('retry history stays independent and a completed task does not complete unstarted work',()=>{
 const input=fixture(),e=input.overview!.executions[0];e.activations.unshift({...e.activations[0],id:'older',attempt:0,status:'failed',runId:'older-run'});
 input.graph.nodes.push(newNode('task','later',4));input.graph.edges.push({id:'later',from:'role-implementation',to:'later',relation:'performs'});input.nodeId='current-pc';
 const work=nodeObservation(input)!.work;assert.equal(work[0].history.length,2);assert.equal(work[0].runId,'run');assert.equal(work[1].status,'Not reported');
});
test('AI identity uses captured model/connection and does not assert provider health',()=>{
 const input=fixture();const plan:TaskAIRequest={projectId:'project',nodeId:'task',label:'Implement',profileId:'profile',route:{connectionId:'connection',adapter:'codex-chatgpt' as const,model:'captured-model'},question:'Work',budget:{...defaultBudget,maxProviderRequests:1,timeoutMs:1000},maximum:1};
 // Only captured routing fields are consumed; full provider execution is a separate gate.
 input.overview!.executions[0].aiTasks={task:plan};
 assert.equal(nodeObservation(input)!.work[0].ai?.model,'captured-model');
});
test('schedule state requires matching project, graph revision/checksum and entry',()=>{
 const input=fixture();input.graph.nodes.push({...newNode('schedule','schedule',4),reference:'daily'});input.graph.edges.push({id:'trigger',from:'schedule',to:'task',relation:'triggers'});input.nodeId='schedule';
 const schedule:Schedule={id:'daily',projectId:'project',name:'Daily',testName:'test',enabled:false,trigger:{type:'manual'},timezone:'UTC',createdAt:'now',updatedAt:'now',lastTriggeredAt:null,nextRunAt:null,status:'disabled',graph:{revision:1,checksum:'graph',entryNodeId:'task'}};
 input.schedules=[schedule];assert.equal(nodeObservation(input)!.schedule?.status,'disabled');schedule.graph!.checksum='stale';assert.equal(nodeObservation(input)!.schedule?.status,'invalid');
 schedule.projectId='other';assert.equal(nodeObservation(input)!.schedule,undefined);
});

test('source adoption does not rewrite a previous Run to the latest execution Snapshot',()=>{
 const input=fixture(),checksum='a'.repeat(64),oldSource={schemaVersion:2 as const,provider:'snapshot' as const,snapshotId:'old-snapshot',projectId:'project',proposalId:'proposal',attempt:1,baseRevision:'saved',files:[],changedFiles:[],checksum};
 input.overview!.executions[0].source={...oldSource,snapshotId:'new-snapshot',checksum:'b'.repeat(64)};
 const job=input.snapshot.jobs[0];job.payload.steps[0].source={provider:'snapshot',repository:'snapshot:old-snapshot',revision:'saved',snapshot:oldSource};
 const context={executionId:'execution',activationId:'activation',nodeId:'task',attempt:1,revision:1,snapshotId:'old-snapshot',sourceChecksum:checksum};
 job.payload.steps[0].env={TASTEDEV_GRAPH_CONTEXT:JSON.stringify(context)};
 input.snapshot.runs[0].revision={repository:'snapshot:old-snapshot',branch:'saved',commit:checksum,snapshotId:'old-snapshot'};
 const row=nodeObservation(input)!.work[0];assert.equal(row.identityConflict,false);assert.equal(row.source?.snapshotId,'old-snapshot');assert.equal(row.source?.checksum,checksum);
 context.sourceChecksum='stale';job.payload.steps[0].env={TASTEDEV_GRAPH_CONTEXT:JSON.stringify(context)};assert.equal(nodeObservation(input)!.work[0].identityConflict,true);
});

test('cleanup warnings remain visible alongside the actual Run status',()=>{
 const input=fixture();input.snapshot.runs[0].cleanupWarning='Owned cleanup requires review';
 assert(nodeObservation(input)!.work[0].reasons.includes('Owned cleanup requires review'));
});
