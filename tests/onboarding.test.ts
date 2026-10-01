import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionDraft,defaultConnectionDraft,connectionReadiness} from '../src/features/core/onboarding.ts';
import {RemoteCoreClient} from '../src/features/core/remote-client.ts';
import {startCoreServer} from '../transport/server.ts';
import {WebSocketServer} from 'ws';
import {once} from 'node:events';
import type {CoreSnapshot} from '../src/features/core/domain.ts';
import type {Project} from '../src/features/projects/types/project.ts';
import {languages} from '../src/i18n/core.ts';
import {catalogs} from '../src/i18n/messages.ts';
import {onboardingMessages} from '../src/i18n/onboarding.ts';
const empty:CoreSnapshot={agents:[],jobs:[],runs:[],steps:[],artifacts:[],events:[]};
const now=new Date().toISOString(),project:Project={id:'onboarding-project',name:'Onboarding project',description:'',workspacePath:null,browserFolder:true,repositoryUrl:null,defaultBranch:null,framework:null,runtime:null,packageManager:null,projectType:null,gitEnabled:null,createdAt:now,updatedAt:now,lastOpenedAt:null};
const wait=async(fn:()=>boolean)=>{for(let n=0;n<150;n++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Readiness state timed out');};
test('connection drafts contain only validated noncredential endpoint and mode',()=>{
 assert.deepEqual(connectionDraft({endpoint:'wss://example.test/studio',mode:'team',token:'dummy-token'}),{endpoint:'wss://example.test/studio',mode:'team'});
 for(const endpoint of ['ws://user:password@host/studio','ws://host/studio?token=dummy','ws://host/studio#secret','https://host/studio','invalid'])assert.deepEqual(connectionDraft({endpoint,mode:'team'}),defaultConnectionDraft);
 assert.deepEqual(connectionDraft(null),defaultConnectionDraft);
});
test('readiness uses actual connected backend and Protocol state without phantom success',()=>{
 for(const phase of ['disabled','connecting','recovering','unavailable','authentication','protocol-error'] as const){const checks=connectionReadiness(phase,empty,{loading:false,status:'Valid'});assert.notEqual(checks[0].state,'ready');assert.equal(checks[1].state,'unavailable');}
 const connected=connectionReadiness('connected',empty,{loading:false,status:'Not Configured'});assert.equal(connected[0].state,'ready');assert.equal(connected[1].state,'empty');assert.equal(connected[2].state,'empty');
 assert.equal(connectionReadiness('connected',empty,{loading:true,status:'Valid'})[2].state,'loading');assert.equal(connectionReadiness('connected',empty,{loading:false,status:'Invalid'})[2].state,'error');
});
test('actual Core authentication failure is actionable and does not silently retry forever',async()=>{
 const server=await startCoreServer({port:0,agentToken:'dummy-agent-authentication-token',studioToken:'dummy-correct-studio-auth-token'}),client=new RemoteCoreClient();
 try{client.connect(`ws://127.0.0.1:${server.port}/studio`,'dummy-wrong-studio-auth-token',project);await wait(()=>client.phase==='authentication');assert.equal(client.connected,false);assert.equal(client.enabled,true);await new Promise(r=>setTimeout(r,550));assert.equal(client.phase,'authentication');client.connect(`ws://127.0.0.1:${server.port}/studio`,'dummy-correct-studio-auth-token',project);await wait(()=>client.connected);assert.equal(client.phase,'connected');assert.equal(client.lastError,'');assert.ok(client.snapshotReceivedAt);}finally{client.disconnect();await server.close();}
});
test('protocol mismatch stays distinct and stops automatic retry; explicit reconnect is possible',async()=>{
 const server=new WebSocketServer({port:0});await once(server,'listening');let count=0;server.on('connection',ws=>{count++;ws.on('message',()=>ws.send(JSON.stringify({type:'snapshot',protocolVersion:99,snapshot:empty})));});const address=server.address();assert(address&&typeof address!=='string');const client=new RemoteCoreClient();
 try{client.connect(`ws://127.0.0.1:${address.port}/studio`,'dummy-protocol-token-12345',project);await wait(()=>client.phase==='protocol-error');await new Promise(r=>setTimeout(r,550));assert.equal(count,1);assert.equal(client.connected,false);client.reconnect();await wait(()=>count===2);await wait(()=>client.phase==='protocol-error');}finally{client.disconnect();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('manual reconnect retains observed state until a fresh Core snapshot confirms recovery',async()=>{
 const token='dummy-recovery-token-123456',server=await startCoreServer({port:0,agentToken:token,studioToken:token}),client=new RemoteCoreClient();try{client.connect(`ws://127.0.0.1:${server.port}/studio`,token,project);await wait(()=>client.connected);const job=await client.createJob(project.id,{name:'retained job',idempotencyKey:'onboarding-idempotency',requirements:{},payload:{task:'retained',steps:[{name:'test',executable:'node',args:['-v'],cwd:'.'}]}});await wait(()=>client.snapshot(project.id).jobs.length===1);client.reconnect();assert.equal(client.phase,'recovering');assert.equal(client.connected,false);assert.equal(client.snapshot(project.id).jobs[0].id,job.id);await wait(()=>client.connected);assert.equal(client.snapshot(project.id).jobs[0].id,job.id);}finally{client.disconnect();await server.close();}
});
test('all onboarding messages exist across the same ten website languages',()=>{
 for(const key of Object.keys(onboardingMessages.ko))for(const language of languages.filter(l=>l!=='en'))assert.ok(catalogs[language]?.[key],language+' '+key);
});
