import test from 'node:test';
import assert from 'node:assert/strict';
import {layerKey,nodeLayers,nodeLayer,moveLayer,readLayers,saveLayers} from '../src/features/orchestration/layers.ts';
import {initialGraph} from '../src/features/orchestration/domain.ts';

test('all four stacking actions preserve other nodes and clamp the endpoints',()=>{
 const order=['a','b','c','d'];
 assert.deepEqual(moveLayer(order,'b','front'),['a','c','d','b']);assert.deepEqual(moveLayer(order,'c','back'),['c','a','b','d']);
 assert.deepEqual(moveLayer(order,'b','forward'),['a','c','b','d']);assert.deepEqual(moveLayer(order,'c','backward'),['a','c','b','d']);
 assert.deepEqual(moveLayer(order,'d','forward'),order);assert.deepEqual(moveLayer(order,'a','backward'),order);assert.deepEqual(moveLayer(order,'missing','front'),order);assert.deepEqual(order,['a','b','c','d']);
});
test('drag elevation is transient: drop, cancellation and capture loss restore the saved order',()=>{
 const order=['a','b','c'];assert.ok(nodeLayer(order,'a','a')>nodeLayer(order,'c','a'));
 assert.equal(nodeLayer(order,'a',null),1);assert.equal(nodeLayer(order,'c',null),3);assert.deepEqual(order,['a','b','c']);
});
test('saved layers survive reload, isolate projects and do not mutate the execution graph',()=>{
 const graph=initialGraph('one'),before=JSON.stringify(graph),store=new Map<string,string>(),storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);}};
 const order=moveLayer(graph.nodes.map(n=>n.id),'current-pc','front');saveLayers(storage,'one',order,null);
 assert.deepEqual(readLayers(storage.getItem(layerKey('one')),'one'),order);assert.deepEqual(readLayers(storage.getItem(layerKey('two')),'two'),[]);assert.equal(JSON.stringify(graph),before);
 assert.throws(()=>readLayers(storage.getItem(layerKey('one')),'two'));
});
test('deleted nodes are pruned, new nodes are placed on top, duplicate identifiers cannot be restored',()=>{
 assert.deepEqual(nodeLayers(['removed','b','a','a'],['a','b','new']),['b','a','new']);
 for(const value of ['{',JSON.stringify({version:2,projectId:'p',order:[]}),JSON.stringify({version:1,projectId:'p',order:['a','a']})])assert.throws(()=>readLayers(value,'p'));
});
test('stale-window saves and unavailable storage preserve existing layer data',()=>{
 let raw:string|null=null;const storage={getItem:()=>raw,setItem:(_k:string,value:string)=>{raw=value;}};
 const first=saveLayers(storage,'p',['a','b'],null),second=saveLayers(storage,'p',['b','a'],first);
 assert.throws(()=>saveLayers(storage,'p',['a','b'],first),/another window/);assert.equal(raw,second);
 assert.throws(()=>saveLayers({...storage,setItem:()=>{throw Error('quota');}},'p',['a','b'],second),/quota/);assert.equal(raw,second);
});
