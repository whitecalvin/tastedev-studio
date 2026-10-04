import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGraph,removeNode} from '../src/features/orchestration/domain.ts';
import {emptyEdits,recordEdit,travelEdit,matchesSavedGraph} from '../src/features/orchestration/edit-history.ts';
const original=initialGraph('p');
const moved=(x:number)=>({...original,nodes:original.nodes.map((node,i)=>i===0?{...node,x}:node)});
test('undo/redo restores deleted nodes and their relationships without mutating inputs',()=>{
 const removed=removeNode(original,'current-pc'),history=recordEdit(emptyEdits('p'),original,removed),before=JSON.stringify(history);
 const undo=travelEdit(history,removed,'undo')!;assert.deepEqual(undo.graph,original);assert.equal(JSON.stringify(history),before);
 assert.deepEqual(travelEdit(undo.history,undo.graph,'redo')!.graph,removed);assert.equal(travelEdit(emptyEdits('p'),original,'undo'),null);
});
test('one drag stores a single baseline, new edit after undo clears redo',()=>{
 let history=recordEdit(emptyEdits('p'),original,moved(100),'drag');history=recordEdit(history,moved(100),moved(300),'drag');assert.equal(history.past.length,1);
 const undo=travelEdit(history,moved(300),'undo')!;assert.deepEqual(undo.graph,original);
 history=recordEdit(undo.history,undo.graph,moved(400));assert.equal(history.future.length,0);assert.equal(travelEdit(history,moved(400),'redo'),null);
});
test('bounded snapshots are detached and cross-project/invalid edits are rejected',()=>{
 let current=original,history=emptyEdits('p');for(let i=0;i<60;i++){const next=moved(100+i);history=recordEdit(history,current,next);current=next;}assert.equal(history.past.length,50);
 assert.throws(()=>recordEdit(history,current,initialGraph('other')));assert.throws(()=>recordEdit(history,current,moved(-1)));
 const mutable=moved(500),detached=recordEdit(emptyEdits('p'),mutable,moved(600));mutable.nodes[0].x=1000;assert.equal(detached.past[0].nodes[0].x,500);
});
test('no-op does not consume history and saved baseline controls dirty state',()=>{
 const history=emptyEdits('p');assert.equal(recordEdit(history,original,original),history);
 assert.equal(matchesSavedGraph(original,JSON.stringify(original,null,2)),true);assert.equal(matchesSavedGraph(moved(500),JSON.stringify(original)),false);assert.equal(matchesSavedGraph(original,null),false);assert.equal(matchesSavedGraph(original,'{'),false);assert.equal(matchesSavedGraph(original,JSON.stringify(initialGraph('other'))),false);
});
