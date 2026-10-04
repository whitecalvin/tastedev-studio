import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {taskAIRequest,reviewedTaskAI,graphAIConfigurationMatches} from '../src/features/orchestration/task-ai.ts';
import {emptyAIConfigurations,newAIConfiguration} from '../src/features/orchestration/ai-config.ts';
import type {GraphNode,ProjectGraph} from '../src/features/orchestration/domain.ts';
import type {ManagedAIConnection} from '../src/features/ai/routing.ts';
import {HistoryStore} from '../transport/history.ts';
import {AIError,type AnalysisRecord} from '../src/features/ai/domain.ts';
const projectId=randomUUID(),node:GraphNode={id:'task-a',kind:'task',label:'Implementation',x:0,y:0,reference:'build',role:'implementation',taskType:'task'};
const entry:ManagedAIConnection={id:'ollama-local',provider:'local',adapter:'ollama-local',connection:'local',model:'fixture-model'};
const store={...emptyAIConfigurations(projectId),profiles:[{...newAIConfiguration('local'),provider:'local' as const,connection:'local' as const,connectionRef:entry.id}],bindings:{[node.id]:'local'}};
test('task execution resolves exact saved binding, prompt and budget',()=>{const p=taskAIRequest(store,node,[entry]);assert.equal(p.nodeId,node.id);assert.equal(p.projectId,projectId);assert.equal(p.route.model,entry.model);assert.match(p.question,/Task: Implementation/);assert.equal(p.budget.maxProviderRequests,6);assert.equal(p.maximum,3);});
test('missing binding, incompatible provider, unsupported device and non-task cannot execute',()=>{
 for(const value of [{...store,bindings:{}},{...store,profiles:[{...store.profiles[0],provider:'google' as const}]},{...store,profiles:[{...store.profiles[0],location:'device' as const}]}])assert.throws(()=>taskAIRequest(value,node,[entry]),AIError);
 assert.throws(()=>taskAIRequest(store,{...node,kind:'device'},[entry]),AIError);assert.throws(()=>taskAIRequest(store,node,[]),AIError);
});
test('cancelled review and stale/disconnected scopes send no model request',async()=>{
 const p=taskAIRequest(store,node,[entry]);let runs=0;assert.equal(await reviewedTaskAI(p,async()=>false,()=>true,async()=>{runs++;}),'cancelled');await assert.rejects(reviewedTaskAI(p,async()=>true,()=>false,async()=>{runs++;}),AIError);assert.equal(runs,0);
});
test('approval pins the reviewed route/prompt against changes while review is open',async()=>{
 const p=taskAIRequest(store,node,[entry]);let resolve!:(value:boolean)=>void;const approval=new Promise<boolean>(r=>{resolve=r;});let received='';const work=reviewedTaskAI(p,()=>approval,()=>true,async value=>{received=value.question;assert.equal(value.route.model,'fixture-model');});p.question='changed';p.route.model='wrong';resolve(true);assert.equal(await work,'submitted');assert.match(received,/Task: Implementation/);
});
test('task prompt and lineage mask dummy credentials',()=>{const p=taskAIRequest(store,{...node,label:'token=dummy-test-value'},[entry]);assert.ok(!p.question.includes('dummy-test-value'));assert.ok(!p.label.includes('dummy-test-value'));});
test('node analysis lineage persists independently and malformed lineage is rejected',async()=>{
 const history=new HistoryStore(),record:AnalysisRecord={id:randomUUID(),projectId,conversationId:randomUUID(),model:'fixture-model',createdAt:new Date().toISOString(),context:[],originals:{},task:{nodeId:node.id,label:node.label,profileId:'local'},result:{summary:'Grounded analysis',observedFailure:'',candidates:[],evidence:[],relatedFiles:[],proposal:[],uncertainty:'Not runtime verified'}};
 await history.put(projectId,'analysis',record.id,0,record);assert.deepEqual((history.get(projectId,'analysis',record.id)?.value as AnalysisRecord).task,record.task);
 const another={...record,id:randomUUID(),task:{...record.task!,nodeId:'task-b'}};await history.put(projectId,'analysis',another.id,0,another);assert.equal(history.list(projectId,'analysis').length,2);
 await assert.rejects(history.put(projectId,'analysis',randomUUID(),0,{...record,id:randomUUID(),task:{...record.task!,nodeId:'../escape'}}));
 const bad={...record,id:randomUUID(),task:{...record.task!,label:'x'.repeat(121)}};await assert.rejects(history.put(projectId,'analysis',bad.id,0,bad),/Invalid task analysis/);
});

test('changed completion policy, prompt or route invalidates published AI scope; unused profiles do not',()=>{
 const graph:ProjectGraph={version:1,projectId,projectKind:'web',retryLimit:3,nodes:[node],edges:[]},published={[node.id]:taskAIRequest(store,node,[entry])};assert.equal(graphAIConfigurationMatches(store,graph,published,[entry]),true);
 for(const patch of [{completion:'verified-fix' as const},{prompt:'Different reviewed prompt'},{maxRequests:2}])assert.equal(graphAIConfigurationMatches({...store,profiles:[{...store.profiles[0],...patch}]},graph,published,[entry]),false);
 assert.equal(graphAIConfigurationMatches({...store,profiles:[{...store.profiles[0],completion:'analysis'}]},graph,published,[entry]),true);assert.equal(graphAIConfigurationMatches({...store,profiles:[...store.profiles,newAIConfiguration('unused')]},graph,published,[entry]),true);assert.equal(graphAIConfigurationMatches(store,graph,published,[]),false);assert.equal(graphAIConfigurationMatches({...store,bindings:{missing:'local'}},graph,published,[entry]),false);
});
