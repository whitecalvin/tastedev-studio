import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {WebSocket} from 'ws';
import {startCoreServer} from '../transport/server.ts';
import type {Project} from '../src/features/projects/types/project.ts';
import type {TeamWorkOverview} from '../src/features/orchestration/team-intent.ts';
const token='dummy-team-orchestration-test-token';
const project={id:'team-project',name:'Team RPC verification',description:'',workspacePath:null,browserFolder:true,repositoryUrl:null,defaultBranch:null,framework:null,runtime:null,packageManager:null,projectType:null,gitEnabled:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lastOpenedAt:null} as Project;
async function peer(port:number){
 const ws=new WebSocket(`ws://127.0.0.1:${port}/studio`);ws.on('error',()=>{});await once(ws,'open');
 const ready=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('subscribe timeout')),5000);ws.on('message',raw=>{const v=JSON.parse(String(raw));if(v.type==='snapshot'){clearTimeout(timer);resolve();}});});
 ws.send(JSON.stringify({type:'subscribe',protocolVersion:1,token,project}));await ready;let id=0;
 async function request(action:string,input?:unknown):Promise<TeamWorkOverview>{const requestId='team-rpc-'+(++id);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',receive);reject(Error('RPC timeout'));},5000);function receive(raw:unknown){const v=JSON.parse(String(raw));if(v.requestId!==requestId)return;clearTimeout(timer);ws.off('message',receive);if(v.error)reject(Error(v.error));else resolve(v.value);}ws.on('message',receive);ws.send(JSON.stringify({type:'rpc',protocolVersion:1,method:'team-work',requestId,args:[action,input]}));});}
 return{ws,request};
}
test('authenticated real Core RPC persists project intent and handoff across encrypted SQLite restart',async()=>{
 const root=path.resolve('resources/verification/dev-01/role-team-orchestration-20261024/rpc');await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'case-'));
 const options={port:0,agentToken:token,studioToken:token,storagePath:path.join(dir,'core.sqlite'),storageKey:Buffer.alloc(32,18),artifactRoot:path.join(dir,'artifacts')};
 let server=await startCoreServer(options),client:Awaited<ReturnType<typeof peer>>|undefined;
 try{
  client=await peer(server.port);
  const initial=await client.request('list');assert.equal(initial.durable,true);
  const content={objective:'Verify durable handoff',userRequest:'Read only this disposable context',exclusions:['No external requests'],acceptance:['Inbox survives restart'],paths:['src'],responsibility:'implementation'};
  const created=await client.request('intent-create',{revision:0,requestId:'create-intent',id:'intent',content});assert.equal(created.intents.length,1);
  const input={revision:created.revision,requestId:'handoff-once',intentId:'intent',intentVersion:1,id:'handoff',from:'leader',to:'implementation',kind:'handoff',body:'Review the saved intent'};
  await client.request('message-send',input);client.ws.terminate();await server.close();server=await startCoreServer(options);client=await peer(server.port);
  const restored=await client.request('message-send',input);assert.equal(restored.messages.length,1);assert.equal(restored.intents[0].userRequest,content.userRequest);
  await assert.rejects(client.request('intent-revise',{revision:0,intentId:'intent',intentVersion:1,content,reason:'Stale UI'}),/changed/);
 }finally{client?.ws.terminate();await server.close();}
});
