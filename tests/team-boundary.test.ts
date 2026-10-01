import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {startCoreServer} from '../transport/server.ts';
import {teamTokenHash,type TeamConfiguration} from '../transport/team-access.ts';
const token=(id:string)=>`Dummy-Boundary-${id}-20261001`;
async function fixture(){
 const directory=path.resolve('../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-6/boundary',randomUUID());fs.mkdirSync(directory,{recursive:true});
 const a=randomUUID(),b=randomUUID();const team:TeamConfiguration={users:[{id:'owner',role:'Owner',projects:[a,b]},{id:'developer',role:'Developer',projects:[a]},{id:'viewer',role:'Viewer',projects:[a]}],sessions:['owner','developer','viewer'].map(userId=>({id:'session-'+userId,userId,tokenHash:teamTokenHash(token(userId)),expiresAt:'2099-01-01T00:00:00Z'})),projects:[a,b].map((id,i)=>({id,agentGroups:['group-'+i],maxQueued:3,maxActive:1})),agents:[0,1].map(i=>({id:'agent-'+i,tokenHash:teamTokenHash(token('agent-'+i)),groups:['group-'+i],labels:{}})),maxQueuedPerUser:2,maxActivePerUser:1};
 const core=await startCoreServer({port:0,accessMode:'team',team,agentToken:token('internal-agent'),studioToken:token('internal-studio'),storagePath:path.join(directory,'core.sqlite'),storageKey:Buffer.alloc(32,9),artifactRoot:path.join(directory,'artifacts')});
 const sockets:WebSocket[]=[];
 async function connect(user:string,p=a){const socket=new WebSocket(`ws://127.0.0.1:${core.port}/studio`);sockets.push(socket);const messages:Record<string,unknown>[]=[];socket.on('message',r=>messages.push(JSON.parse(r.toString())));await new Promise<void>((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});socket.send(JSON.stringify({type:'subscribe',protocolVersion:1,token:token(user),project:{id:p,name:'Trusted fixture '+p}}));await wait(()=>messages.some(m=>m.type==='snapshot'||m.type==='error'));return{socket,messages};}
 async function rpc(client:Awaited<ReturnType<typeof connect>>,method:string,args:unknown[]){const requestId=randomUUID();client.socket.send(JSON.stringify({type:'rpc',protocolVersion:1,requestId,method,args}));await wait(()=>client.messages.some(m=>m.requestId===requestId));return client.messages.find(m=>m.requestId===requestId)!;}
 async function http(user:string,p:string,endpoint:string,body?:unknown){return fetch(`http://127.0.0.1:${core.port}${endpoint}`,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token(user),'x-project-id':p,'content-type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});}
 const owner=await connect('owner');await connect('owner',b);
 return{core,team,a,b,connect,rpc,http,owner,close:async()=>{for(const s of sockets)s.terminate();await core.close();}};
}
async function wait(check:()=>boolean){const deadline=Date.now()+4000;while(!check()){if(Date.now()>deadline)throw Error('Boundary fixture timeout');await new Promise(r=>setTimeout(r,10));}}
test('team WebSocket enforces identity, role and project switching',async()=>{const f=await fixture();try{
 const viewer=await f.connect('viewer');assert.equal((viewer.messages.find(m=>m.type==='snapshot')!.access as {role:string}).role,'Viewer');
 assert.match(String((await f.rpc(viewer,'registerAgent',[{}])).error),/TEAM_FORBIDDEN/);
 assert.match(String((await f.rpc(viewer,'createJob',[{}])).error),/TEAM_FORBIDDEN/);
 const count=viewer.messages.filter(m=>m.type==='snapshot').length;viewer.socket.send(JSON.stringify({type:'subscribe',protocolVersion:1,project:{id:f.b,name:'Forged project'}}));await wait(()=>viewer.messages.some(m=>m.error==='TEAM_FORBIDDEN'));assert.equal(viewer.messages.filter(m=>m.type==='snapshot').length,count);
 const denied=await f.connect('developer',f.b);assert.equal(denied.messages[0].error,'TEAM_FORBIDDEN');
}finally{await f.close();}});
test('team HTTP rejects other projects, shared tokens, Viewer writes and AI transmission',async()=>{const f=await fixture();try{
 assert.equal((await f.http('developer',f.b,'/history/request',{action:'list',kind:'analysis'})).status,403);
 assert.equal((await f.http('internal-studio',f.a,'/history/request',{action:'list',kind:'analysis'})).status,403);
 assert.equal((await f.http('viewer',f.a,'/history/request',{action:'list',kind:'analysis'})).status,200);
 assert.notEqual((await f.http('viewer',f.a,'/history/request',{action:'put',kind:'analysis',id:randomUUID(),version:0,value:{}})).status,200);
 const ai=await f.http('viewer',f.a,'/ai/request',{messages:[{role:'user',text:'Controlled fixture; no Provider request allowed.'}]});assert.equal(ai.status,403);assert.equal((await ai.json()).code,'permission');
 const issue=await f.http('viewer',f.a,'/issues/request',{action:'build'});assert.equal(issue.status,403);assert.equal((await issue.json()).error,'team-permission');
 assert.equal((await f.http('viewer',f.b,'/artifacts/'+randomUUID()+'/'+randomUUID())).status,403);
}finally{await f.close();}});
test('revocation blocks live HTTP/RPC and reconnect with the same token',async()=>{const f=await fixture();try{
 const developer=await f.connect('developer');const next=structuredClone(f.team);next.sessions.find(s=>s.userId==='developer')!.revokedAt=new Date().toISOString();assert.ok(!(await f.rpc(f.owner,'team',['update',next])).error);
 assert.equal((await f.http('developer',f.a,'/history/request',{action:'list',kind:'analysis'})).status,403);
 await wait(()=>developer.socket.readyState!==WebSocket.OPEN);const denied=await f.connect('developer');assert.match(String(denied.messages[0].error),/TEAM_SESSION/);
}finally{await f.close();}});
test('team Project metadata and Agent visibility cannot be forged by subscribers',async()=>{const f=await fixture();try{
 const developer=await f.connect('developer');developer.socket.send(JSON.stringify({type:'subscribe',protocolVersion:1,project:{id:f.a,name:'Forged metadata',repositoryUrl:'https://github.com/other/target'}}));await new Promise(r=>setTimeout(r,40));
 const stored=new Map(f.core.store!.get<[string,{name:string;repositoryUrl?:string}][]>('projects'));assert.notEqual(stored.get(f.a)!.name,'Forged metadata');assert.equal(stored.get(f.a)!.repositoryUrl,undefined);
 const capabilities={cpuCores:1,memoryMiB:1024,docker:false,gpu:false,pty:false,runtimes:{},browsers:[]};for(const i of [0,1])f.core.service.connectAgent('agent-'+i,{name:'Agent '+i,platform:'windows',architecture:'x86_64',capabilities});
 assert.deepEqual(f.core.service.snapshot(f.a).agents.map(a=>a.id),['agent-0']);assert.deepEqual(f.core.service.snapshot(f.b).agents.map(a=>a.id),['agent-1']);
 assert.ok(f.core.service.snapshot(f.a).events.filter(e=>!e.projectId).every(e=>e.entityId==='agent-0'));
}finally{await f.close();}});
