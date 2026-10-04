import test from 'node:test';
import assert from 'node:assert/strict';
import {newNode,type ProjectGraph} from '../src/features/orchestration/domain.ts';
import {nodeConnections} from '../src/features/orchestration/connections.ts';
const graph:ProjectGraph={version:1,projectId:'p',projectKind:'custom',retryLimit:3,nodes:['a','b','c','d'].map((id,index)=>newNode('task',id,index)),edges:[{id:'ab',from:'a',to:'b',relation:'success'},{id:'bc',from:'b',to:'c',relation:'success'},{id:'ba',from:'b',to:'a',relation:'failure'},{id:'cd',from:'c',to:'d',relation:'success'}]};
test('direction and relationship identities are preserved without recursive feedback traversal',()=>{
 const before=JSON.stringify(graph),result=nodeConnections(graph,'b','p');
 assert.deepEqual(result.incoming.map(v=>[v.edge.id,v.node.id]),[['ab','a']]);assert.deepEqual(result.outgoing.map(v=>[v.edge.id,v.node.id,v.edge.relation]),[['bc','c','success'],['ba','a','failure']]);assert.equal(JSON.stringify(graph),before);
});
test('missing selection and foreign project never show substitute relationships',()=>{
 for(const [id,project] of [['missing','p'],['b','other'],['','p']])assert.deepEqual(nodeConnections(graph,id,project),{incoming:[],outgoing:[]});
});
test('dangling endpoints and self loops do not become navigation targets',()=>{
 const changed={...graph,edges:[...graph.edges,{id:'ghost',from:'b',to:'missing',relation:'success' as const},{id:'self',from:'b',to:'b',relation:'failure' as const}]};
 assert.deepEqual(nodeConnections(changed,'b','p'),nodeConnections(graph,'b','p'));
});
