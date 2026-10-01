import test from 'node:test';
import assert from 'node:assert/strict';
import { boundIndexReader, indexable, indexWorkspace, searchIndex, indexLimits } from '../src/features/editor/workspace-index.ts';
import { uriWorkspacePath } from '../src/features/editor/language-workspace.ts';
import type { Uri } from 'monaco-editor';
test('bounded workspace search includes dirty content and excludes dependency and credential paths', async()=>{
  const reads:string[]=[];const reader={list:async(path:string)=>path?[]:[{name:'main.ts',path:'main.ts',kind:'file' as const},{name:'node_modules',path:'node_modules',kind:'directory' as const},{name:'.env',path:'.env',kind:'file' as const},{name:'escape',path:'../escape.ts',kind:'file' as const}],read:async(path:string)=>{reads.push(path);return{content:'saved'};}};
  const result=await indexWorkspace(reader,new AbortController().signal,[{path:'main.ts',content:'const dirty = 1;\nDIRTY'}]);
  assert.deepEqual(reads,[]);assert.equal(result.files.length,1);assert.deepEqual(result.skipped,['../escape.ts']);
  assert.deepEqual(searchIndex(result.files,'dirty').hits.map(hit=>[hit.line,hit.column]),[[1,7],[2,1]]);
  assert.equal(searchIndex(result.files,'dirty',true).hits.length,1);
  for(const path of ['.env.local','node_modules/lib.ts','.git/index.ts','credentials.json','id_rsa.txt'])assert.equal(indexable(path),false);
});
test('search is literal, bounded and cancellable without invoking a shell or writing files', async()=>{
  assert.equal(searchIndex([{path:'x.ts',content:'[.*]'}],'[.*]').hits.length,1);
  assert.equal(searchIndex([{path:'x.ts',content:'a'.repeat(1000)}],'a').hits.length,indexLimits.results);
  assert.equal(searchIndex([{path:'x.ts',content:'a'.repeat(1000)}],'a').limited,true);
  assert.throws(()=>searchIndex([],''));assert.throws(()=>searchIndex([],'a\nb'));
  const controller=new AbortController();controller.abort();await assert.rejects(indexWorkspace({list:async()=>[],read:async()=>({content:''})},controller.signal),/Cancelled/);
});
test('directory response cancellation and connection switches cannot publish another project index',async()=>{
  const controller=new AbortController();await assert.rejects(indexWorkspace({list:async()=>{controller.abort();return[];},read:async()=>({content:''})},controller.signal),/Cancelled/);
  const source={connection:{id:'first'},list:async()=>{source.connection={id:'second'};return[];},read:async()=>({content:''})};
  await assert.rejects(indexWorkspace(boundIndexReader(source,'first'),new AbortController().signal),/Workspace changed/);
  assert.equal(searchIndex([{path:'unicode.ts',content:'İ prefix FIELD'}],'field').hits[0].column,10);
});
test('definition navigation accepts only normalized paths in the same workspace URI',()=>{
  const uri=(scheme:string,authority:string,path:string)=>({scheme,authority,path}) as Uri;
  assert.equal(uriWorkspacePath(uri('studio','first','/src/main.ts'),'first'),'src/main.ts');
  assert.equal(uriWorkspacePath(uri('studio','second','/src/main.ts'),'first'),null);
  assert.equal(uriWorkspacePath(uri('file','first','/src/main.ts'),'first'),null);
  for(const path of ['/../outside.ts','/src/./main.ts','//main.ts','/C:/outside.ts'])assert.equal(uriWorkspacePath(uri('studio','first',path),'first'),null);
});
