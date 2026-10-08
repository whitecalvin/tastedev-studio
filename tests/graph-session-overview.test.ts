import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionGraphOverview} from '../src/features/orchestration/session-overview.ts';
import {graphControlRequest} from '../src/features/orchestration/control.ts';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import type {GraphOverview} from '../src/features/orchestration/execution.ts';

function fixture():GraphOverview {
 const graph=initialGraph('p');graph.nodes.push(newNode('approval','gate',1));
 return {durable:true,definition:{graph,projectId:'p',revision:1,checksum:'hash',inputChecksum:'input',publishedAt:'now',agents:{}},executions:[{id:'e',projectId:'p',revision:1,checksum:'hash',inputChecksum:'input',status:'paused',actor:'actor',createdAt:'now',deadline:'2099-01-01T00:00:00Z',nodeLabels:{gate:'Gate'},activations:[{id:'a',nodeId:'gate',attempt:1,status:'approval'}]}]};
}
test('only the connected current Core session exposes project history',()=>{
 const overview=fixture(),before=JSON.stringify(overview);
 assert.equal(sessionGraphOverview(overview,2,2,'p',true),overview);
 assert.equal(sessionGraphOverview(overview,2,3,'p',true),null);
 assert.equal(sessionGraphOverview(overview,2,2,'p',false),null);
 assert.equal(sessionGraphOverview(null,2,2,'p',true),null);
 assert.equal(JSON.stringify(overview),before);
});
test('mixed project definitions and executions cannot be shown or controlled',()=>{
 for(const change of [(v:GraphOverview)=>{v.definition!.projectId='other';},(v:GraphOverview)=>{v.definition!.graph.projectId='other';},(v:GraphOverview)=>{v.executions[0].projectId='other';}]){
  const overview=fixture();change(overview);assert.equal(sessionGraphOverview(overview,2,2,'p',true),null);
 }
});
test('reconnected history cannot resume until refreshed and explicitly reviewed',()=>{
 const overview=fixture(),graph=overview.definition!.graph,input={executionId:'e',nodeId:'gate',action:'resume' as const,connected:true,dirty:false,reviewed:true};
 assert.throws(()=>graphControlRequest(graph,sessionGraphOverview(overview,1,2,'p',true),input),/unavailable/);
 const refreshed=sessionGraphOverview(overview,2,2,'p',true);
 assert.throws(()=>graphControlRequest(graph,refreshed,{...input,reviewed:false}),/Review this/);
 assert.deepEqual(graphControlRequest(graph,refreshed,input),{action:'resume',input:{executionId:'e'}});
});
