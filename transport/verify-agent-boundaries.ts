// Controlled protocol peer tests the actual Rust binary; this is not a Fake Agent.
import {WebSocketServer,type WebSocket} from 'ws';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const evidence=path.resolve(process.env.AGENT_EVIDENCE!);
const binary=path.resolve(process.env.AGENT_BINARY!);
const root=path.join(evidence,'boundary-'+Date.now());fs.mkdirSync(root,{recursive:true});
const workspace=path.join(root,'workspace');
const server=new WebSocketServer({host:'127.0.0.1',port:0});await once(server,'listening');
const address=server.address();assert(address&&typeof address!=='string');
let socket:WebSocket|undefined;let identity='';let child:ChildProcess|undefined;let errors='';
const messages:Record<string,unknown>[]=[];
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const checks:string[]=[];
const wait=async(predicate:()=>boolean)=>{const until=Date.now()+15000;while(Date.now()<until){if(predicate())return;await new Promise(r=>setTimeout(r,25));}throw Error('Boundary test timed out');};
server.on('connection',connection=>{socket=connection;connection.on('error',()=>{});connection.on('message',raw=>{const message=JSON.parse(raw.toString());if(message.type==='register'){identity=message.agentId;connection.send(JSON.stringify({type:'registered',agentId:identity,protocolVersion:1}));}else if(message.type==='heartbeat'){connection.send(JSON.stringify({type:'heartbeat_ack',protocolVersion:1}));}else{messages.push(message);if(message.type==='result')connection.send(JSON.stringify({type:'ack',runId:message.runId,runStepId:message.runStepId,protocolVersion:1}));}});});
const config=path.join(root,'config.json');fs.writeFileSync(config,JSON.stringify({endpoint:`ws://127.0.0.1:${address.port}/agent`,name:'Actual Agent boundaries',workspaceRoot:workspace,heartbeatMs:200,reconnectMaxMs:500,logLevel:'error'}));
function request(overrides:Record<string,unknown>={}){return{type:'execute',protocolVersion:1,agentId:identity,jobId:randomUUID(),runId:randomUUID(),projectId:randomUUID(),requirements:{runtimes:{node:'>=24'}},executable:process.execPath,args:['-e','process.exit(0)'],cwd:'.',env:{},timeoutMs:5000,...overrides};}
async function execute(value:ReturnType<typeof request>){socket!.send(JSON.stringify(value));await wait(()=>messages.some(m=>['result','rejected'].includes(String(m.type))&&m.runId===value.runId));await new Promise(r=>setTimeout(r,100));return messages.find(m=>['result','rejected'].includes(String(m.type))&&m.runId===value.runId)!;}
function snapshot(projectId:string,file='main.js',content='console.log(1);'){const s={provider:'snapshot',snapshotId:randomUUID(),projectId,proposalId:randomUUID(),attempt:1,baseRevision:'controlled-boundary',changedFiles:[file],files:[{path:file,content,checksum:hash(content)}],checksum:''};s.checksum=hash(JSON.stringify([s.snapshotId,s.projectId,s.proposalId,s.attempt,s.baseRevision,s.changedFiles,...s.files.map(f=>[f.path,f.checksum])]));return{provider:'snapshot',repository:`snapshot:${s.snapshotId}`,revision:s.baseRevision,snapshot:s};}
try{
 child=spawn(binary,['--config',config],{windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,TASTEDEV_AGENT_TOKEN:randomUUID()}});child.stderr!.on('data',data=>errors+=data.toString());child.on('error',()=>{errors+='Agent start failed';});await wait(()=>!!identity);
 for(const [args,executable,classification] of [[['-e','process.exit(7)'],process.execPath,'TEST_FAILED'],[[], 'tastedev-missing-binary','EXECUTION_ERROR']] as const){const result=await execute(request({args,executable}));assert.equal(result.classification,classification);checks.push(`actual classified result: ${classification}`);}
 const stale=await execute(request({env:{PATH:path.join(root,'missing-tools')},requirements:{runtimes:{git:'>=1'}},args:['-e',`require('fs').writeFileSync('should-not-execute','x')`]}));assert.equal(stale.classification,'CAPABILITY_MISMATCH');assert(!fs.existsSync(path.join(workspace,'runs',String(stale.runId),'should-not-execute')));checks.push('changed task PATH rejected before Source execution');
 for(const variant of ['checksum','escape','secret']){const projectId=randomUUID();const source=snapshot(projectId,variant==='escape'?'../outside.js':variant==='secret'?'.env':'main.js');if(variant==='checksum')source.snapshot.files[0].content+='tamper';const value=request({projectId,runStepId:randomUUID(),stage:'source',source});const result=await execute(value);assert.equal(result.type,'rejected');assert(!fs.existsSync(path.join(workspace,'runs',value.runId)));checks.push(`actual Snapshot ${variant} rejected before workspace creation`);}
 const projectId=randomUUID();const source=snapshot(projectId);const value=request({projectId,runStepId:randomUUID(),stage:'source',source});const valid=await execute(value);assert.equal(valid.classification,'PASSED');assert.equal(hash(fs.readFileSync(path.join(workspace,'runs',value.runId,'source','main.js'),'utf8')),source.snapshot.files[0].checksum);checks.push('actual Snapshot manifest and written Source hash match');
 // A fragmented interrupted message must never become an executable request.
 const partial=request({args:['-e',"require('fs').writeFileSync('partial-executed','x')"]});socket!.send(JSON.stringify(partial).slice(0,100),{fin:false});socket!.terminate();await new Promise(r=>setTimeout(r,300));assert(!messages.some(m=>m.runId===partial.runId));assert(!fs.existsSync(path.join(workspace,'runs',partial.runId)));checks.push('interrupted frame produced no execution and no workspace');
 assert.equal(errors,'');fs.writeFileSync(path.join(evidence,'actual-agent-boundaries.json'),JSON.stringify({status:'PASS',binary,binaryHash:hash(fs.readFileSync(binary)),checks,peer:'controlled protocol peer, actual Rust Agent',agentErrors:0},null,2));console.log('PASS',checks);
}finally{
 if(child&&child.exitCode===null){child.kill();await once(child,'exit');}
 for(const connection of server.clients)connection.terminate();await new Promise<void>(resolve=>server.close(()=>resolve()));
}
