import assert from 'node:assert/strict';
import test from 'node:test';
import {integrationInbox,integrationNext} from '../src/features/orchestration/integration-inbox.ts';
import {mergeIntegration} from '../src/features/orchestration/integration-merge.ts';
import type {IntegrationRequest} from '../src/features/orchestration/integration-requests.ts';

test('inbox filters preserve project boundary, immutable request identity and history',()=>{
  const rows=[{id:'a',parentProjectId:'p',phase:'completed',createdAt:'2026-01-02',files:[{path:'src/a.ts'}]},
    {id:'b',parentProjectId:'p',phase:'verified',createdAt:'2026-01-01',files:[{path:'src/b.ts'}]},
    {id:'c',parentProjectId:'foreign',phase:'failed',createdAt:'2026-01-03',files:[]}] as IntegrationRequest[];
  assert.deepEqual(integrationInbox(rows,'p','active').map(r=>r.id),['b']);
  assert.deepEqual(integrationInbox(rows,'p','completed').map(r=>r.id),['a']);
  assert.deepEqual(integrationInbox(rows,'p','attention','B.TS').map(r=>r.id),['b']);
  assert.deepEqual(integrationInbox(rows,'p','all').map(r=>r.id),['b','a']);
  assert.equal(rows[0].id,'a');assert.equal(integrationNext('verified'),'Review and accept');
});
test('three-way merge preserves disjoint parent and task edits and rejects overlaps',()=>{
  assert.equal(mergeIntegration('abc\ndef\nghi','Abc\ndef\nghi','abc\ndef\nghI'),'Abc\ndef\nghI');
  assert.equal(mergeIntegration('abc','aXc','aYc'),null);
  assert.equal(mergeIntegration('abc','aXbc','aYbc'),null);
  assert.equal(mergeIntegration('abc','abc','updated'),'updated');
  assert.equal(mergeIntegration('abc','user','abc'),'user');
});
