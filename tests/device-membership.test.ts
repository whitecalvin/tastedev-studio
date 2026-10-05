import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGraph,newNode,saveGraph,loadGraph} from '../src/features/orchestration/domain.ts';
import {assignAgentDevice,declaredAgentDevice,deviceAgentNodes} from '../src/features/orchestration/device-membership.ts';
import {emptyEdits,recordEdit,travelEdit} from '../src/features/orchestration/edit-history.ts';

function fixture(){const graph=initialGraph('p');graph.nodes.push({...newNode('agent','agent',1),reference:'registered-agent'},newNode('device','second-device',2));return graph;}
test('device assignment is explicit, immutable and supports multiple Agents on one device',()=>{
 const graph=fixture(),before=JSON.stringify(graph);
 const assigned=assignAgentDevice(graph,'p','agent','current-pc','host');
 assert.equal(JSON.stringify(graph),before);assert.equal(declaredAgentDevice(assigned,'agent'),'current-pc');
 assigned.nodes.push(newNode('agent','other-agent',3));
 const second=assignAgentDevice(assigned,'p','other-agent','current-pc','second-host');
 assert.deepEqual(deviceAgentNodes(second,'current-pc').map(n=>n.id),['agent','other-agent']);
 assert.equal(second.nodes.find(n=>n.id==='agent')!.reference,'registered-agent');
});
test('moving or removing membership preserves Agent registration and unrelated roles/edges',()=>{
 const graph=assignAgentDevice(fixture(),'p','agent','current-pc','host');
 const moved=assignAgentDevice(graph,'p','agent','second-device','unused');
 assert.equal(declaredAgentDevice(moved,'agent'),'second-device');assert.equal(moved.edges.find(e=>e.relation==='hosts')!.id,'host');
 assert.deepEqual(moved.edges.filter(e=>e.relation!=='hosts'),graph.edges.filter(e=>e.relation!=='hosts'));
 const removed=assignAgentDevice(moved,'p','agent','','unused');
 assert.equal(declaredAgentDevice(removed,'agent'),'');assert.equal(removed.nodes.find(n=>n.id==='agent')!.reference,'registered-agent');
 assert.deepEqual(assignAgentDevice(moved,'p','agent','second-device','unused'),moved);
});
test('membership rejects another project, invalid node types and duplicate edge identities without mutation',()=>{
 const graph=fixture(),before=JSON.stringify(graph);
 assert.throws(()=>assignAgentDevice(graph,'foreign','agent','current-pc','host'));
 assert.throws(()=>assignAgentDevice(graph,'p','current-pc','second-device','host'));
 assert.throws(()=>assignAgentDevice(graph,'p','agent','role-implementation','host'));
 assert.throws(()=>assignAgentDevice(graph,'p','agent','current-pc',graph.edges[0].id));
 assert.equal(JSON.stringify(graph),before);
});
test('membership survives graph save/reload and participates in existing undo/redo',()=>{
 const before=fixture(),after=assignAgentDevice(before,'p','agent','current-pc','host');
 const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
 saveGraph(storage,after);assert.deepEqual(loadGraph(storage,'p'),after);
 const history=recordEdit(emptyEdits('p'),before,after,null);
 const undo=travelEdit(history,after,'undo')!;assert.deepEqual(undo.graph,before);
 assert.deepEqual(travelEdit(undo.history,undo.graph,'redo')!.graph,after);
});
