import test from 'node:test';
import assert from 'node:assert/strict';
import {CoreStore,SqliteCoreRepository} from '../transport/storage.ts';
import {RunHistory} from '../transport/run-history.ts';
import {RunLogs} from '../transport/protocol.ts';
import {CoreService} from '../src/features/core/service.ts';
import {pageHistory} from '../src/features/core/history-query.ts';
import {snapshotDelta,applySnapshotDelta} from '../src/features/core/snapshot-delta.ts';
import type {CoreSnapshot,Job,Run} from '../src/features/core/domain.ts';
function state(count=80):CoreSnapshot {
 const runs:Run[]=Array.from({length:count},(_,i)=>({id:'run-'+String(i).padStart(5,'0'),jobId:'job-'+i,projectId:i%3?'project':'other',agentId:'retired-agent',status:i%2?'failed':'passed',createdAt:new Date(Date.UTC(2026,0,1,0,i)).toISOString(),startedAt:null,finishedAt:null,exitCode:i%2?1:0,result:null}));
 const jobs:Job[]=runs.map((r,i)=>({id:r.jobId,projectId:r.projectId,type:'task',name:'Dummy private searchable '+i,status:i%2?'failed':'succeeded',requirements:{},payload:{task:'test',steps:[{name:'test',executable:'node',args:['-v'],cwd:'.'}]},priority:0,queuedAt:r.createdAt,createdAt:r.createdAt,updatedAt:r.createdAt,agentId:null,sourceJobId:null,attempt:1,maxAttempts:3,cancellationRequestedAt:null}));
 return {agents:[],jobs,runs,steps:[],artifacts:[],events:[]};
}
function fixture(count=80){const store=new CoreStore(':memory:',Buffer.alloc(32,9)),initial=state(count);store.put('core',{state:initial,revision:7});const repository=new SqliteCoreRepository(store);return {store,repository,initial};}
test('legacy encrypted Core migrates atomically; direct indexed pages match existing filters and cursors',()=>{
 const f=fixture();try{assert.equal(f.store.get('core'),undefined);assert.deepEqual(f.repository.read(),f.initial);assert.equal(new SqliteCoreRepository(f.store).revision(),7);
 const expected=f.initial.runs.filter(r=>r.projectId==='project').map(r=>({...r,name:f.initial.jobs.find(j=>j.id===r.jobId)!.name}));
 for(const query of [{limit:9},{limit:6,status:'failed'},{search:'searchable 1'},{from:'2026-01-01T00:10:00Z',to:'2026-01-01T00:30:00Z'}]){const actual=f.store.pageRuns('project',query),wanted=pageHistory(expected,query);assert.equal(actual.total,wanted.total);assert.deepEqual(actual.items.map(r=>r.id),wanted.items.map(r=>r.id));assert.equal(actual.next,wanted.next);if(actual.next)assert.deepEqual(f.store.pageRuns('project',{...query,after:actual.next}).items.map(r=>r.id),pageHistory(expected,{...query,after:actual.next}).items.map(r=>r.id));}
 assert.equal(f.store.pageRuns('missing',{}).total,0);
 const page=new RunHistory(new CoreService(f.repository,{get:async()=>null}),new RunLogs(),f.store);
 f.repository.read=()=>{throw Error('Full snapshot must not be used for paging');};assert.equal((page.request('project','page',{limit:3}) as {items:unknown[]}).items.length,3);
 }finally{f.store.close();}
});
test('incremental persistence preserves ciphertext for unchanged rows and project-scoped encrypted metadata',()=>{const f=fixture();try{
 const get=()=>Buffer.from(f.store.db.prepare('SELECT payload FROM units WHERE name=?').get('core-row:jobs:job-1')!.payload as Uint8Array);
 const before=get();f.repository.transaction(tx=>{tx.jobs.get('job-2')!.name='Changed review';});assert.deepEqual(get(),before);assert.equal(new SqliteCoreRepository(f.store).read().jobs[2].name,'Changed review');
 assert.equal(f.store.pageRuns('project',{search:'Changed review'}).items[0].id,'run-00002');
 for(const row of f.store.db.prepare('SELECT project,status,payload FROM run_history').all()){assert.notEqual(row.project,'project');assert.notEqual(row.status,'failed');assert.ok(!Buffer.from(row.payload as Uint8Array).includes(Buffer.from('Dummy private')));}
 }finally{f.store.close();}});
test('projection failure rolls back entity writes, revision and published state together',()=>{const f=fixture();try{let published=0;f.repository.subscribe(()=>published++);f.store.db.exec("CREATE TRIGGER deny_projection BEFORE UPDATE ON run_history BEGIN SELECT RAISE(ABORT,'controlled'); END;");assert.throws(()=>f.repository.transaction(tx=>{tx.jobs.get('job-2')!.name='Must not persist';}));assert.equal(f.repository.revision(),7);assert.equal(published,0);assert.deepEqual(new SqliteCoreRepository(f.store).read(),f.initial);assert.equal(f.store.pageRuns('project',{search:'Must not persist'}).total,0);}finally{f.store.close();}});
test('migration failure preserves original monolith for retry',()=>{const store=new CoreStore(':memory:',Buffer.alloc(32,9)),initial=state();try{store.put('core',{state:initial,revision:4});store.db.exec("CREATE TRIGGER deny_manifest BEFORE INSERT ON units WHEN NEW.name='core-manifest-v1' BEGIN SELECT RAISE(ABORT,'controlled'); END;");assert.throws(()=>new SqliteCoreRepository(store));assert.deepEqual(store.get('core'),{state:initial,revision:4});assert.equal(store.get('core-row:jobs:job-1'),undefined);store.db.exec('DROP TRIGGER deny_manifest');assert.deepEqual(new SqliteCoreRepository(store).read(),initial);}finally{store.close();}});
test('delta preserves ordering, removals and updates without mutating baseline; invalid delta fails closed',()=>{const before=state(20),after=structuredClone(before);after.jobs[1].name='updated';after.jobs.reverse();after.runs.pop();const delta=snapshotDelta(before,after);assert.equal(delta.upsert.jobs.length,1);assert.deepEqual(applySnapshotDelta(before,delta),after);assert.equal(before.jobs[1].name,'Dummy private searchable 1');assert.throws(()=>applySnapshotDelta(before,{...delta,order:{...delta.order,runs:['missing']}}));assert.throws(()=>applySnapshotDelta(before,{...delta,order:{...delta.order,jobs:['duplicate','duplicate']}}));});
