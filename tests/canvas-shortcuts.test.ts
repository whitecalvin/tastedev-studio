import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasShortcut} from '../src/features/orchestration/shortcuts.ts';
const key={key:'z',ctrlKey:true,metaKey:false,shiftKey:false,altKey:false,repeat:false,isComposing:false,defaultPrevented:false};
const scope={enabled:true,editable:false,canUndo:true,canRedo:true};
test('Ctrl and Meta route undo/redo/find with correct modifier combinations',()=>{
 for(const modifier of [{ctrlKey:true,metaKey:false},{ctrlKey:false,metaKey:true}]){
  assert.equal(canvasShortcut({...key,...modifier},scope),'undo');assert.equal(canvasShortcut({...key,...modifier,shiftKey:true},scope),'redo');assert.equal(canvasShortcut({...key,...modifier,key:'F'},scope),'find');
 }
 assert.equal(canvasShortcut({...key,key:'y'},scope),'redo');assert.equal(canvasShortcut({...key,key:'f',shiftKey:true},scope),null);
});
test('editable controls, outside canvas, IME, repeats and handled keys cannot dispatch',()=>{
 for(const blocked of [{editable:true},{enabled:false}])assert.equal(canvasShortcut(key,{...scope,...blocked}),null);
 for(const blocked of [{isComposing:true},{repeat:true},{defaultPrevented:true},{altKey:true},{metaKey:true},{ctrlKey:false}])assert.equal(canvasShortcut({...key,...blocked},scope),null);
});
test('empty or locked edit history cannot mutate while read-only search stays available',()=>{
 const locked={...scope,canUndo:false,canRedo:false};assert.equal(canvasShortcut(key,locked),null);assert.equal(canvasShortcut({...key,shiftKey:true},locked),null);assert.equal(canvasShortcut({...key,key:'y'},locked),null);assert.equal(canvasShortcut({...key,key:'f'},locked),'find');
 assert.equal(canvasShortcut({...key,key:'Delete'},scope),null);assert.equal(canvasShortcut({...key,key:'ArrowLeft'},scope),null);
});
