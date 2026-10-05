/** Actual two local Rust Agents. Disposable bytes only; no remote deployment. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {startCoreServer} from './server.ts';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import {buildProjectSnapshot} from '../src/features/ai/project-snapshot.ts';
import {uploadProjectSnapshot} from '../src/features/core/source-upload.ts';
import type {GraphOverview} from '../src/features/orchestration/execution.ts';
const evidence=path.resolve(process.env.GRAPH_EVIDENCE!),root=path.join(evidence,'actual-'+Date.now());fs.mkdirSync(root,{recursive:true});
const binary=path.resolve(process.env.AGENT_BINARY!),hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex'),token=randomUUID();assert(fs.existsSync(binary));
const project={id:randomUUID(),name:'Actual artifact transfer verification',description:'',workspacePath:null,browserFolder:true,repositoryUrl:null,defaultBranch:null,framework:null,runtime:null,packageManager:null,projectType:null,gitEnabled:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lastOpenedAt:null};
const unexpected:string[]=[],children:ChildProcess[]=[],errors:string[]=[],checks:string[]=[];
const server=await startCoreServer({port:0,agentToken:token,studioToken:token,storagePath:path.join(root,'core.sqlite'),artifactRoot:path.join(root,'artifacts'),buildArtifactRuntime:true,runtimeEvent:(level,event)=>{if(level==='error')unexpected.push(event);}});
let studio:WebSocket|undefined;const replies=new Map<string,{value:GraphOverview;error?:string}>();
async function wait(predicate:()=>boolean,timeout=45000){const deadline=Date.now()+timeout;while(!predicate()){if(Date.now()>deadline)throw Error('Actual artifact flow timeout');await new Promise(r=>setTimeout(r,25));}}
async function rpc(action:string,input?:unknown){const requestId=randomUUID();studio!.send(JSON.stringify({type:'rpc',protocolVersion:1,requestId,method:'graph',args:[action,input]}));await wait(()=>replies.has(requestId));const reply=replies.get(requestId)!;if(reply.error)throw Error(reply.error);return reply.value;}
try{
 const source=path.join(root,'source');fs.mkdirSync(source);const bytes=Buffer.from('actual-artifact\0\xff'),checksum=hash(bytes);
 fs.writeFileSync(path.join(source,'.env'),'TOKEN=dummy-excluded');
 fs.writeFileSync(path.join(source,'workflow.cjs'),`const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');const mode=process.argv[2],expected=${JSON.stringify(checksum)};if(mode==='build'){fs.mkdirSync('out',{recursive:true});fs.writeFileSync('out/app.bin',Buffer.from(${JSON.stringify(bytes.toString('hex'))},'hex'));}else{assert.equal(crypto.createHash('sha256').update(fs.readFileSync('received/app.bin')).digest('hex'),expected);if(mode==='fail')throw Error('Controlled consumer failure');}console.log(mode+' verified');`);
 const files={list:async()=>fs.readdirSync(source,{withFileTypes:true}).map(d=>({name:d.name,path:d.name,kind:'file' as const})),read:async(p:string)=>({content:fs.readFileSync(path.join(source,p),'utf8'),size:fs.statSync(path.join(source,p)).size,modified:0})};
 const built=await buildProjectSnapshot(files,{projectId:project.id,proposalId:randomUUID(),attempt:1,baseRevision:'controlled-working-tree',changedFiles:[]});assert(built.excluded.includes('.env'));
 studio=new WebSocket(`ws://127.0.0.1:${server.port}/studio`);let subscribed=false;studio.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.type==='snapshot')subscribed=true;if(m.type==='reply')replies.set(m.requestId,m);});await once(studio,'open');studio.send(JSON.stringify({type:'subscribe',protocolVersion:1,token,project}));await wait(()=>subscribed);
 const snapshot=await uploadProjectSnapshot(built.snapshot,(p,init)=>fetch(`http://127.0.0.1:${server.port}${p}`,{...init,headers:{...init.headers,Authorization:'Bearer '+token,'X-Project-Id':project.id}}));
 for(const name of ['Producer','Consumer']){const config=path.join(root,name+'.json');fs.writeFileSync(config,JSON.stringify({endpoint:`ws://127.0.0.1:${server.port}/agent`,name,workspaceRoot:path.join(root,name),heartbeatMs:200,reconnectMaxMs:500,logLevel:'error'}));const child=spawn(binary,['--config',config],{windowsHide:true,env:{...process.env,TASTEDEV_AGENT_TOKEN:token},stdio:['ignore','ignore','pipe']});children.push(child);child.stderr!.on('data',b=>errors.push(b.toString()));child.on('error',()=>errors.push('Agent failed to start'));}
 await wait(()=>server.service.listAgents().filter(a=>a.status==='idle').length===2);const agents=server.service.listAgents();for(const a of agents)assert.equal(a.capabilities.buildArtifacts,2);
 const producer=agents.find(a=>a.name==='Producer')!,consumer=agents.find(a=>a.name==='Consumer')!;assert.notEqual(producer.id,consumer.id);
 const graph=initialGraph(project.id);graph.nodes.push(newNode('device','consumer-pc',0),{...newNode('agent','producer-agent',1),reference:producer.id},{...newNode('agent','consumer-agent',2),reference:consumer.id},{...newNode('role','consumer-role',3),role:'deployment'},{...newNode('task','build-node',4),reference:'build'},newNode('approval','review',5),{...newNode('task','consumer-node',6),reference:'verify'});
 graph.edges.push({id:'producer-host',from:'current-pc',to:'producer-agent',relation:'hosts'},{id:'consumer-host',from:'consumer-pc',to:'consumer-agent',relation:'hosts'},{id:'consumer-role',from:'consumer-pc',to:'consumer-role',relation:'assigns'},{id:'produce',from:'role-implementation',to:'build-node',relation:'performs'},{id:'consume',from:'consumer-role',to:'consumer-node',relation:'performs'},{id:'built',from:'build-node',to:'review',relation:'success'},{id:'reviewed',from:'review',to:'consumer-node',relation:'success'});
 const sources=(mode:string)=>({'project.yml':JSON.stringify({version:1,project:{name:'Actual artifact flow',type:'desktop'}}),'tasks.yml':JSON.stringify({build:{command:'node',args:['workflow.cjs','build'],timeout:20,requirements:{runtimes:{node:'>=24'}},artifacts:{outputs:[{name:'desktop',path:'out/app.bin',executable:true}]}},verify:{command:'node',args:['workflow.cjs',mode],timeout:20,requirements:{runtimes:{node:'>=24'}},artifacts:{inputs:[{fromTask:'build',name:'desktop',path:'received/app.bin',executable:true}]}}})});
 async function execute(mode:string,revision:number){
  const definition=(await rpc('publish',{graph,sources:sources(mode),snapshot,expectedRevision:revision})).definition!;
  await rpc('start',{revision:definition.revision,checksum:definition.checksum,entryNodeId:'build-node',requestId:randomUUID()});
  const executionId=server.graphExecution.overview(project.id).executions.at(-1)!.id;
  const current=()=>server.graphExecution.overview(project.id).executions.find(e=>e.id===executionId)!;
  await wait(()=>current().activations.some(a=>a.status==='approval')||current().status==='failed');assert.notEqual(current().status,'failed');
  assert(!current().activations.some(a=>a.nodeId==='consumer-node'));checks.push(mode+': consumer blocked until approval');
  const approval=current().activations.find(a=>a.status==='approval')!;await rpc('approve',{executionId,activationId:approval.id,revision:definition.revision,checksum:definition.checksum});
  await wait(()=>['passed','failed'].includes(current().status));assert.equal(current().status,mode==='fail'?'failed':'passed');
  const made=current().activations.find(a=>a.nodeId==='build-node')!,used=current().activations.find(a=>a.nodeId==='consumer-node')!;const state=server.service.snapshot(project.id),madeRun=state.runs.find(r=>r.id===made.runId)!,usedRun=state.runs.find(r=>r.id===used.runId)!;
  assert.equal(madeRun.agentId,producer.id);assert.equal(usedRun.agentId,consumer.id);const receipts=made.artifactReceipts!;assert.equal(receipts.length,1);assert.equal(receipts[0].outputs[0].checksum,checksum);assert.equal(receipts[0].outputs[0].version,2);assert.equal(receipts[0].outputs[0].executable,true);assert.equal(receipts[0].outputs[0].producerRunId,madeRun.id);assert.equal(receipts[0].outputs[0].snapshotId,snapshot.snapshotId);assert(!('token' in receipts[0].outputs[0]));checks.push(mode+': persisted Core output receipt matched actual bytes and producer Run');
  const installation=used.artifactInstallations![0];assert.equal(installation.consumerRunId,usedRun.id);assert.equal(installation.agentId,consumer.id);assert.equal(installation.inputs[0].artifact.producerRunId,madeRun.id);assert.equal(installation.inputs[0].artifact.checksum,checksum);assert.equal(installation.inputs[0].path,'received/app.bin');checks.push(mode+': consumer installation receipt retained independently of test result');
  const output=fs.readFileSync(path.join(root,'Producer','runs',madeRun.id,'source/out/app.bin')),received=fs.readFileSync(path.join(root,'Consumer','runs',usedRun.id,'source/received/app.bin'));assert.equal(hash(output),checksum);assert.deepEqual(received,output);assert(!fs.existsSync(path.join(root,'Consumer','runs',usedRun.id,'source/.env')));
  assert(!fs.existsSync(path.join(root,'Consumer','runs',usedRun.id,'source/out/app.bin')));assert(!fs.existsSync(path.join(root,'Producer','runs',madeRun.id,'source/received/app.bin')));
  assert.equal(madeRun.revision?.snapshotId,snapshot.snapshotId);assert.equal(usedRun.revision?.snapshotId,snapshot.snapshotId);checks.push(mode+': actual two Rust Agent workspaces, Core HTTP checksum bytes and immutable Snapshot matched');return definition.revision;
 }
 const revision=await execute('verify',0);await execute('fail',revision);assert.equal(errors.length,0);assert.equal(unexpected.length,0);
 fs.writeFileSync(path.join(root,'RESULT.json'),JSON.stringify({status:'PASS',scope:'actual local Core/two Rust Agents; controlled explicit approval and disposable bytes; no remote deployment',binary,binaryChecksum:hash(fs.readFileSync(binary)),checks,snapshotId:snapshot.snapshotId,sourceChecksum:snapshot.checksum,artifactChecksum:checksum,overview:server.graphExecution.overview(project.id),runs:server.service.snapshot(project.id).runs,unexpected,agentErrors:errors},null,2));console.log(JSON.stringify({status:'PASS',root,checks}));
}catch(error){fs.writeFileSync(path.join(root,'FAILURE.json'),JSON.stringify({error:String(error),unexpected,agentErrors:errors,checks,overview:server.graphExecution.overview(project.id),runs:server.service.snapshot(project.id).runs,steps:server.service.snapshot(project.id).steps,logs:server.logs.read(server.service.snapshot(project.id).runs.map(r=>r.id))},null,2));throw error;
}finally{studio?.terminate();for(const child of children)if(child.exitCode===null){child.kill();await once(child,'exit');}await server.close();}
