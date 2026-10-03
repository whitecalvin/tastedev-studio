import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGraph, newNode } from '../src/features/orchestration/domain.ts';
import { graphMonitor } from '../src/features/orchestration/monitor.ts';
import type { GraphOverview } from '../src/features/orchestration/execution.ts';

function fixture() {
  const graph=initialGraph('project');
  graph.nodes.unshift(newNode('task','build',1));
  const overview:GraphOverview={durable:true,definition:{projectId:'project',revision:1,checksum:'graph-hash',inputChecksum:'input-hash',graph,agents:{},publishedAt:'2026-10-03'},executions:[{id:'execution',projectId:'project',revision:1,checksum:'graph-hash',inputChecksum:'input-hash',status:'running',actor:'test',createdAt:'2026-10-03',deadline:'2026-10-03',nodeLabels:{},activations:[{id:'attempt-1',nodeId:graph.nodes[0].id,attempt:1,status:'failed',runId:'run-1'},{id:'attempt-2',nodeId:graph.nodes[0].id,attempt:2,status:'running',runId:'run-2'}]}]};
  return {graph,overview};
}
test('monitor selects newest attempt without changing previous history',()=>{
  const {graph,overview}=fixture(),before=JSON.stringify(overview);
  const result=graphMonitor(graph,overview);
  assert.equal(result.compatible,true);
  assert.equal(result.nodes.get(graph.nodes[0].id)?.runId,'run-2');
  assert.equal(JSON.stringify(overview),before);
});
test('monitor hides stale revision, checksum, inputs and edited graph states',()=>{
  const {graph,overview}=fixture();
  for(const key of ['revision','checksum','inputChecksum'] as const){
    const changed=structuredClone(overview);
    Object.assign(changed.executions[0],{[key]:key==='revision'?2:'stale'});
    assert.equal(graphMonitor(graph,changed).nodes.size,0);
  }
  const changed=structuredClone(graph);changed.nodes[0].label='user edit';
  assert.equal(graphMonitor(changed,overview).nodes.size,0);
});
test('monitor supports explicit history and never overlays another project',()=>{
  const {graph,overview}=fixture();
  overview.executions.push({...structuredClone(overview.executions[0]),id:'newer',status:'passed'});
  assert.equal(graphMonitor(graph,overview).execution?.id,'newer');
  assert.equal(graphMonitor(graph,overview,'execution').execution?.status,'running');
  overview.executions[0].projectId='other';
  assert.equal(graphMonitor(graph,overview,'execution').execution,undefined);
  assert.equal(graphMonitor(graph,overview,'missing').nodes.size,0);
});
test('missing connection and orphan activations have no node overlay',()=>{
  const {graph,overview}=fixture();
  assert.equal(graphMonitor(graph,null).execution,undefined);
  overview.executions[0].activations.push({id:'orphan',nodeId:'missing',attempt:1,status:'approval'});
  overview.executions[0].activations.push({id:'device',nodeId:'current-pc',attempt:1,status:'running'});
  assert.equal(graphMonitor(graph,overview).nodes.has('missing'),false);
  assert.equal(graphMonitor(graph,overview).nodes.has('current-pc'),false);
});
