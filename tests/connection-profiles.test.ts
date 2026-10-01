import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ConnectionProfiles,connectionProfiles,coreEndpoint} from '../src/features/core/connection-profiles.ts';
test('remote endpoints require trusted TLS while loopback remains available',()=>{
 for(const endpoint of ['ws://localhost:4330/studio','ws://127.0.0.1:4330/studio','ws://[::1]:4330/studio','wss://core.example/studio'])assert.equal(coreEndpoint(endpoint),endpoint);
 for(const endpoint of ['ws://192.168.0.102/studio','ws://localhost.example/studio','https://core.example/studio','wss://user:password@core.example/studio','wss://core.example/studio?token=dummy','wss://core.example/studio#token','ws://localhost/other'])assert.throws(()=>coreEndpoint(endpoint));
});
test('profile CRUD persists only bounded non-secret fields and rejects corrupt records',()=>{
 let text:string|null=null;const store=new ConnectionProfiles({getItem:()=>text,setItem:(_key,value)=>{text=value;}});
 const id=randomUUID(),profile={id,name:'QA Core',endpoint:'wss://core.example/studio',mode:'team' as const};
 assert.deepEqual(store.load(),[]);store.save(profile);assert.equal(store.load().length,1);store.save({...profile,name:'Renamed'});assert.equal(store.load()[0].name,'Renamed');
 const row=store.load()[0];assert.throws(()=>connectionProfiles([{...row,token:'Dummy-test-token'}]));assert.throws(()=>connectionProfiles([row,{...row,id:randomUUID()}]));assert.throws(()=>connectionProfiles(Array.from({length:21},()=>row)));
 text='invalid JSON';assert.throws(()=>store.load());assert.equal(text,'invalid JSON');text=JSON.stringify([row]);store.remove(id);assert.deepEqual(store.load(),[]);
});
