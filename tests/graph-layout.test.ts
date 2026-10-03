import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGraph,newNode,validateGraph} from '../src/features/orchestration/domain.ts';
import {arrangeGraph} from '../src/features/orchestration/layout.ts';

test('arrangement preserves relationships and metadata without mutating input',()=>{
 const graph=initialGraph('layout','composite',['implementation','deployment','testing']);
 const before=JSON.stringify(graph), result=arrangeGraph(graph);
 assert.equal(JSON.stringify(graph),before);
 assert.deepEqual(result.edges,graph.edges);
 assert.ok(result.nodes.slice(1).every(n=>n.x>result.nodes[0].x));
 assert.deepEqual(arrangeGraph(result),result);
 assert.deepEqual(result.nodes.map((node,i)=>({...node,x:graph.nodes[i].x,y:graph.nodes[i].y})),graph.nodes);
});
test('success branches advance; failure feedback does not reverse the order',()=>{
 const graph=initialGraph('flow'); graph.nodes=['a','b','c'].map((id,i)=>newNode('task',id,i));
 graph.edges=[{id:'ab',from:'a',to:'b',relation:'success'},{id:'ac',from:'a',to:'c',relation:'success'},{id:'ba',from:'b',to:'a',relation:'failure'}];
 const result=arrangeGraph(graph);
 assert.ok(result.nodes[1].x>result.nodes[0].x);
 assert.equal(result.nodes[1].x,result.nodes[2].x);
 assert.notEqual(result.nodes[1].y,result.nodes[2].y);
});
test('sixty sequential and disconnected nodes stay nonoverlapping and valid',()=>{
 for(const chain of [true,false]){
 const graph=initialGraph('large');graph.nodes=Array.from({length:60},(_,i)=>newNode('task',`n${i}`,0));
 graph.edges=chain?graph.nodes.slice(1).map((n,i)=>({id:`e${i}`,from:`n${i}`,to:n.id,relation:'success' as const})):[];
 const result=arrangeGraph(graph); validateGraph(result,result.projectId);
 assert.equal(new Set(result.nodes.map(n=>`${n.x}:${n.y}`)).size,60);
 for(const a of result.nodes)for(const b of result.nodes)if(a.id!==b.id)assert.ok(Math.abs(a.x-b.x)>=220||Math.abs(a.y-b.y)>=126);
 }
});
