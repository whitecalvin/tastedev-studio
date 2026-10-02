import test from 'node:test';
import assert from 'node:assert/strict';
import {InMemoryCoreRepository,type CoreRepositories} from '../src/features/core/repository.ts';
import {CoreStore,SqliteCoreRepository} from '../transport/storage.ts';
import type {CoreEvent} from '../src/features/core/domain.ts';
const event=(id:string):CoreEvent=>({id,entityId:'j',projectId:'p',type:'job.created',timestamp:'2026-10-02'});
test('transaction handles, return values and list mutations remain isolated after commit',()=>{
 const repo=new InMemoryCoreRepository();repo.transaction(tx=>tx.events.save(event('a')));
 let retained:CoreRepositories|undefined;const result=repo.transaction(tx=>{retained=tx;const row=tx.events.get('a')!;row.timestamp='updated';return row;});
 result.timestamp='outside';retained!.events.get('a')!.timestamp='later';retained!.events.list().push(event('b'));
 assert.deepEqual(repo.read().events,[{...event('a'),timestamp:'updated'}]);
 repo.transaction(tx=>{tx.events.list().splice(0,1);});assert.equal(repo.read().events.length,0);
});
test('failure, asynchronous and nested transactions leave revision and observers intact',()=>{
 const repo=new InMemoryCoreRepository();repo.transaction(tx=>tx.events.save(event('a')));let notifications=0;repo.subscribe(()=>notifications++);
 const revision=repo.revision(),before=repo.read();
 assert.throws(()=>repo.transaction(tx=>{tx.events.get('a')!.timestamp='discard';throw Error('fail');}));
 assert.throws(()=>repo.transaction(()=>repo.transaction(tx=>tx.events.save(event('nested')))),/Nested/);
 assert.throws(()=>repo.transaction(async tx=>{tx.events.get('a')!.timestamp='async';}),/synchronous/);
 assert.deepEqual(repo.read(),before);assert.equal(repo.revision(),revision);assert.equal(notifications,0);
 repo.transaction(tx=>tx.events.get('a')!.timestamp='success');assert.equal(notifications,1);
});
test('unchanged entities reuse identity and only changed rows enter encrypted writes',()=>{
 const store=new CoreStore(':memory:',Buffer.alloc(32,44)),repo=new SqliteCoreRepository(store);
 repo.transaction(tx=>{tx.events.save(event('a'));tx.events.save(event('b'));});
 const original=store.putMany.bind(store);let writes:string[]=[];
 store.putMany=(values,projection,removed)=>{writes=values.map(v=>v[0]);return original(values,projection,removed);};
 repo.transaction(tx=>{tx.events.get('a')!.timestamp='changed';});
 assert.deepEqual(writes.filter(n=>n.startsWith('core-row:')),['core-row:events:a']);
 repo.transaction(tx=>{tx.events.list();});assert.equal(writes.filter(n=>n.startsWith('core-row:')).length,0);
 store.close();
});
test('durable failure does not leak a mutable draft into prior committed state',()=>{
 const store=new CoreStore(':memory:',Buffer.alloc(32,45)),repo=new SqliteCoreRepository(store);repo.transaction(tx=>tx.events.save(event('a')));
 const revision=repo.revision();store.db.exec("CREATE TRIGGER reject_increment BEFORE INSERT ON units BEGIN SELECT RAISE(ABORT,'controlled'); END;");
 assert.throws(()=>repo.transaction(tx=>{tx.events.get('a')!.timestamp='not saved';}));assert.deepEqual(repo.read().events,[event('a')]);assert.equal(repo.revision(),revision);
 assert.deepEqual(store.get('core-row:events:a'),event('a'));store.close();
});
test('a failing durable callback cannot mutate shared untouched entities',()=>{
 const repo=new InMemoryCoreRepository({agents:[],jobs:[],runs:[],steps:[],artifacts:[],events:[event('a')]},state=>{state.events[0].timestamp='corrupt';});
 assert.throws(()=>repo.transaction(()=>{}));assert.deepEqual(repo.read().events,[event('a')]);assert.equal(repo.revision(),0);
});
