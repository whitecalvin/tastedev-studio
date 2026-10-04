import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGraph,newNode,type ProjectGraph} from '../src/features/orchestration/domain.ts';
import {duplicateNode} from '../src/features/orchestration/duplicate-node.ts';
import {emptyEdits,recordEdit,travelEdit} from '../src/features/orchestration/edit-history.ts';
test('copy preserves basic settings but never duplicates relationships or Agent binding',()=>{
 const graph=initialGraph('p');graph.nodes.push({...newNode('agent','agent',2),label:'QA',reference:'real-agent',role:'testing'});graph.edges.push({id:'host',from:'current-pc',to:'agent',relation:'hosts'});
 const before=JSON.stringify(graph),result=duplicateNode(graph,'agent','copy','QA copy','p');
 assert.equal(result.node.reference,'');assert.equal(result.node.role,'testing');assert.equal(result.node.kind,'agent');assert.deepEqual(result.graph.edges,graph.edges);assert.equal(result.graph.edges.some(e=>e.to==='copy'||e.from==='copy'),false);assert.equal(JSON.stringify(graph),before);
});
test('Protocol reference is cleared, edge coordinates and Unicode label stay valid',()=>{
 const graph:ProjectGraph={...initialGraph('p'),nodes:[{...newNode('task','task',0),x:2800,y:1800,taskType:'test',reference:'test:unit'}],edges:[]};
 const result=duplicateNode(graph,'task','new','😀'.repeat(100),'p');assert.equal(result.node.label.length,120);assert.equal(result.node.label.endsWith('😀'),true);assert.equal(result.node.taskType,'test');assert.equal(result.node.reference,'');assert.deepEqual([result.node.x,result.node.y],[2760,1760]);
});
test('missing nodes, collisions, project escape and capacity cannot alter original graph',()=>{
 const graph=initialGraph('p'),before=JSON.stringify(graph);
 for(const [node,id,project] of [['missing','copy','p'],['current-pc','current-pc','p'],['current-pc','copy','other'],['current-pc','../escape','p']])assert.throws(()=>duplicateNode(graph,node,id,'Copy',project));
 const full={...graph,nodes:Array.from({length:60},(_,i)=>newNode('device',`n${i}`,i%40)),edges:[]};assert.throws(()=>duplicateNode(full,'n0','copy','Copy','p'));assert.equal(JSON.stringify(graph),before);
});
test('copy participates in normal graph undo/redo without changing the original node',()=>{
 const graph=initialGraph('p'),copy=duplicateNode(graph,'current-pc','copy','PC copy','p').graph,history=recordEdit(emptyEdits('p'),graph,copy),undo=travelEdit(history,copy,'undo')!;
 assert.deepEqual(undo.graph,graph);assert.deepEqual(travelEdit(undo.history,undo.graph,'redo')!.graph,copy);
});
