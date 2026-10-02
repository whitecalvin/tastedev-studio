import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionPresentation} from '../src/features/core/connection-presentation.ts';
import type {CoreSnapshot,AgentStatus} from '../src/features/core/domain.ts';
const snapshot:CoreSnapshot={agents:(['offline','idle','busy','online','error'] as AgentStatus[]).map((status,i)=>({id:String(i),name:status,status,platform:'windows',architecture:'x86_64',capabilities:{cpuCores:1,memoryMiB:512,docker:false,gpu:false,pty:false,runtimes:{},browsers:[]},lastSeenAt:null,createdAt:'2026-10-03T00:00:00Z',updatedAt:'2026-10-03T00:00:00Z'})),jobs:[],runs:[],steps:[],artifacts:[],events:[]};
test('Core summary counts only connected Agents and uses actual endpoint',()=>{
 const state=connectionPresentation('connected','ws://127.0.0.1:4340/studio\0project',snapshot);
 assert.equal(state.host,'127.0.0.1:4340');assert.equal(state.agents,3);assert.equal(state.idle,1);assert.equal(state.busy,1);assert.equal(state.tone,'connected');
});
test('disconnection hides stale Agent counts and recovery remains distinct',()=>{
 for(const phase of ['disabled','unavailable','authentication','error','protocol-error'] as const){const state=connectionPresentation(phase,'',snapshot);assert.equal(state.agents,0);assert.equal(state.label,'Core disconnected');}
 assert.equal(connectionPresentation('recovering','',snapshot).label,'Reconnecting to Core…');
 assert.equal(connectionPresentation('connecting','',snapshot).tone,'pending');
});
