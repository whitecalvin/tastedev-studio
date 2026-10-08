import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionSetupSteps} from '../src/features/core/setup-wizard.ts';
import type {CoreSnapshot} from '../src/features/core/domain.ts';
const draft={endpoint:'ws://127.0.0.1:4340/studio',mode:'local' as const};
const snapshot={agents:[],jobs:[],runs:[]} as unknown as CoreSnapshot;
test('saved addresses and offline registration do not complete live setup',()=>{
 const result=connectionSetupSteps(draft,'disabled','',snapshot,{loading:false,status:'Valid'});
 assert.equal(result.next,1);assert.equal(result.complete,false);
 const live=connectionSetupSteps(draft,'connected',draft.endpoint,{...snapshot,agents:[{status:'offline'}]} as CoreSnapshot,{loading:false,status:'Valid'});
 assert.equal(live.next,2);assert.equal(live.complete,false);
});
test('switching endpoint does not reuse another Core authentication or Agent readiness',()=>{
 const result=connectionSetupSteps({...draft,endpoint:'wss://other.example/studio'},'connected',draft.endpoint,{...snapshot,agents:[{status:'idle'}]} as CoreSnapshot,{loading:false,status:'Valid'});
 assert.equal(result.current,false);assert.equal(result.next,1);assert.equal(result.complete,false);
});
test('authentication, credential URLs and inaccessible definitions remain incomplete',()=>{
 assert.equal(connectionSetupSteps(draft,'authentication','',snapshot,{loading:false,status:'Valid'}).steps[1].state,'error');
 assert.equal(connectionSetupSteps({...draft,endpoint:'wss://user:password@core.example/studio'},'disabled','',snapshot,{loading:false,status:'Valid'}).next,0);
 const result=connectionSetupSteps(draft,'connected',draft.endpoint,{...snapshot,agents:[{status:'busy'}]} as CoreSnapshot,{loading:false,status:'Access Required'});
 assert.equal(result.next,3);assert.equal(result.complete,false);
});
test('only a matching live Core, connected Agent and valid definition complete setup',()=>{
 const result=connectionSetupSteps(draft,'connected',draft.endpoint+'\0session',{...snapshot,agents:[{status:'idle'}]} as CoreSnapshot,{loading:false,status:'Valid'});
 assert.equal(result.complete,true);
});
