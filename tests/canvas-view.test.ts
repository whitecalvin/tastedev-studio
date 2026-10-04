import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasViewKey,readCanvasView,saveCanvasView} from '../src/features/orchestration/canvas-view.ts';
test('project view roundtrip stores presentation only and preserves other projects',()=>{
 const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
 const view={zoom:.347,left:400,top:320},raw=saveCanvasView(storage,'a',view,null);
 assert.deepEqual(readCanvasView(raw,'a'),view);assert.deepEqual(readCanvasView(storage.getItem(canvasViewKey('b')),'b'),{zoom:1,left:0,top:0});
 assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['left','projectId','top','version','zoom']);assert.throws(()=>readCanvasView(raw,'b'));
});
test('malformed, excessive and non-finite view records are rejected',()=>{
 for(const raw of ['{','x'.repeat(1025),...[-1,0,2].map(zoom=>JSON.stringify({version:1,projectId:'a',zoom,left:0,top:0})),JSON.stringify({version:1,projectId:'a',zoom:1,left:-1,top:0})])assert.throws(()=>readCanvasView(raw,'a'));
});
test('stale window cannot overwrite newer view and storage denial propagates',()=>{
 let raw:string|null=null;const storage={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value;}};
 const first=saveCanvasView(storage,'a',{zoom:1,left:0,top:0},null);
 const second=saveCanvasView(storage,'a',{zoom:.5,left:100,top:20},first);
 assert.throws(()=>saveCanvasView(storage,'a',{zoom:1,left:0,top:0},first));assert.equal(raw,second);
 assert.throws(()=>saveCanvasView({getItem:()=>null,setItem:()=>{throw Error('denied');}},'a',{zoom:1,left:0,top:0},null));
});
