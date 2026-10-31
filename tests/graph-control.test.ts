import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import {graphControlRequest} from '../src/features/orchestration/control.ts';
import type {GraphOverview} from '../src/features/orchestration/execution.ts';

function fixture() {
 const graph=initialGraph('p');graph.nodes.push(newNode('approval','gate',1));
 const overview:GraphOverview={durable:true,definition:{graph,projectId:'p',revision:2,checksum:'hash',inputChecksum:'inputs',publishedAt:'now',agents:{}},executions:[{id:'e',projectId:'p',revision:2,checksum:'hash',inputChecksum:'inputs',actor:'actor',createdAt:'now',deadline:'2099-01-01T00:00:00Z',status:'running',nodeLabels:{gate:'Gate'},activations:[{id:'a',nodeId:'gate',attempt:1,status:'approval'}]}]};
 const input={executionId:'e',nodeId:'gate',action:'approve' as const,connected:true,dirty:false,reviewed:true};
 return {graph,overview,input};
}
test('node approval binds the exact execution, activation, revision and checksum',()=>{
 const {graph,overview,input}=fixture(),before=JSON.stringify(overview);
 assert.deepEqual(graphControlRequest(graph,overview,input),{action:'approve',input:{executionId:'e',activationId:'a',revision:2,checksum:'hash'}});
 assert.equal(JSON.stringify(overview),before);
});
test('approval requires connection, explicit execution, review and saved compatible graph',()=>{
 const {graph,overview,input}=fixture();
 for(const override of [{connected:false},{executionId:''},{reviewed:false},{dirty:true}])assert.throws(()=>graphControlRequest(graph,overview,{...input,...override}));
 const changed=structuredClone(graph);changed.nodes[0].label='user change';
 assert.throws(()=>graphControlRequest(changed,overview,input),/saved graph/);
 overview.executions[0].checksum='stale';
 assert.throws(()=>graphControlRequest(graph,overview,input),/saved graph/);
});
test('approval cannot target another project, missing node or completed activation',()=>{
 const {graph,overview,input}=fixture();
 assert.throws(()=>graphControlRequest(graph,overview,{...input,nodeId:'current-pc'}),/not waiting/);
 overview.executions[0].activations[0].status='passed';
 assert.throws(()=>graphControlRequest(graph,overview,input),/not waiting/);
 overview.executions[0].projectId='other';
 assert.throws(()=>graphControlRequest(graph,overview,input),/unavailable/);
});
test('latest approval retry uses a fresh activation identity',()=>{
 const {graph,overview,input}=fixture();
 overview.executions[0].activations.push({id:'a2',nodeId:'gate',attempt:2,status:'approval'});
 assert.equal(graphControlRequest(graph,overview,input).input.activationId,'a2');
});
test('resume requires paused state and new review',()=>{
 const {graph,overview,input}=fixture(),resume={...input,action:'resume' as const};
 assert.throws(()=>graphControlRequest(graph,overview,resume),/paused/);
 overview.executions[0].status='paused';
 assert.throws(()=>graphControlRequest(graph,overview,{...resume,reviewed:false}),/Review this/);
 assert.deepEqual(graphControlRequest(graph,overview,resume),{action:'resume',input:{executionId:'e'}});
});
test('cancel stops the explicit active execution even if the editor has changed',()=>{
 const {graph,overview,input}=fixture();graph.nodes[0].label='edited';
 assert.deepEqual(graphControlRequest(graph,overview,{...input,action:'cancel',dirty:true,reviewed:false}),{action:'cancel',input:{executionId:'e'}});
 overview.executions[0].status='passed';
 assert.throws(()=>graphControlRequest(graph,overview,{...input,action:'cancel'}),/finished/);
});

test('deployment retry returns to fresh approval and rejects changed source or exhausted retry budget',async()=>{
 const {retryPlan}=await import('../src/features/orchestration/recovery.ts');const {graph,overview,input}=fixture(),e=overview.executions[0],d=overview.definition!;
 graph.nodes.push({...newNode('task','deploy',2),role:'deployment'});graph.edges.push({id:'release',from:'gate',to:'deploy',relation:'success'});d.deploymentNodes=['deploy'];e.status='failed';e.activations[0].status='passed';e.activations[0].approvedAt='now';e.activations.push({id:'failed',nodeId:'deploy',status:'failed',attempt:1});
 assert.deepEqual(retryPlan(e,d,'deploy'),{blocked:null,target:'gate'});
 assert.equal(graphControlRequest(graph,overview,{...input,nodeId:'deploy',action:'retry-failed'}).action,'retry-failed');
 d.source={snapshotId:'new',checksum:'new'} as NonNullable<typeof d.source>;assert.match(retryPlan(e,d,'deploy').blocked!,/saved graph/);delete d.source;
 e.activations.push({id:'old-gate',nodeId:'gate',status:'passed',attempt:2},{id:'old-gate-3',nodeId:'gate',status:'passed',attempt:3});assert.match(retryPlan(e,d,'deploy').blocked!,/Retry limit/);
});
