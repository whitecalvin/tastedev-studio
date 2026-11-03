import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {FrameworkSessions,frameworkSourceHash} from '../transport/framework-sessions.ts';
import {requireNativeResumeParent,requireNativeResumeRequest} from '../transport/framework-resume.ts';
import {startCoreServer} from '../transport/server.ts';
import type {FrameworkSession} from '../src/features/frameworks/session.ts';
const scope={projectId:'resume-project',runId:'native-run',agentId:'agent',workspaceId:'workspace',sourceChecksum:'a'.repeat(64),configurationChecksum:'b'.repeat(64),manifest:'c'.repeat(64)};
const native=crypto.randomUUID();
function interrupted(){const store=new FrameworkSessions(),first=store.create(scope);store.event(scope.projectId,first.id,1,'started',{sessionId:native});store.event(scope.projectId,first.id,2,'failed',{reason:'Controlled interrupted turn'});return store.list(scope.projectId)[0];}
const request=(session:FrameworkSession)=>({sessionId:session.id,nativeSessionId:session.nativeSessionId,workspaceId:session.scope.workspaceId,configurationChecksum:session.scope.configurationChecksum,requestId:crypto.randomUUID()});
test('only an exact stopped native turn can resume; missing, running and mismatched identities fail closed',()=>{
 const session=interrupted();assert.doesNotThrow(()=>requireNativeResumeRequest(session,request(session)));
 for(const field of ['sessionId','nativeSessionId','workspaceId','configurationChecksum'])assert.throws(()=>requireNativeResumeRequest(session,{...request(session),[field]:'wrong'}),/Exact/);
 assert.throws(()=>requireNativeResumeRequest(session,{...request(session),requestId:'short'}),/Exact/);
 assert.throws(()=>requireNativeResumeParent({...session,nativeSessionId:undefined}),/stopped/);assert.throws(()=>requireNativeResumeParent({...session,status:'running'}),/stopped/);
});
test('a completed model turn cannot replay even when validation was cancelled or failed',()=>{
 const stopped=interrupted();for(const status of ['needs-review','failed','cancelled','interrupted'] as const){const session={...stopped,status,events:[...stopped.events,{sequence:3,type:'completed',value:{requiresValidation:true}}]};assert.throws(()=>requireNativeResumeRequest(session,request(session)),/FRAMEWORK_TURN_COMPLETED/);const store=new FrameworkSessions();assert.throws(()=>store.create({...scope,runId:'new-run'},session),/FRAMEWORK_TURN_COMPLETED/);assert.equal(store.list(scope.projectId).length,0);}
});
test('restart expires pending validation approval while retaining completed turn as needs-review',()=>{
 let saved:FrameworkSession[]=[];const persistence={load:()=>saved,save:(value:FrameworkSession[])=>{saved=structuredClone(value);}};
 const store=new FrameworkSessions(persistence,()=>1000),session=store.create(scope);store.event(scope.projectId,session.id,1,'started',{sessionId:native});store.event(scope.projectId,session.id,2,'completed',{});const checksum=frameworkSourceHash(scope.sourceChecksum,scope.manifest,[]);store.event(scope.projectId,session.id,3,'source-verified',{checksum});store.event(scope.projectId,session.id,4,'permission',{kind:'native-validation',sourceChecksum:checksum,requestId:'pending-validation'});
 const recovered=new FrameworkSessions(persistence,()=>2000).list(scope.projectId)[0];assert.equal(recovered.status,'needs-review');assert.equal(recovered.nativeSessionId,native);assert(recovered.events.some(e=>e.type==='completed'));assert(Date.parse(recovered.requests[0].expiresAt)<=2000);assert.throws(()=>requireNativeResumeParent(recovered),/FRAMEWORK_TURN_COMPLETED/);
});
test('Core rejects completed-turn resume before admitting a job or mapping a resume request',async()=>{
 const token='dummy-completed-turn-regression',server=await startCoreServer({port:0,studioToken:token,agentToken:token});
 const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/studio'),messages:Record<string,unknown>[]=[];ws.on('message',raw=>messages.push(JSON.parse(String(raw))));await once(ws,'open');
 const until=async(fn:()=>unknown)=>{for(let n=0;n<200;n++){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,10));}throw Error('Controlled resume regression timeout');};
 try{const createdAt=new Date().toISOString();ws.send(JSON.stringify({type:'subscribe',protocolVersion:1,token,project:{id:scope.projectId,name:'Controlled resume',description:'',workspacePath:null,browserFolder:true,repositoryUrl:null,defaultBranch:null,framework:null,runtime:null,packageManager:null,projectType:null,gitEnabled:null,createdAt,updatedAt:createdAt,lastOpenedAt:null}}));await until(()=>messages.find(m=>m.type==='snapshot'));
  const session=server.frameworkSessions.create(scope);server.frameworkSessions.event(scope.projectId,session.id,1,'started',{sessionId:native});server.frameworkSessions.event(scope.projectId,session.id,2,'completed',{});const completed=server.frameworkSessions.list(scope.projectId)[0],id=crypto.randomUUID();
  ws.send(JSON.stringify({type:'rpc',protocolVersion:1,requestId:id,method:'framework',args:['resume',request(completed)]}));const reply=await until(()=>messages.find(m=>m.requestId===id)) as Record<string,unknown>;assert.match(String(reply.error),/FRAMEWORK_TURN_COMPLETED/);assert.equal(server.service.snapshot(scope.projectId).jobs.length,0);assert.equal(server.frameworkSessions.list(scope.projectId).length,1);
 }finally{ws.close();await server.stop();}
});
