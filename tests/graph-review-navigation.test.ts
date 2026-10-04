import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisReviewLocation,graphReviewLocation,resolveReviewReturn} from '../src/features/orchestration/review-navigation.ts';
import type {GraphActivation,GraphOverview} from '../src/features/orchestration/execution.ts';
import type {AnalysisRecord} from '../src/features/ai/domain.ts';
const e={id:'execution-a',projectId:'project-a'},a={id:'activation-a',nodeId:'repair',analysisId:'analysis-a',leaseId:'lease-a',status:'ai-fix-review'} as GraphActivation;
const record={id:a.analysisId,projectId:e.projectId,task:{nodeId:a.nodeId,graph:{executionId:e.id,activationId:a.id,leaseId:a.leaseId}}} as AnalysisRecord;
function overview(activations:GraphActivation[]=[a]){return {executions:[{...e,activations}]} as GraphOverview;}
test('review return resolves exact activation, never latest Run or repeated node',()=>{
 const location=graphReviewLocation(e.projectId,e,a,record);
 assert.equal(resolveReviewReturn(location,e.projectId,null),'loading');
 assert.equal(resolveReviewReturn(location,e.projectId,overview([a,{...a,id:'newer',analysisId:'new-analysis'}])),'ready');
 assert.equal(resolveReviewReturn(location,e.projectId,overview([{...a,id:'newer'}])),'unavailable');
 assert.equal(resolveReviewReturn(location,e.projectId,overview([{...a,analysisId:'new-analysis'}])),'unavailable');
 assert.equal(resolveReviewReturn(location,'other-project',overview()),'unavailable');
 assert.equal(resolveReviewReturn(location,e.projectId,overview([{...a,status:'cancelled'}])),'ready');
});
test('foreign/stale analyses cannot create a graph navigation target',()=>{
 for(const changed of [{...record,projectId:'foreign'},{...record,id:'foreign'},{...record,task:{...record.task!,graph:{...record.task!.graph!,leaseId:'stale'}}}])assert.throws(()=>graphReviewLocation(e.projectId,e,a,changed),/mismatch/);
 assert.throws(()=>graphReviewLocation('foreign',e,a),/mismatch/);
 assert.throws(()=>graphReviewLocation(e.projectId,e,{...a,analysisId:undefined}),/mismatch/);
});
test('navigation identity is a copy with no approval or lease capability',()=>{
 const input={...a},location=graphReviewLocation(e.projectId,e,input,record);input.nodeId='changed';
 assert.equal(location.nodeId,'repair');assert.equal('leaseId' in location,false);assert.equal('approvedAt' in location,false);
});

test('restored analysis history returns to its original activation without retaining authority',()=>{
 const restored=JSON.parse(JSON.stringify(record)) as AnalysisRecord;
 const location=analysisReviewLocation(e.projectId,restored)!;
 assert.deepEqual(location,graphReviewLocation(e.projectId,e,a,record));
 assert.equal(resolveReviewReturn(location,e.projectId,null),'loading');
 assert.equal(resolveReviewReturn(location,e.projectId,overview()),'ready');
 assert.equal(resolveReviewReturn(location,e.projectId,overview([{...a,id:'newer'}])),'unavailable');
 assert.equal('leaseId' in location,false);
 restored.task!.graph!.executionId='mutated';
 assert.equal(location.executionId,e.id);
});

test('ordinary, foreign and incomplete history cannot create a graph return target',()=>{
 assert.equal(analysisReviewLocation('foreign',record),null);
 assert.equal(analysisReviewLocation(e.projectId,{...record,task:undefined}),null);
 for(const key of ['executionId','activationId'] as const){
  assert.equal(analysisReviewLocation(e.projectId,{...record,task:{...record.task!,graph:{...record.task!.graph!,[key]:''}}}),null);
 }
 assert.equal(analysisReviewLocation(e.projectId,{...record,task:{...record.task!,nodeId:' '}}),null);
 assert.equal(analysisReviewLocation(e.projectId,{...record,id:'x'.repeat(201)}),null);
});
