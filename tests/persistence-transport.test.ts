import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {once} from 'node:events';import {WebSocket} from 'ws';
import {startCoreServer} from '../transport/server.ts';
import {RunLogs} from '../transport/protocol.ts';
const token='controlled-persistence-token-2026';
const project={id:'persistence-project',name:'Persistence fixture',description:'',workspacePath:null,browserFolder:true,repositoryUrl:null,defaultBranch:null,framework:null,runtime:null,packageManager:null,projectType:null,gitEnabled:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lastOpenedAt:null};
const root=fileURLToPath(new URL('../../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-1/transport-unit/',import.meta.url));
const caps={cpuCores:4,memoryMiB:8192,docker:false,gpu:false,pty:false,runtimes:{node:'24.11.1'},browsers:[]};
async function peer(port:number,kind:string){const ws=new WebSocket(`ws://127.0.0.1:${port}/${kind}`);const messages:Record<string,unknown>[]=[];ws.on('message',r=>messages.push(JSON.parse(r.toString())));await once(ws,'open');return{ws,messages,send(v:object){ws.send(JSON.stringify({protocolVersion:1,...v}));}};}
async function until(check:()=>unknown){const end=Date.now()+4000;while(!check()){if(Date.now()>end)throw Error('Timed out');await new Promise(r=>setTimeout(r,10));}}
test('queued Job, Project, Run logs and dedup sequence survive actual Core reopen',async()=>{
 fs.mkdirSync(root,{recursive:true});const dir=fs.mkdtempSync(path.join(root,'case-'));const storagePath=path.join(dir,'core.sqlite');const opts={port:0,agentToken:token,studioToken:token,storagePath,storageKey:Buffer.alloc(32,3)};
 let server=await startCoreServer(opts);const sockets:WebSocket[]=[];
 try{const p=await peer(server.port,'studio');sockets.push(p.ws);p.send({type:'subscribe',token,project});await until(()=>p.messages.some(m=>m.type==='snapshot'));
 const job=await server.service.createJob(project.id,{name:'restored job',requirements:{},payload:{task:'version',steps:[{name:'version',executable:'node',args:['-v'],cwd:'.'}]}});
 server.logs.append('prior-run',1,'stdout','retained log');await server.close();server=await startCoreServer(opts);
 assert.equal(server.service.queue(project.id)[0].id,job.id);assert.equal(server.service.queue(project.id).length,1);server.logs.append('prior-run',1,'stdout','duplicate');assert.deepEqual(server.logs.read(['prior-run'])['prior-run'].map(r=>r.text),['retained log']);
 const second=await server.service.createJob(project.id,{name:'project restored',requirements:{},payload:{task:'version',steps:[{name:'version',executable:'node',args:['-v'],cwd:'.'}]}});assert.ok(second.id);
 const a=await peer(server.port,'agent');sockets.push(a.ws);a.send({type:'register',token,agentId:'persist-agent',name:'Agent',agentVersion:'0.1.0',platform:'windows',architecture:'x86_64',capabilities:caps});await until(()=>a.messages.some(m=>m.type==='registered'));
 const studio=await peer(server.port,'studio');sockets.push(studio.ws);studio.send({type:'subscribe',token,project});await until(()=>studio.messages.some(m=>m.type==='snapshot'));studio.send({type:'rpc',requestId:'dispatch',method:'dispatch',args:[job.id]});await until(()=>a.messages.some(m=>m.type==='execute'));
 const e=a.messages.find(m=>m.type==='execute')!;const ids={jobId:job.id,runId:e.runId};a.send({type:'accepted',...ids});await until(()=>server.service.snapshot(project.id).runs[0].status==='running');const now=new Date().toISOString();a.send({type:'result',...ids,status:'passed',exitCode:0,startedAt:now,finishedAt:now});await until(()=>server.service.snapshot(project.id).runs[0].status==='passed');assert.equal(a.messages.filter(m=>m.type==='execute').length,1);
 await server.close();server=await startCoreServer(opts);assert.equal(server.service.snapshot(project.id).runs[0].status,'passed');assert.equal(server.service.getAgent('persist-agent')?.status,'offline');assert.equal(server.service.snapshot(project.id).runs.length,1);
 }finally{for(const ws of sockets)ws.terminate();await server.close();assert.ok(path.resolve(dir).startsWith(path.resolve(root)+path.sep));fs.rmSync(dir,{recursive:true,force:true});}
});
test('log persistence failure preserves previous memory and sequence',()=>{let fail=false;const logs=new RunLogs(undefined,()=>{if(fail)throw Error('controlled failure');});logs.append('r',1,'stdout','one');fail=true;assert.throws(()=>logs.append('r',2,'stdout','two'));assert.equal(logs.read(['r']).r.length,1);fail=false;logs.append('r',2,'stdout','two');assert.equal(logs.read(['r']).r.length,2);});
