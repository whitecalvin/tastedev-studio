import test from 'node:test';
import assert from 'node:assert/strict';
import {isContextMenuKey} from '../src/features/orchestration/context-menu-key.ts';

const key={key:'ContextMenu',shiftKey:false,ctrlKey:false,metaKey:false,altKey:false,repeat:false,isComposing:false,defaultPrevented:false};
test('node menu uses ContextMenu or Shift+F10 without taking other shortcuts',()=>{
 assert.equal(isContextMenuKey(key),true);
 assert.equal(isContextMenuKey({...key,key:'F10',shiftKey:true}),true);
 assert.equal(isContextMenuKey({...key,key:'F10'}),false);
 for(const modifier of ['ctrlKey','metaKey','altKey','repeat','isComposing','defaultPrevented']as const){
  assert.equal(isContextMenuKey({...key,[modifier]:true}),false,modifier);
 }
});
