import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { startCoreServer } from '../transport/server.ts';
import { decode, RunLogs } from '../transport/protocol.ts';
const token='test-only-token-never-production';
const caps={cpuCores:2,memoryMiB:4096,docker:false,gpu:false,pty:false,runtimes:{node:'24.11.1'},browsers:[]};
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean){for(let i=0;i<100;i++){if(fn())return;await pause(30);}throw Error('Condition timed out');}
async function peer(port:number,path:string){const ws=new WebSocket(`ws://127.0.0.1:${port}/${path}`);const messages:Record<string,unknown>[]=[];ws.on('message',raw=>messages.push(JSON.parse(raw.toString())));ws.on('error',()=>{});await once(ws,'open');return {ws,messages,send:(m:object)=>ws.send(JSON.stringify({protocolVersion:1,...m}))};}
const project={id:'project-test',name:'Transport test',description:'',workspacePath:null,browserFolder:true,repositoryUrl:null,defaultBranch:null,framework:null,runtime:null,packageManager:null,projectType:null,gitEnabled:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lastOpenedAt:null};
test('wire protocol rejects malformed, version mismatch and oversized frames',()=>{assert.throws(()=>decode('{'));assert.throws(()=>decode('{"type":"heartbeat","protocolVersion":2}'));assert.throws(()=>decode('x'.repeat(65537)));assert.equal(decode('{"type":"heartbeat","protocolVersion":1}').type,'heartbeat');});
test('output is bounded and duplicate sequences are ignored',()=>{const logs=new RunLogs();for(let i=1;i<1000;i++)logs.append('run',i,'stdout','x'.repeat(4096));logs.append('run',999,'stdout','duplicate');const rows=logs.read(['run']).run;assert(rows.reduce((n,r)=>n+r.text.length,0)<=131072);assert(!rows.some(r=>r.text==='duplicate'));assert.throws(()=>logs.append('run',1001,'invalid','text'));});
test('safe binding and credential configuration fail closed',async()=>{await assert.rejects(startCoreServer({host:'0.0.0.0',agentToken:token,studioToken:token}));await assert.rejects(startCoreServer({agentToken:'',studioToken:''}));});
test('real WebSocket registration, heartbeat, execution events, cancellation, offline and reconnect',async()=>{
 const server=await startCoreServer({port:0,agentToken:token,studioToken:token,heartbeatTimeoutMs:600});const peers:WebSocket[]=[];
 try{
 const studio=await peer(server.port,'studio');peers.push(studio.ws);studio.send({type:'subscribe',token,project});await until(()=>studio.messages.some(m=>m.type==='snapshot'));
 const agent=await peer(server.port,'agent');peers.push(agent.ws);agent.send({type:'register',token,agentId:'agent-test',name:'Agent',agentVersion:'0.1.0',platform:'windows',architecture:'x86_64',capabilities:caps});await until(()=>agent.messages.some(m=>m.type==='registered'));
 const previous=server.service.getAgent('agent-test')!.lastSeenAt;await pause(5);agent.send({type:'heartbeat',agentId:'agent-test',timestamp:new Date().toISOString(),status:'idle'});await until(()=>server.service.getAgent('agent-test')!.lastSeenAt!==previous);
 const job=await server.service.createJob(project.id,{name:'Execution',requirements:{},payload:{task:'command',steps:[{name:'command',executable:'node',args:['-v'],cwd:'.'}]}});
 studio.send({type:'rpc',requestId:'dispatch-one',method:'dispatch',args:[]});await until(()=>agent.messages.some(m=>m.type==='execute'));const execute=agent.messages.find(m=>m.type==='execute')!;const ids={runId:execute.runId,jobId:job.id};
 agent.send({type:'accepted',...ids});await until(()=>server.service.snapshot(project.id).runs[0].status==='running');
 agent.send({type:'output',...ids,sequence:1,stream:'stdout',text:'hello'});agent.send({type:'output',...ids,sequence:2,stream:'stderr',text:'warning'});await until(()=>server.logs.read([execute.runId as string])[execute.runId as string].length===2);
 const now=new Date().toISOString();agent.send({type:'result',...ids,status:'passed',exitCode:0,startedAt:now,finishedAt:now});await until(()=>server.service.snapshot(project.id).runs[0].status==='passed');assert.equal(server.service.snapshot(project.id).jobs[0].status,'succeeded');assert.equal(server.service.getAgent('agent-test')!.status,'idle');
 agent.ws.send('{bad');await until(()=>agent.messages.some(m=>m.type==='error'));assert.equal(server.service.getAgent('agent-test')!.status,'idle');
 const second=await server.service.createJob(project.id,{name:'Cancel',requirements:{},payload:{task:'command',steps:[{name:'command',executable:'node',args:[],cwd:'.'}]}});studio.send({type:'rpc',requestId:'dispatch-two',method:'dispatch',args:[]});await until(()=>agent.messages.filter(m=>m.type==='execute').length===2);const next=agent.messages.filter(m=>m.type==='execute')[1];agent.send({type:'accepted',runId:next.runId,jobId:second.id});await until(()=>server.service.snapshot(project.id).runs[1].status==='running');studio.send({type:'rpc',requestId:'cancel-two',method:'cancelJob',args:[second.id]});await until(()=>agent.messages.some(m=>m.type==='cancel'));agent.send({type:'result',runId:next.runId,jobId:second.id,status:'cancelled',exitCode:null,startedAt:now,finishedAt:now});await until(()=>server.service.snapshot(project.id).runs[1].status==='cancelled');
 await until(()=>server.service.getAgent('agent-test')!.status==='offline');
 const restarted=await peer(server.port,'agent');peers.push(restarted.ws);restarted.send({type:'register',token,agentId:'agent-test',name:'Agent',agentVersion:'0.1.0',platform:'windows',architecture:'x86_64',capabilities:caps});await until(()=>server.service.getAgent('agent-test')!.status==='idle');assert.equal(server.service.listAgents().length,1);
 }finally{for(const p of peers)p.terminate();await server.close();}
});
test('authentication, protocol mismatch, oversize and wrong Origin reject without crashing Core',async()=>{const server=await startCoreServer({port:0,agentToken:token,studioToken:token});try{const origin=new WebSocket(`ws://127.0.0.1:${server.port}/studio`,{origin:'https://untrusted.example'});origin.on('error',()=>{});await new Promise<void>(resolve=>origin.once('unexpected-response',(_req,res)=>{assert.equal(res.statusCode,403);res.resume();origin.terminate();resolve();}));for(const data of [{type:'register',token:'wrong'},{type:'register',token,protocolVersion:99}]){const p=await peer(server.port,'agent');p.send(data);await once(p.ws,'close');assert(p.messages.some(m=>m.type==='error'));}const big=await peer(server.port,'agent');big.ws.send('x'.repeat(70000));await once(big.ws,'close');assert.equal(server.service.listAgents().length,0);}finally{await server.close();}});

