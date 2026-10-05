import test from 'node:test';
import assert from 'node:assert/strict';
import {graphArtifactPlans} from '../src/features/orchestration/artifact-plans.ts';
import type {GraphDefinition} from '../src/features/orchestration/execution.ts';
import {artifactGraphFixture} from './helpers/build-artifact-fixture.ts';

function definition():Pick<GraphDefinition,'plans'>{return {plans:{producer:{name:'Build',requirements:{},payload:{task:'build',steps:[{name:'Compile',taskReference:'build',executable:'node',args:['private-command'],cwd:'.',env:{TOKEN:'dummy-private'},buildArtifacts:{outputs:[{name:'desktop',path:'out/app.bin'}],inputs:[]}}]}},plain:{name:'Plain',requirements:{},payload:{task:'plain',steps:[{name:'Plain',executable:'node',args:[],cwd:'.'}]}}}};}
test('public graph artifact plans expose declaration identity without command, environment or grants',()=>{
 const source=definition(),result=graphArtifactPlans(source);assert.deepEqual(result,{producer:[{stepName:'Compile',taskReference:'build',outputs:[{name:'desktop',path:'out/app.bin'}],inputs:[]}]});
 assert(!JSON.stringify(result).includes('private'));assert(!('plain' in result));result.producer[0].outputs[0].path='changed';assert.equal(source.plans.producer.payload.steps[0].buildArtifacts!.outputs[0].path,'out/app.bin');
});
test('captured definitions keep their artifact paths after the current definition changes',()=>{
 const old=definition(),current=structuredClone(old);current.plans.producer.payload.steps[0].buildArtifacts!.outputs[0].path='new/app.bin';assert.equal(graphArtifactPlans(old).producer[0].outputs[0].path,'out/app.bin');assert.equal(graphArtifactPlans(current).producer[0].outputs[0].path,'new/app.bin');
});
test('invalid or credential-bearing declarations cannot become public artifact plans',()=>{
 const source=definition();source.plans.producer.payload.steps[0].buildArtifacts!.outputs[0].path='.env';assert.throws(()=>graphArtifactPlans(source));
});
test('Core overview exposes captured producer and consumer scopes without private execution payload',async()=>{
 const f=await artifactGraphFixture();await f.publish();await f.start();const overview=f.service.overview(f.projectId),plans=overview.executions[0].artifactPlans!;
 assert.equal(plans.producer[0].outputs[0].path,'out/app.exe');assert.equal(plans.consumer[0].inputs[0].fromTask,'build');assert.equal(plans.consumer[0].inputs[0].path,'received/app.exe');
 assert(!JSON.stringify(plans).includes('spoof'));assert(!JSON.stringify(plans).includes('TASTEDEV_GRAPH_CONTEXT'));assert.equal('plans' in overview.executions[0],false);
});
