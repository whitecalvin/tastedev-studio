import assert from 'node:assert/strict';
import test from 'node:test';
import {FixService} from '../src/features/ai/fix-service.ts';
import {integrationChanges} from '../src/features/orchestration/task-integration.ts';
import {Documents} from '../src/features/editor/documents.ts';
import type {TaskComparison} from '../src/features/orchestration/task-workspace.ts';
import {buildSnapshot} from '../src/features/ai/snapshot.ts';

function fixture(){
 const project=crypto.randomUUID(),disk=new Map([['old.ts','kept bytes']]);let fail='';
 const files={read:async(path:string)=>{assert.ok(disk.has(path));return{content:disk.get(path)!,size:1,modified:0};},readState:async(path:string)=>disk.get(path)??null,
  write:async(path:string,value:string,expected:string)=>{assert.equal(disk.get(path),expected);disk.set(path,value);},
  transition:async(path:string,expected:string|null,value:string|null)=>{assert.equal(disk.get(path)??null,expected);if(path===fail)throw Error('injected write failure');if(value===null)disk.delete(path);else disk.set(path,value);}};
 const documents=new Documents(files as never),fixes=new FixService(project,files,documents);
 const propose=()=>fixes.proposeIntegration({id:crypto.randomUUID(),taskId:crypto.randomUUID(),baseRevision:'a'.repeat(40),comparisonFingerprint:'b'.repeat(64),originals:{'old.ts':'kept bytes','new.ts':null},changes:[{path:'old.ts',proposed:null},{path:'new.ts',proposed:'kept bytes'}]});
 return{project,disk,files,fixes,documents,propose,fail:(path:string)=>{fail=path;}};
}
test('rename is an approved delete/create pair and revert restores exact original bytes',async()=>{
 const f=fixture(),a=await f.propose();assert.deepEqual(a.patches.map(p=>p.operation),['delete','create']);
 await assert.rejects(f.fixes.apply(a.id),/APPROVAL_REQUIRED/);assert.equal(f.disk.get('old.ts'),'kept bytes');
 await f.documents.open('old.ts');await f.fixes.approve(a.id,['old.ts','new.ts']);await f.fixes.apply(a.id);
 assert.equal(f.disk.has('old.ts'),false);assert.equal(f.disk.get('new.ts'),'kept bytes');assert.equal(f.documents.snapshot().openEditors.length,0);
 await f.fixes.revert(a.id);assert.equal(f.disk.get('old.ts'),'kept bytes');assert.equal(f.disk.has('new.ts'),false);
});
test('structural partial failure compensates only its own exact changes',async()=>{
 const f=fixture(),a=await f.propose();f.fail('new.ts');await f.fixes.approve(a.id,['old.ts','new.ts']);await assert.rejects(f.fixes.apply(a.id));
 assert.equal(f.disk.get('old.ts'),'kept bytes');assert.equal(f.disk.has('new.ts'),false);assert.equal(f.fixes.get(a.id).status,'failed');
});
test('created destination conflicts, dirty deletion and user edits after apply are protected',async()=>{
 const f=fixture(),a=await f.propose();await f.fixes.approve(a.id,['old.ts','new.ts']);f.disk.set('new.ts','user file');await assert.rejects(f.fixes.apply(a.id),/PATCH_CONFLICT/);assert.equal(f.disk.get('new.ts'),'user file');
 f.disk.delete('new.ts');await f.documents.open('old.ts');const doc=f.documents.snapshot().openEditors[0];f.documents.edit(doc.id,'unsaved');await assert.rejects(f.fixes.apply(a.id),/DIRTY_EDITOR/);f.documents.edit(doc.id,'kept bytes');
 await f.fixes.apply(a.id);f.disk.set('new.ts','later user edit');await assert.rejects(f.fixes.revert(a.id),/PATCH_CONFLICT/);assert.equal(f.disk.get('new.ts'),'later user edit');
});
test('empty file creation/deletion is distinct from a no-op and history restores operations',async()=>{
 const f=fixture(),a=await f.fixes.proposeIntegration({id:crypto.randomUUID(),taskId:crypto.randomUUID(),baseRevision:'a'.repeat(40),comparisonFingerprint:'b'.repeat(64),originals:{'empty.ts':null},changes:[{path:'empty.ts',proposed:''}]});
 await f.fixes.approve(a.id,['empty.ts']);await f.fixes.apply(a.id);assert.equal(f.disk.has('empty.ts'),true);
 const {HistoryStore}=await import('../transport/history.ts');const h=new HistoryStore();await h.put(f.project,'attempt',a.id,0,f.fixes.get(a.id));
 await f.fixes.revert(a.id);assert.equal(f.disk.has('empty.ts'),false);
});
test('three-way structural choices allow keep-parent and block an unreviewed deletion conflict',()=>{
 const c={files:[{path:'gone.ts',base:'old',parent:'user',modified:null,supported:true,conflict:true}]} as TaskComparison;
 assert.throws(()=>integrationChanges(c,[]),/Resolve/);assert.equal(integrationChanges(c,[{path:'gone.ts',choice:'use-task'}]).changes[0].proposed,null);
});
test('full Source manifest pins created bytes and deleted absence through durable history',async()=>{
 const f=fixture(),a=await f.propose();await f.fixes.approve(a.id,['old.ts','new.ts']);await f.fixes.apply(a.id);
 const {snapshot}=await buildSnapshot({...f.files,list:async()=>[...f.disk.keys()].map(path=>({path,name:path,kind:'file' as const}))},{projectId:f.project,proposalId:a.proposalId,attempt:a.attempt,baseRevision:'base',changedFiles:['new.ts']});
 await f.fixes.recordSnapshot(a.id,snapshot);assert.equal(snapshot.files.some(p=>p.path==='old.ts'),false);
 const {HistoryStore}=await import('../transport/history.ts');await new HistoryStore().put(f.project,'attempt',a.id,0,f.fixes.get(a.id));
 const changed=structuredClone(snapshot);changed.files[0].checksum='0'.repeat(64);await assert.rejects(f.fixes.recordSnapshot(a.id,changed));
});
test('interrupted structural apply restores only known results, and preserves foreign bytes',async()=>{
 const f=fixture(),a=await f.propose();await f.fixes.approve(a.id,['old.ts','new.ts']);await f.fixes.apply(a.id);
 const saved=f.fixes.get(a.id);saved.status='recovery-required';delete saved.journal!.completedAt;f.fixes.restore([saved]);
 f.disk.set('new.ts','external writer');await assert.rejects(f.fixes.recoverInterrupted(a.id),/PATCH_CONFLICT/);assert.equal(f.disk.get('new.ts'),'external writer');
 f.disk.set('new.ts','kept bytes');await f.fixes.recoverInterrupted(a.id);assert.equal(f.fixes.get(a.id).status,'applied');
});
test('structural proposals cannot escape project or access protected credentials',async()=>{
 const f=fixture();for(const path of ['../escape','.env','src/token.txt'])await assert.rejects(f.fixes.proposeIntegration({id:crypto.randomUUID(),taskId:crypto.randomUUID(),baseRevision:'a'.repeat(40),comparisonFingerprint:'b'.repeat(64),originals:{[path]:null},changes:[{path,proposed:'x'}]}));
 assert.equal(f.disk.size,1);assert.equal(f.fixes.history.length,0);
});
