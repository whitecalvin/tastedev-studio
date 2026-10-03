import test from 'node:test';import assert from 'node:assert/strict';
import {readExpandedFolders} from '../src/features/filesystem/expanded-folders.ts';
test('refresh reloads root and expanded descendants once, including empty folders',async()=>{
 const calls:string[]=[];const result=await readExpandedFolders(['','scripts','scripts/nested','empty','scripts'],async path=>{calls.push(path);return path==='empty'?[]:[{path:path+'/a.ts',name:'a.ts',kind:'file'}];});
 assert.deepEqual(calls,['','scripts','scripts/nested','empty']);assert.ok(result&&Object.hasOwn(result.entries,'scripts'));assert.deepEqual(result?.entries.empty,[]);
});
test('nested failure preserves other folder listings and marks only failed folder for retry',async()=>{
 const result=await readExpandedFolders(['bad','good'],async path=>{if(path==='bad')throw Error('denied');return [];});
 assert.deepEqual(result?.entries,{'':[],good:[]});assert.deepEqual(result?.errors,{bad:'denied'});
 await assert.rejects(readExpandedFolders(['good'],async()=>{throw Error('root access denied');}),/root access denied/);
});
test('obsolete workspace/filter refresh does not publish results or continue reading',async()=>{
 let active=true;const calls:string[]=[];
 const result=await readExpandedFolders(['scripts'],async path=>{calls.push(path);active=false;return [];},()=>active);
 assert.equal(result,null);assert.deepEqual(calls,['']);
});
