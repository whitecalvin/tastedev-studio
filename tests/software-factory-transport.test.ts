import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {startCoreServer} from '../transport/server.ts';
import {RemoteCoreClient} from '../src/features/core/remote-client.ts';
import {uploadProjectSnapshot} from '../src/features/core/source-upload.ts';
import {buildProjectSnapshot} from '../src/features/ai/project-snapshot.ts';
import {factoryTemplate} from '../src/features/orchestration/factory-template.ts';
import {initialGraph} from '../src/features/orchestration/domain.ts';
import {emptyAIConfigurations} from '../src/features/orchestration/ai-config.ts';
import type {FactoryContract,FactoryOverview} from '../src/features/orchestration/factory.ts';
import type {GraphOverview} from '../src/features/orchestration/execution.ts';
import type {Project} from '../src/features/projects/types/project.ts';

test('real authenticated Factory RPC, uploaded Source, encrypted restart and project boundary',async()=>{
  const root=path.resolve('resources/verification/software-factory-20261017/wire',crypto.randomUUID());fs.mkdirSync(root,{recursive:true});
  const token=crypto.randomUUID(),project={id:crypto.randomUUID(),name:'Factory wire'} as Project;
  const options={port:0,agentToken:token,studioToken:token,storagePath:path.join(root,'core.sqlite'),storageKey:new Uint8Array(32).fill(23),artifactRoot:path.join(root,'artifacts')};
  let server=await startCoreServer(options);const client=new RemoteCoreClient();
  async function connect(){client.connect('ws://127.0.0.1:'+server.port+'/studio',token,project);for(let i=0;i<200&&!client.connected;i++)await new Promise(r=>setTimeout(r,10));assert.equal(client.connected,true);}
  try{
    await connect();const draft=factoryTemplate(project.id,initialGraph(project.id),emptyAIConfigurations(project.id));
    const {snapshot}=await buildProjectSnapshot({list:async()=>[{name:'a.ts',path:'src/a.ts',kind:'file'}],read:async()=>({content:'export const a=1;',size:17,modified:0})},{projectId:project.id,proposalId:crypto.randomUUID(),attempt:1,baseRevision:'wire',changedFiles:[]});
    const reference=await uploadProjectSnapshot(snapshot,(route,init)=>fetch('http://127.0.0.1:'+server.port+route,{...init,headers:{...init.headers,Authorization:'Bearer '+token,'X-Project-Id':project.id}}));
    const published=await client.graphRequest<GraphOverview>('publish',{graph:draft.graph,aiConfigurations:draft.configurations,sources:{'project.yml':'version: 1\nproject: {name: Factory, type: node}'},snapshot:reference,expectedRevision:0}),d=published.definition!;
    const contract:FactoryContract={projectId:project.id,taskId:'wire-task',objective:'Repair source',acceptance:['Tests pass','Independent review'],paths:['src'],resources:['project:'+project.id],dependencies:[],entryNodeId:'factory-implementation',implementationNodeId:'factory-implementation',reviewNodeId:'factory-review',revision:d.revision,checksum:d.checksum,inputChecksum:d.inputChecksum,sourceChecksum:d.source!.checksum,maxAttempts:3,timeoutMinutes:10};
    const created=await client.factoryRequest<FactoryOverview>('create',{contract});assert.equal(created.tasks[0].status,'draft');assert.equal(server.graphExecution.overview(project.id).executions.length,0);
    const queued=await client.factoryRequest<FactoryOverview>('queue',{taskId:contract.taskId,version:created.tasks[0].version});assert.equal(queued.tasks[0].status,'running');const executionId=queued.tasks[0].attempts[0].executionId;
    assert.equal(server.graphExecution.overview(project.id).executions[0].activations[0].status,'ai-review');
    client.disconnect();await server.close();server=await startCoreServer(options);await connect();
    const restored=await client.factoryRequest<FactoryOverview>('list');assert.equal(restored.durable,true);assert.equal(restored.tasks[0].status,'paused');assert.equal(restored.tasks[0].attempts[0].executionId,executionId);
    const resumed=await client.factoryRequest<FactoryOverview>('resume',{taskId:contract.taskId,version:restored.tasks[0].version});assert.equal(resumed.tasks[0].status,'running');assert.equal(server.graphExecution.overview(project.id).executions.length,1);
    await client.factoryRequest('cancel',{taskId:contract.taskId,version:resumed.tasks[0].version});
    await assert.rejects(client.factoryRequest('queue',{taskId:contract.taskId,version:1}),/changed/);
    const other={id:crypto.randomUUID(),name:'Other'} as Project;client.disconnect();client.connect('ws://127.0.0.1:'+server.port+'/studio',token,other);for(let i=0;i<200&&!client.connected;i++)await new Promise(r=>setTimeout(r,10));assert.equal((await client.factoryRequest<FactoryOverview>('list')).tasks.length,0);await assert.rejects(client.factoryRequest('cancel',{taskId:contract.taskId,version:1}),/not found/);
  }finally{client.disconnect();await server.close();}
});
