import test from 'node:test';
import assert from 'node:assert/strict';
import {coreFormDrafts,jobCreationKey} from '../src/features/core/form-drafts.ts';
import {RemoteCoreClient} from '../src/features/core/remote-client.ts';
import {startCoreServer} from '../transport/server.ts';
import type {Project} from '../src/features/projects/types/project.ts';
test('ordinary project form drafts survive serialization without adding token or unknown fields',()=>{
 const saved=coreFormDrafts({agent:{name:'User label',cpu:'8',docker:true,token:'dummy-excluded'},job:{name:'Check',args:'["--version"]',requestId:'00112233-4455-6677-8899-aabbccddeeff'},token:'dummy-excluded'});
 assert.equal(saved.agent.name,'User label');assert.equal(saved.agent.cpu,'8');assert.equal(saved.agent.docker,true);assert.deepEqual(coreFormDrafts(JSON.parse(JSON.stringify(saved))),saved);assert(!JSON.stringify(saved).includes('dummy-excluded'));
 assert.equal(jobCreationKey(saved.job),saved.job.requestId);assert.match(jobCreationKey({requestId:'bad'}),/^[a-f0-9-]{36}$/);
});
test('corrupt form values cannot replace expected field types or grow without a bound',()=>{
 const saved=coreFormDrafts({agent:{cpu:{},docker:'yes',name:'x'.repeat(10001)},job:{args:false,priority:5}});assert.equal(saved.agent.cpu,'1');assert.equal(saved.agent.docker,false);assert.equal(saved.agent.name,'');assert.equal(saved.job.args,'[]');assert.equal(saved.job.priority,'0');
});
test('lost actual Core creation reply is reconciled and same-key retry creates no duplicate',async()=>{
 const token='dummy-form-reconcile-token',server=await startCoreServer({port:0,agentToken:token,studioToken:token}),client=new RemoteCoreClient();const now=new Date().toISOString();const project:Project={id:crypto.randomUUID(),name:'Reconcile fixture',description:'',workspacePath:null,browserFolder:true,repositoryUrl:null,defaultBranch:null,framework:null,runtime:null,packageManager:null,projectType:null,gitEnabled:null,createdAt:now,updatedAt:now,lastOpenedAt:null};
 const wait=async(fn:()=>boolean)=>{for(let n=0;n<150;n++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Reconcile timed out');};
 try{
  client.connect(`ws://127.0.0.1:${server.port}/studio`,token,project);await wait(()=>client.connected);
  const socket=(client as unknown as {ws:WebSocket}).ws,handler=socket.onmessage!;socket.onmessage=e=>{const value=JSON.parse(String(e.data));if(value.type==='reply'){socket.close();return;}handler.call(socket,e);};
  const key=jobCreationKey(coreFormDrafts(null).job),input={name:'Preserved request',idempotencyKey:key,requirements:{},payload:{task:'preserved',steps:[{name:'test',executable:'node',args:['-v'],cwd:'.'}]}};
  await assert.rejects(client.createJob(project.id,input),/disconnected/);assert.equal(server.service.snapshot(project.id).jobs.length,1);
  client.reconnect();await wait(()=>client.connected);const existing=client.snapshot(project.id).jobs.find(j=>j.idempotencyKey===key);assert(existing);
  const retry=await client.createJob(project.id,input);assert.equal(retry.id,existing.id);assert.equal(server.service.snapshot(project.id).jobs.length,1);
 }finally{client.disconnect();await server.close();}
});
