import test from 'node:test';
import assert from 'node:assert/strict';
import {integrationOverlaps} from '../src/features/orchestration/integration-inbox.ts';
import type {IntegrationRequest} from '../src/features/orchestration/integration-requests.ts';
const row=(id:string,path:string,extra:Partial<IntegrationRequest>={})=>({id,parentProjectId:'p',phase:'submitted',baseRevision:'base',files:[{path,checksum:'one'}],...extra}) as IntegrationRequest;
test('integration overlap preserves exact paths, scopes project and excludes closed work',()=>{
 const rows=[row('a','Src/A.ts'),row('b','src\\a.ts'),row('c','src/b.ts'),row('outside','src/a.ts',{parentProjectId:'other'}),row('closed','src/a.ts',{phase:'completed'})];
 const before=JSON.stringify(rows),audit=integrationOverlaps(rows,'p');
 assert.deepEqual(audit.get('a'),[{requestId:'b',paths:['Src/A.ts'],differentBase:false,differentResult:false}]);
 assert.deepEqual(audit.get('c'),[]);assert.equal(audit.has('outside'),false);assert.equal(audit.has('closed'),false);assert.equal(JSON.stringify(rows),before);
});
test('different base and result are advisory, not fabricated patch conflicts or approvals',()=>{
 const rows=[row('a','file'),row('b','file',{baseRevision:'new',files:[{path:'file',checksum:'absent'}]})];
 assert.deepEqual(integrationOverlaps(rows,'p').get('a'),[{requestId:'b',paths:['file'],differentBase:true,differentResult:true}]);
 assert.equal(rows[0].phase,'submitted');
});
