import test from 'node:test';
import assert from 'node:assert/strict';
import {executionPreview,executionReviewKey,reviewedExecutionInput} from '../src/features/orchestration/execution-preview.ts';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import type {ProjectSnapshot} from '../src/features/ai/project-snapshot.ts';
import type {GraphOverview} from '../src/features/orchestration/execution.ts';

const snapshot=(id:string):ProjectSnapshot=>({schemaVersion:2,provider:'snapshot',snapshotId:id,projectId:'p',proposalId:'proposal',attempt:1,baseRevision:'tree',changedFiles:[],files:[],checksum:'1'.repeat(64)});
function fixture(){
 const graph=initialGraph('p');for(const id of ['a','b','deploy','retry']){graph.nodes.push({...newNode('task',id,graph.nodes.length),reference:'test'});graph.edges.push({id:'role-'+id,from:'role-implementation',to:id,relation:'performs'});}
 graph.nodes.push(newNode('approval','gate',graph.nodes.length));
 graph.edges.push({id:'ag',from:'a',to:'gate',relation:'success'},{id:'ab',from:'a',to:'b',relation:'success'},{id:'gd',from:'gate',to:'deploy',relation:'success'},{id:'ar',from:'a',to:'retry',relation:'failure'});
 const definition:NonNullable<GraphOverview['definition']>={projectId:'p',revision:1,checksum:'a'.repeat(64),inputChecksum:'b'.repeat(64),publishedAt:'2026-11-03',graph:structuredClone(graph),agents:{a:['agent'],b:['agent'],deploy:['agent'],retry:['agent']}};
 return{graph,definition};
}
test('preview groups success dependencies, retains approval gates and keeps failure paths conditional',()=>{
 const f=fixture(),before=JSON.stringify(f),plan=executionPreview(f.graph,f.definition,'a');
 assert.equal(plan.blocked,false);assert.deepEqual(plan.levels.map(l=>l.map(r=>r.nodeId)),[['a'],['gate','b'],['deploy']]);
 assert.equal(plan.levels[1][0].kind,'approval');assert.deepEqual(plan.failurePaths,[{from:'a',to:'retry'}]);assert.equal(JSON.stringify(f),before);
});
test('preview rejects unsaved, foreign and invalid entry configurations',()=>{
 const f=fixture();assert(executionPreview(f.graph,f.definition,'missing').blocked);assert(executionPreview(f.graph,f.definition,'deploy').blocked);
 assert(executionPreview({...f.graph,projectId:'other'},f.definition,'a').blocked);assert(executionPreview({...f.graph,nodes:f.graph.nodes.slice(0,-1)},f.definition,'a').blocked);
});
test('review binds exact graph, input, Source, root, timeout and connection generation',()=>{
 const {definition}=fixture();const key=executionReviewKey(definition,'a',10,1)!;
 assert.deepEqual(reviewedExecutionInput(definition,'a',10,1,key),{revision:1,checksum:definition.checksum,entryNodeId:'a',timeoutMinutes:10});
 for(const d of [{...definition,revision:2},{...definition,checksum:'c'.repeat(64)},{...definition,inputChecksum:'c'.repeat(64)},{...definition,source:{...snapshot('new-source'),checksum:'d'.repeat(64)}}])assert.throws(()=>reviewedExecutionInput(d,'a',10,1,key),/Review/);
 assert.throws(()=>reviewedExecutionInput(definition,'retry',10,1,key),/Review/);assert.throws(()=>reviewedExecutionInput(definition,'a',11,1,key),/Review/);assert.throws(()=>reviewedExecutionInput(definition,'a',10,2,key),/Review/);
 assert.equal(executionReviewKey(definition,'a',NaN,1),null);assert.equal(executionReviewKey(definition,'a',121,1),null);
});
test('Source replacement and cross-project Source cannot reuse a checked review',()=>{
 const {definition}=fixture();const source=snapshot('first');definition.source=source;
 const key=executionReviewKey(definition,'a',10,1)!;
 for(const change of [{snapshotId:'second'},{checksum:'2'.repeat(64)},{baseRevision:'new-tree'}])assert.throws(()=>reviewedExecutionInput({...definition,source:{...source,...change}},'a',10,1,key),/Review/);
 assert.equal(executionReviewKey({...definition,source:{...source,projectId:'other'}},'a',10,1),null);
});
