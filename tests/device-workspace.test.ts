import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDeviceWorkspaces,deviceWorkspaceReason} from '../src/features/orchestration/device-workspace.ts';
import {DevicePolicies} from '../transport/device-execution-policy.ts';
import {devicePolicyReasons} from '../src/features/orchestration/device-execution-policy.ts';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import type {GraphDefinition} from '../src/features/orchestration/execution.ts';
import type {Agent,Job} from '../src/features/core/domain.ts';

const agent={id:'a',platform:'linux'} as Agent;
const gitJob={payload:{steps:[{source:{provider:'git',repository:'https://example.com/project.git',revision:'main'}}]}} as Job;
const binding={agentId:'a',platform:'linux' as const,source:'git' as const};
test('workspace bindings preserve configured roots and require explicit Agent, OS and Source',()=>{
 const before=JSON.stringify({binding,gitJob,agent});assert.equal(deviceWorkspaceReason([binding],gitJob,agent),null);
 assert.equal(deviceWorkspaceReason([binding],gitJob,{...agent,id:'b'}),'Agent workspace binding missing');
 assert.equal(deviceWorkspaceReason([binding],gitJob,{...agent,platform:'windows'}),'Agent workspace OS mismatch');
 assert.equal(deviceWorkspaceReason([{...binding,source:'snapshot'}],gitJob,agent),'Workspace Source mismatch');
 assert.equal(deviceWorkspaceReason([binding],{payload:{steps:[]}} as unknown as Job,agent),'Workspace Source mismatch');
 assert.equal(deviceWorkspaceReason(undefined,gitJob,agent),null);assert.equal(JSON.stringify({binding,gitJob,agent}),before);
});
test('workspace validation rejects host paths, credentials, duplicates and unbounded declarations',()=>{
 assert.deepEqual(validateDeviceWorkspaces([binding]),[binding]);
 for(const v of [[],null,[null],[binding,binding],[{...binding,root:'C:\\outside'}],[{...binding,token:'dummy'}],[{...binding,source:'existing'}],[{...binding,platform:'other'}]])assert.throws(()=>validateDeviceWorkspaces(v));
});
test('approved bindings persist with graph identity, reject foreign devices and guard assignment',()=>{
 const graph=initialGraph('p');graph.nodes.push({...newNode('agent','runner',1),reference:'a'});graph.edges.push({id:'host',from:'current-pc',to:'runner',relation:'hosts'});
 const d={projectId:'p',graph,revision:1,checksum:'a'.repeat(64)} as GraphDefinition;let saved:unknown;
 const persistence={load:()=>saved,save:(v:unknown)=>{saved=structuredClone(v);}};
 const make=()=>new DevicePolicies(()=>d,()=>{},persistence);
 const policy={graphRevision:1,graphChecksum:d.checksum,rules:[{deviceId:'current-pc',enabled:true,roles:['implementation'] as const,maximumConcurrent:1,workspaces:[binding]}]};
 const service=make();assert.throws(()=>service.request('p','save',{revision:0,policy:{...policy,rules:[{...policy.rules[0],workspaces:[{...binding,agentId:'foreign'}]}]}},'operator'),/outside/);
 assert.equal(saved,undefined);service.request('p','save',{revision:0,policy},'operator');
 const restored=make().request('p','list',undefined,'operator');assert.deepEqual(restored.policy?.rules[0].workspaces,[binding]);
 assert.deepEqual(devicePolicyReasons(restored.policy,graph,1,d.checksum,gitJob,agent,[],'implementation'),[]);
 assert.deepEqual(devicePolicyReasons(restored.policy,graph,1,d.checksum,{payload:{steps:[]}} as unknown as Job,agent,[],'implementation'),['Workspace Source mismatch']);
 assert.throws(()=>service.request('p','save',{revision:0,policy},'operator'),/changed/);
 d.revision=2;assert.throws(()=>service.request('p','save',{revision:1,policy},'operator'),/current published/);
});
