import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import {deviceOperations} from '../src/features/orchestration/operations-board.ts';
import type {Agent} from '../src/features/core/domain.ts';
test('device roles use explicit device and hosted Agent assignments, not display names',()=>{
 const graph=initialGraph('project','web');
 graph.nodes=[{...newNode('device','pc',0),label:'PC'}, {...newNode('agent','a',1),reference:'live'},newNode('role','r',2),newNode('task','task',3),{...newNode('agent','free',4),label:'PC'}];
 graph.edges=[{id:'h',from:'pc',to:'a',relation:'hosts'},{id:'a',from:'a',to:'r',relation:'assigns'},{id:'p',from:'r',to:'task',relation:'performs'}];
 const report={id:'live',status:'busy'} as Agent;
 const live=deviceOperations(graph,[report],true);
 assert.equal(live.devices[0].agents[0].report,report);assert.deepEqual(live.devices[0].roles.map(n=>n.id),['r']);assert.equal(live.devices[0].tasks.length,1);assert.equal(live.unassigned[0].node.id,'free');
 assert.equal(deviceOperations(graph,[report],false).devices[0].agents[0].report,undefined);
});
