import test from 'node:test';
import assert from 'node:assert/strict';
import {executionReport} from '../transport/execution-report.ts';
import fs from 'node:fs';
import path from 'node:path';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {startCoreServer} from '../transport/server.ts';

test('old Agent protocol-v1 results stay compatible without optional metadata',()=>{
 assert.equal(executionReport({status:'passed'}),undefined);
});
test('execution outcomes distinguish test failure from environment, connection and lifecycle failures',()=>{
 for(const [classification,status] of [['PASSED','passed'],['TEST_FAILED','failed'],['EXECUTION_ERROR','failed'],['TIMEOUT','timeout'],['CANCELLED','cancelled'],['CONNECTION_LOST','cancelled'],['AGENT_SHUTDOWN','cancelled'],['AGENT_RESTARTED','failed'],['CAPABILITY_MISMATCH','failed']]) {
  assert.equal(executionReport({classification,status})?.classification,classification);
  assert.throws(()=>executionReport({classification,status:status==='passed'?'failed':'passed'}),/match/);
 }
 assert.throws(()=>executionReport({classification:'invented',status:'failed'}),/classification/);
});
test('bounded partial output counters survive validation without source text',()=>{
 const outputSummary={totalChunks:5,droppedChunks:2,droppedBytes:8192,forwardedBytes:12288,partial:true};
 assert.deepEqual(executionReport({classification:'PASSED',status:'passed',outputSummary}),{classification:'PASSED',outputSummary});
 for(const invalid of [null,[],{...outputSummary,partial:false},{...outputSummary,droppedChunks:6},{...outputSummary,droppedBytes:-1},{...outputSummary,totalChunks:Number.MAX_SAFE_INTEGER+1},{...outputSummary,forwardedBytes:1048577}])assert.throws(()=>executionReport({classification:'PASSED',status:'passed',outputSummary:invalid}),/summary/);
});
test('classified partial output persists through actual Core result ACK, duplicate and restart',async()=>{
 const evidence=path.resolve('../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-3');
 fs.mkdirSync(evidence,{recursive:true});const directory=fs.mkdtempSync(path.join(evidence,'report-store-'));
 const storagePath=path.join(directory,'core.sqlite'),storageKey=new Uint8Array(32).fill(7);
 const agentToken='dummy-agent-reliability-token',studioToken='dummy-studio-reliability-token';
 const server=await startCoreServer({port:0,storagePath,storageKey,agentToken,studioToken});
 const peers:WebSocket[]=[];
 const until=async(fn:()=>boolean)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Core report condition timed out');};
 const peer=async(route:string)=>{
  const ws=new WebSocket(`ws://127.0.0.1:${server.port}/${route}`);peers.push(ws);ws.on('error',()=>{});
  const messages:Record<string,unknown>[]=[];ws.on('message',raw=>messages.push(JSON.parse(raw.toString())));await once(ws,'open');
  return {messages,send:(message:object)=>ws.send(JSON.stringify({protocolVersion:1,...message}))};
 };
 const project={id:'reliability-project',name:'Reliability fixture',description:'',workspacePath:null,browserFolder:true,repositoryUrl:null,defaultBranch:null,framework:null,runtime:null,packageManager:null,projectType:null,gitEnabled:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lastOpenedAt:null};
 let runId='';const report={classification:'PASSED' as const,outputSummary:{totalChunks:8,droppedChunks:2,droppedBytes:100,forwardedBytes:500,partial:true}};
 try{
  const studio=await peer('studio');studio.send({type:'subscribe',token:studioToken,project});await until(()=>studio.messages.some(m=>m.type==='snapshot'));
  const agent=await peer('agent');agent.send({type:'register',token:agentToken,agentId:'reliability-agent',name:'fixture',agentVersion:'0.1.2',platform:'windows',architecture:'x86_64',capabilities:{cpuCores:2,memoryMiB:2048,docker:false,gpu:false,pty:false,runtimes:{node:'24.11.1'},browsers:[]}});
  await until(()=>agent.messages.some(m=>m.type==='registered'));agent.send({type:'heartbeat',agentId:'reliability-agent',timestamp:new Date().toISOString(),status:'idle'});await until(()=>server.service.getAgent('reliability-agent')?.status==='idle');
  const job=await server.service.createJob(project.id,{name:'report',requirements:{},payload:{task:'report',steps:[{name:'report',executable:'node',args:['-v'],cwd:'.'}]}});
  const run=server.service.dispatch(project.id)!.run;runId=run.id;
  agent.send({type:'accepted',runId,jobId:job.id});await until(()=>server.service.snapshot(project.id).runs[0].status==='running');
  const now=new Date().toISOString(),result={type:'result',runId,jobId:job.id,status:'passed',exitCode:0,startedAt:now,finishedAt:now,...report};
  agent.send(result);await until(()=>agent.messages.some(m=>m.type==='ack'));
  assert.deepEqual(server.service.snapshot(project.id).runs[0].executionReport,report);
  agent.send({...result,outputSummary:{...report.outputSummary,droppedChunks:7}});await until(()=>agent.messages.filter(m=>m.type==='ack').length===2);
  assert.deepEqual(server.service.snapshot(project.id).runs[0].executionReport,report);
 }finally{for(const ws of peers)ws.terminate();await server.close();}
 const reopened=await startCoreServer({port:0,storagePath,storageKey,agentToken,studioToken});
 try{assert.deepEqual(reopened.service.snapshot(project.id).runs.find(r=>r.id===runId)?.executionReport,report);}finally{await reopened.close();}
});
