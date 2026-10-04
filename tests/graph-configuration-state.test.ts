import test from 'node:test';
import assert from 'node:assert/strict';
import {graphConfigurationState} from '../src/features/orchestration/configuration-state.ts';
import {initialGraph} from '../src/features/orchestration/domain.ts';
import type {GraphOverview} from '../src/features/orchestration/execution.ts';
const graph=initialGraph('project-a');
const definition={projectId:graph.projectId,graph:structuredClone(graph)} as NonNullable<GraphOverview['definition']>;
test('new execution readiness distinguishes unpublished, unsaved and configuration drift',()=>{
 assert.equal(graphConfigurationState(null,graph,true,false),'unpublished');
 assert.equal(graphConfigurationState(definition,graph,true,true),'unsaved');
 assert.equal(graphConfigurationState(definition,{...graph,retryLimit:2},true,false),'graph-changed');
 assert.equal(graphConfigurationState({...definition,projectId:'foreign'},graph,true,false),'graph-changed');
 assert.equal(graphConfigurationState(definition,graph,false,false),'ai-changed');
 assert.equal(graphConfigurationState(definition,graph,true,false),'ready');
});
test('readiness never reconciles or mutates the published configuration or history',()=>{
 const frozen=structuredClone(definition),baseline=JSON.stringify(frozen);
 graphConfigurationState(frozen,{...graph,retryLimit:2},false,true);
 assert.equal(JSON.stringify(frozen),baseline);
 assert.equal(graphConfigurationState(frozen,graph,false,false),'ai-changed');
});
