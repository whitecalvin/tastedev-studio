import {TeamOperations} from './team-operations.ts';
import {sourceInventory,transferSource} from './source-transfer.ts';
import {snapshotDelta} from '../src/features/core/snapshot-delta.ts';
import type {CoreSnapshot} from '../src/features/core/domain.ts';
import {executionReport} from './execution-report.ts';
import {RunHistory} from './run-history.ts';
import {liveSnapshot} from '../src/features/core/history-query.ts';
import {TeamAccess,TeamAccessError,teamTokenHash,type TeamConfiguration,type TeamIdentity,type TeamAction} from './team-access.ts';
import {TeamAllocation} from './team-allocation.ts';
import type {IncomingMessage} from 'node:http';
import {verifySnapshot} from '../src/features/ai/snapshot.ts';
import {ScheduleService} from '../src/features/scheduler/service.ts';
import {MemoryScheduleRepository,SchedulerError} from '../src/features/scheduler/domain.ts';
import {FileScheduleRepository} from './schedule-repository.ts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {artifactGateway,browserResult} from './artifacts.ts';
import {aiGateway} from './ai-gateway.ts';
import {OpenAIProvider} from './ai-provider.ts';
import {CodexProvider} from './codex-provider.ts';
import {GitHubIssueProvider} from './github-provider.ts';
import {issueGateway} from './issue-gateway.ts';
import {HistoryStore,historyGateway} from './history.ts';
import type {IssueProvider} from '../src/features/issues/domain.ts';
import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { Project } from '../src/features/projects/types/project.ts';

import { activeRun, CoreError } from '../src/features/core/domain.ts';
import { TestOrchestrator, type TerminalStatus } from '../src/features/core/orchestrator.ts';
import type { SourceRevision } from '../src/features/core/test-plan.ts';
import { CoreService, type CreateJob } from '../src/features/core/service.ts';
import { InMemoryCoreRepository } from '../src/features/core/repository.ts';
import { CoreStore, SqliteCoreRepository, storageKey, StorageError, STORAGE_VERSION } from './storage.ts';
import type { LogState } from './protocol.ts';
import { validateAgent } from '../src/features/core/matcher.ts';
import { decode, identifier, timestamp, PROTOCOL, MESSAGE_LIMIT, RunLogs, type Message } from './protocol.ts';
export interface ServerOptions { accessMode?:'local-single-user'|'team';team?:TeamConfiguration;storagePath?:string; storageKey?:Uint8Array; schedulePath?:string; issueProvider?:IssueProvider; artifactRoot?:string; artifactBaseUrl?:string; port?:number; host?:string; agentToken:string; studioToken:string; allowLan?:boolean; origins?:string[]; heartbeatTimeoutMs?:number; version?:string; shutdownTimeoutMs?:number; runtimeEvent?:(level:'info'|'warn'|'error',event:string,fields?:Record<string,unknown>)=>void }
const auth=(actual:unknown,expected:string)=>typeof actual==='string'&&actual.length<=512&&timingSafeEqual(createHash('sha256').update(actual).digest(),createHash('sha256').update(expected).digest());
export async function startCoreServer(options:ServerOptions) {
  const host=options.host??'127.0.0.1';
  if(!['127.0.0.1','::1','localhost'].includes(host)&&!options.allowLan)throw new Error('LAN binding requires explicit allowLan.');
  if(!['127.0.0.1','::1','localhost'].includes(host)&&options.accessMode!=='team')throw new Error('Remote Core requires team access mode.');
  if(options.agentToken.length<16||options.studioToken.length<16)throw new Error('Two configured tokens of at least 16 characters are required.');
  const origins=options.origins??['http://127.0.0.1:4320','http://localhost:4320','http://127.0.0.1:4330','http://127.0.0.1:4317','http://tauri.localhost','https://tauri.localhost','tauri://localhost'];
  const store=options.storagePath?new CoreStore(options.storagePath,options.storageKey??storageKey(options.storagePath)):undefined;
  const cleanup:(()=>void|Promise<void>)[]=[()=>store?.close()];let closed=false,draining=false,ready=false,operations=0;let closing:Promise<void>|undefined;
  const event=options.runtimeEvent??(()=>{});
  const shutdown=()=>closing??=(async()=>{draining=true;ready=false;closed=true;let error:unknown;for(const close of [...cleanup].reverse())try{await close();}catch(e){error??=e;}if(error)throw error;})();
  try{
  if(options.accessMode==='team'&&(!store||!options.team))throw new Error('Team mode requires durable storage and explicit configuration.');
  if(options.accessMode!==undefined&&!['local-single-user','team'].includes(options.accessMode))throw new Error('Invalid access mode.');
  if(options.accessMode===undefined&&store?.get('team-access'))throw new Error('Existing team storage requires explicit access mode.');
  const team=options.accessMode==='team'?new TeamAccess(options.team!,store):undefined;
  const requestIdentities=new WeakMap<IncomingMessage,TeamIdentity>(),studioIdentities=new Map<WebSocket,TeamIdentity>();
  const agentSessionHashes=new Map<string,string>();
  type RunGrant=TeamIdentity&{requiresScheduleManagement?:boolean};
  const jobGrants=new Map<string,RunGrant>(store?.get<[string,RunGrant][]>('team-job-grants')??[]);
  const permittedJob=(id:string,p:string)=>{const grant=jobGrants.get(id);return !!team&&!!grant&&team.permits(grant,p,'run')&&(!grant.requiresScheduleManagement||team.permits(grant,p,'schedule-manage'));};
  const grantJobs=(ids:string[],identity:TeamIdentity,requiresScheduleManagement=false)=>{const next=new Map(jobGrants),grant={...identity,requiresScheduleManagement};for(const id of ids)next.set(id,grant);store?.put('team-job-grants',[...next]);for(const id of ids)jobGrants.set(id,grant);};
  const scheduleGrants=new Map<string,TeamIdentity>(store?.get<[string,TeamIdentity][]>('team-schedule-grants')??[]),manualScheduleGrants=new Map<string,TeamIdentity>();
  const scheduleAuthority=team?(p:string,id:string)=>{try{const manual=manualScheduleGrants.get(id),identity=manual??scheduleGrants.get(id);if(!identity)throw new TeamAccessError();team.require(identity,p,'run',id);if(!manual)team.require(identity,p,'schedule-manage',id);return identity.userId;}catch(error){if(error instanceof TeamAccessError)throw new SchedulerError('disabled');throw error;}}:undefined;
  const grantSchedules=(ids:string[],identity:TeamIdentity)=>{const next=new Map(scheduleGrants);for(const id of ids)next.set(id,identity);store?.put('team-schedule-grants',[...next]);for(const id of ids)scheduleGrants.set(id,identity);};
  const authorizeHTTP=(req:IncomingMessage,projectId:string,action:TeamAction,target?:string)=>{if(!team)return;const identity=requestIdentities.get(req);if(!identity)throw new TeamAccessError();team.require(identity,projectId,action,target);};
  const projects=new Map<string,Project>(store?.get<[string,Project][]>('projects')??[]);
  const allocation=team?new TeamAllocation(team,()=>service.repository.read()):undefined;
  const service:CoreService=new CoreService(store?new SqliteCoreRepository(store):new InMemoryCoreRepository(),{get:async id=>projects.get(id)??null},{...(team&&allocation?{allowAgent:(p:string,a:string)=>team.allowedAgent(p,a),agentSessionValid:(a:string)=>team.validAgentSession(a,agentSessionHashes.get(a)??''),admitJob:allocation.admit.bind(allocation),allowAssignment:(job:import('../src/features/core/domain.ts').Job,runs:import('../src/features/core/domain.ts').Run[],jobs:import('../src/features/core/domain.ts').Job[])=>permittedJob(job.id,job.projectId)&&allocation.eligible(job,runs,jobs),strategy:allocation.strategy}:{})});
  // Socket presence is never restored. Active execution identities remain reserved.
  if(store)service.repository.transaction(tx=>{for(const a of tx.agents.list())a.status='offline';});
  const logs=new RunLogs(store?.get<LogState>('logs'),store?value=>store.put('logs',value):undefined);const agents=new Map<string,{socket:WebSocket;seen:number}>();const studios=new Map<WebSocket,string>();
  function rememberProject(p:Project){const next=new Map(projects);next.set(p.id,p);store?.put('projects',[...next]);projects.set(p.id,p);}
  const orphanedAgents=new Set<string>();
  const orchestrator=new TestOrchestrator(service);
  const scheduler=new ScheduleService(service,options.schedulePath?new FileScheduleRepository(options.schedulePath):new MemoryScheduleRepository(),id=>projects.get(id),(p,j)=>{if(team){const scheduleId=scheduler.list(p).history.find(h=>h.jobId===j)?.scheduleId;if(!scheduleId)throw new SchedulerError('disabled');scheduleAuthority!(p,scheduleId);const identity=manualScheduleGrants.get(scheduleId)??scheduleGrants.get(scheduleId)!;grantJobs([j],identity,!manualScheduleGrants.has(scheduleId));}return dispatch(p,j);},Date.now,store?{load:()=>store.get('scheduler'),save:value=>store.put('scheduler',value)}:undefined,scheduleAuthority);
  const artifacts=artifactGateway(service,options.artifactRoot??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../../resources/artifacts/tastedev-studio'),options.studioToken,origins,store?{load:()=>store.get('artifact-grants')??[],save:value=>store.put('artifact-grants',value)}:undefined,fields=>event('info','artifact.upload.progress',fields));
  const artifactAudit:{id:string;status:string}[]=[];for(const a of service.repository.read().artifacts){if(!a.location.startsWith('/artifacts/'))continue;if(a.deletedAt){try{await artifacts.store.purge(a.runId,a.id);artifactAudit.push({id:a.id,status:'deleted'});}catch{artifactAudit.push({id:a.id,status:'purge-pending'});}continue;}try{const value=await artifacts.store.get(a.runId,a.id);if(value.meta.checksum!==a.checksum||value.meta.size!==a.size)throw Error('Mismatch');artifactAudit.push({id:a.id,status:'available'});}catch{artifactAudit.push({id:a.id,status:'missing-or-invalid'});}}
  const runTimers=new Map<string,ReturnType<typeof setTimeout>>();
  const sourceCaches=new Map<string,Set<string>>();
  function restoreDeadline(runId:string,ws:WebSocket){
    const snap=service.repository.read(),run=snap.runs.find(r=>r.id===runId),job=snap.jobs.find(j=>j.id===run?.jobId);
    if(!run||!activeRun(run)||!job?.payload.testPlan||runTimers.has(runId))return;
    if(snap.steps.some(s=>s.runId===runId&&s.status==='running'&&job.payload.steps[s.order].stage==='cleanup'))return;
    const remaining=Math.max(0,Date.parse(run.startedAt??run.createdAt)+job.payload.testPlan.timeout-Date.now());
    runTimers.set(runId,setTimeout(()=>{try{orchestrator.terminate(runId,'timeout');send(ws,{type:'cancel',runId});}catch{ws.close(1011,'Core persistence failed; execution retained');}},remaining));
  }
  function advance(runId:string) {
    const next=orchestrator.next(runId);
    if(!next){const done=orchestrator.finish(runId);if(done){clearTimeout(runTimers.get(runId));runTimers.delete(runId);const ws=agents.get(done.agentId)?.socket;if(ws)send(ws,{type:'closeRun',runId});}return;}
    const {run,job,step,command}=next,ws=agents.get(run.agentId)?.socket;
    if(!ws){failRun(runId,'Agent transport unavailable during pipeline.');return;}
    restoreDeadline(runId,ws);
    // Cleanup has its own bounded allowance beyond the overall deadline.
    if(command.stage==='cleanup'){clearTimeout(runTimers.get(runId));runTimers.delete(runId);}
    const source=command.source?transferSource(command.source,run.projectId,sourceCaches.get(run.agentId)):undefined;
    if(source?.provider==='snapshot')event('info','source.transfer',{runId,projectId:run.projectId,files:source.snapshot.files.length,reusedFiles:source.snapshot.files.filter(file=>(file as unknown as {cached?:boolean}).cached).length,transferredBytes:source.snapshot.files.reduce((n,file)=>n+Buffer.byteLength(file.content),0)});
    send(ws,{type:'execute',agentId:run.agentId,jobId:job.id,runId,runStepId:step.id,projectId:run.projectId,requirements:job.requirements,executable:command.executable,args:command.args,cwd:command.cwd,env:command.env??{},timeoutMs:command.timeoutMs??60000,stage:command.stage,...(command.browser?{browser:command.browser,artifactTransfer:{...artifacts.grant(runId,step.id,options.artifactBaseUrl??`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`),...(sourceCaches.has(run.agentId)?{resumable:true}:{})}}:{}),...(source?{source}:{}),...(command.healthcheck?{healthcheck:command.healthcheck}:{})});
  }
  const providerName=process.env.TASTEDEV_AI_PROVIDER??'codex';
  if(!['codex','openai'].includes(providerName))throw new Error('TASTEDEV_AI_PROVIDER must be codex or openai.');
  const provider=providerName==='openai'?new OpenAIProvider(process.env.OPENAI_API_KEY??'',process.env.TASTEDEV_AI_MODEL??'gpt-4.1-mini'):new CodexProvider(process.env.TASTEDEV_CODEX_MODEL);
  const ai=aiGateway(provider,options.studioToken,origins,id=>projects.has(id),Object.entries(process.env).filter(([k])=>/key|secret|token|password/i.test(k)).map(([,v])=>v??'').filter(Boolean),Number(process.env.TASTEDEV_AI_TIMEOUT_MS??120000),(req,p,write)=>authorizeHTTP(req,p,write?'ai':'read'));
  const issueSecrets=Object.entries(process.env).filter(([k])=>/key|secret|token|password/i.test(k)).map(([,v])=>v??'').filter(Boolean);
  const issues=issueGateway(options.issueProvider??new GitHubIssueProvider(undefined,issueSecrets),options.studioToken,origins,id=>projects.get(id),id=>service.snapshot(id),id=>(logs.read([id])[id]??[]).map(l=>l.text),issueSecrets,store?{load:()=>store.get('issues')??[],save:value=>store.put('issues',value)}:undefined,(req,p,action,target)=>authorizeHTTP(req,p,['list','get'].includes(action)?'read':'issue-write',target));
  const records=new RunHistory(service,logs,store);
  const history=new HistoryStore(store),historyHandler=historyGateway(history,options.studioToken,origins,id=>projects.has(id),(req,p,action,kind,value)=>{authorizeHTTP(req,p,action==='put'?'history-write':'read',value?.id);if(action==='put'&&kind==='attempt'&&value&&'approval' in value&&value.approval)authorizeHTTP(req,p,'approve',value.id);});
  const teamOperations=new TeamOperations(service,records,history,id=>projects.get(id),store);
  const health=()=>({live:!closed,ready:ready&&!draining,state:closed?'stopped':draining?'draining':ready?'ready':'starting',version:options.version??'development',protocolVersion:PROTOCOL,storage:store?'sqlite':'memory',schema:store?STORAGE_VERSION:null});
  let stopping:Promise<{timedOut:boolean}>|undefined;
  const stop=(timeoutMs=options.shutdownTimeoutMs??15000)=>stopping??=(async()=>{
    draining=true;ready=false;event('info','core.draining');const deadline=Date.now()+timeoutMs;
    for(const run of service.repository.read().runs.filter(activeRun)){const job=service.cancelJob(run.projectId,run.jobId);const socket=agents.get(run.agentId)?.socket;if(socket)send(socket,{type:'cancel',runId:run.id});event('info','run.stop_requested',{runId:run.id,jobId:job.id});}
    while((operations||service.repository.read().runs.some(activeRun))&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
    const timedOut=operations>0||service.repository.read().runs.some(activeRun);if(timedOut)event('warn','core.drain_timeout',{activeRuns:service.repository.read().runs.filter(activeRun).length,operations});
    // The process supervisor owns the hard deadline. Never close SQLite beneath an in-flight operation.
    while(operations)await new Promise(r=>setTimeout(r,10));
    service.repository.transaction(()=>{});await shutdown();event('info','core.stopped',{timedOut});return {timedOut};
  })();
  const server=createServer((req,res)=>{
    const json=(code:number,value:unknown)=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value)+'\n');};
    if(team&&req.method!=='OPTIONS'&&!['/health/live','/health/ready','/runtime'].includes(req.url??'')&&!(req.url?.startsWith('/artifacts/')&&['PUT','HEAD'].includes(req.method??''))){
      try{if(req.headers.origin&&!origins.includes(req.headers.origin))throw new TeamAccessError();const identity=team.authenticate(req.headers.authorization?.replace(/^Bearer /,''));requestIdentities.set(req,identity);
        if(req.url==='/runtime/stop')team.require(identity,null,'access-manage');else team.require(identity,String(req.headers['x-project-id']??''),'read');
        if(req.url?.startsWith('/artifacts/'))authorizeHTTP(req,String(req.headers['x-project-id']??''),req.method==='DELETE'?'history-write':'read');
        // Legacy gateways see an internal credential only after authoritative identity checks.
        req.headers.authorization='Bearer '+options.studioToken;
      }catch{if(req.headers.origin&&origins.includes(req.headers.origin))res.setHeader('Access-Control-Allow-Origin',req.headers.origin);json(403,req.url?.startsWith('/ai/')?{type:'error',code:'permission'}:req.url?.startsWith('/issues/')?{error:'team-permission'}:{error:'TEAM_FORBIDDEN'});return;}
    }
    if(req.method==='GET'&&['/health/live','/health/ready','/runtime'].includes(req.url??'')){const state=health();json(req.url==='/health/ready'&&!state.ready?503:200,state);return;}
    if(req.url==='/runtime/stop'){
      if(req.method!=='POST'||!auth(req.headers.authorization?.replace(/^Bearer /,''),options.studioToken)||(req.headers.origin&&!origins.includes(req.headers.origin))){json(403,{error:'Forbidden'});return;}
      json(202,{state:'draining'});res.once('finish',()=>{void stop().catch(()=>{event('error','core.stop_failed');});});return;
    }
    if(draining){json(503,{error:'Core is draining'});return;}
    operations++;const task=req.url?.startsWith('/ai/')?ai(req,res):req.url?.startsWith('/issues/')?issues.handle(req,res):req.url?.startsWith('/history/')?historyHandler(req,res):artifacts.handle(req,res);
    void Promise.resolve(task).catch(()=>{event('error','http.operation_failed');if(!res.headersSent)json(500,{error:'Core operation failed'});else res.destroy();}).finally(()=>{operations--;});
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:MESSAGE_LIMIT,perMessageDeflate:false});
  cleanup.push(async()=>{for(const ws of wss.clients)ws.terminate();server.closeAllConnections();await new Promise<void>(resolve=>wss.close(()=>server.close(()=>resolve())));});
  server.on('upgrade',(req,socket,head)=>{if(draining||!['/agent','/studio'].includes(req.url??'')||(req.headers.origin&&!origins.includes(req.headers.origin))){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
  const send=(ws:WebSocket,data:object)=>{if(ws.readyState!==WebSocket.OPEN)return false;if(ws.bufferedAmount>1048576){ws.terminate();return false;}ws.send(JSON.stringify({protocolVersion:PROTOCOL,...data}));return true;};
  const deltaClients=new Set<WebSocket>(),published=new Map<WebSocket,{projectId:string;snapshot:CoreSnapshot;sequence:number;logs:string}>();
  function publish(){for(const [ws,id] of studios){
    if(team&&!team.permits(studioIdentities.get(ws)!,id,'read')){ws.close(1008,'Team access expired or revoked');continue;}
    const snapshot=liveSnapshot(service.snapshot(id));
    if(team){snapshot.agents=snapshot.agents.filter(a=>team.allowedAgent(id,a.id));const allowed=new Set(snapshot.agents.map(a=>a.id));snapshot.events=snapshot.events.filter(e=>e.projectId===id||allowed.has(e.entityId));}
    const previous=published.get(ws),sequence=(previous?.sequence??0)+1,runLogs=logs.read(snapshot.runs.map(r=>r.id)),encodedLogs=JSON.stringify(runLogs),access=team?team.describe(studioIdentities.get(ws)!,id):{mode:'local-single-user'};
    const payload=deltaClients.has(ws)&&previous?.projectId===id
      ?{type:'delta',projectId:id,sequence,baseSequence:previous.sequence,delta:snapshotDelta(previous.snapshot,snapshot),...(previous.logs!==encodedLogs?{logs:runLogs}:{}),access}
      :{type:'snapshot',projectId:id,sequence,snapshot,logs:runLogs,access};
    if(send(ws,payload)&&deltaClients.has(ws))published.set(ws,{projectId:id,snapshot,sequence,logs:encodedLogs});
  }}
  let publishTimer:ReturnType<typeof setTimeout>|undefined;
  const schedule=()=>{publishTimer??=setTimeout(()=>{publishTimer=undefined;publish();},40)};
  const unsubscribe=service.repository.subscribe(schedule);cleanup.push(unsubscribe);cleanup.push(()=>{clearTimeout(publishTimer);for(const timer of runTimers.values())clearTimeout(timer);});
    function lose(id:string,ws:WebSocket){if(agents.get(id)?.socket!==ws)return;agents.delete(id);sourceCaches.delete(id);agentSessionHashes.delete(id);try{service.observeAgent(id,false);}catch{/* Connection is gone; persistent ownership stays reserved until recovery. */}}
    function revokeStudioAccess(){if(!team)return;for(const job of service.repository.read().jobs){if(!jobGrants.has(job.id)||!['queued','assigned','running'].includes(job.status)||permittedJob(job.id,job.projectId))continue;service.cancelJob(job.projectId,job.id);const run=service.snapshot(job.projectId).runs.find(run=>run.jobId===job.id&&activeRun(run));if(run){const socket=agents.get(run.agentId)?.socket;if(socket)send(socket,{type:'cancel',runId:run.id});}}schedule();}
    function revokeAgentConnections(){if(!team)return;for(const [id,connection] of agents){if(team.validAgentSession(id,agentSessionHashes.get(id)??''))continue;try{for(const run of service.repository.read().runs.filter(row=>row.agentId===id&&activeRun(row))){service.cancelJob(run.projectId,run.jobId);send(connection.socket,{type:'cancel',runId:run.id});}}catch{event('error','agent.revocation_cancel_failed');}finally{lose(id,connection.socket);connection.socket.close(1008,'Agent access revoked');}}}
  function failRun(id:string,summary:string){const run=service.repository.read().runs.find(r=>r.id===id);if(!run||!activeRun(run))return;service.finishRun(run.projectId,run.id,'failed',null,summary);if(!agents.has(run.agentId))service.observeAgent(run.agentId,false);}
  function orchestratorSafeFinish(id:string){const snap=service.repository.read(),run=snap.runs.find(r=>r.id===id);return run&&snap.jobs.find(j=>j.id===run.jobId)?.payload.testPlan?orchestrator.finish(id):null;}
  function dispatch(projectId:string,jobId?:string){
    if(draining)throw new CoreError('Core is draining; new assignment is disabled.');
    const unsupported=service.queue(projectId).find(j=>j.payload.steps.length!==1&&!j.payload.testPlan);if(unsupported)throw new CoreError('Multi-step execution requires a TestPlan.');
    const a=service.dispatch(projectId,jobId);if(!a)return null;const socket=agents.get(a.agent.id)?.socket;
    if(!socket){failRun(a.run.id,'Agent transport is unavailable.');service.observeAgent(a.agent.id,false);return a;}
    if(a.job.payload.testPlan){advance(a.run.id);return a;}
    const step=a.job.payload.steps[0];send(socket,{type:'execute',agentId:a.agent.id,jobId:a.job.id,runId:a.run.id,projectId,requirements:a.job.requirements,executable:step.executable,args:step.args,cwd:step.cwd,env:step.env??{},timeoutMs:step.timeoutMs??60000});return a;
  }
  async function rpc(ws:WebSocket,m:Message){const id=identifier(m.requestId),projectId=studios.get(ws)!;const args=Array.isArray(m.args)?m.args:[];let value:unknown;
    if(team){const action:TeamAction=m.method==='records'?(args[0]==='policy-save'?'history-write':'read'):m.method==='operations'?(args[0]==='link'?'issue-write':'read'):m.method==='storageHealth'||m.method==='team'?'read':m.method==='scheduler'?(args[0]==='list'?'read':args[0]==='run'?'run':'schedule-manage'):m.method==='registerAgent'||m.method==='removeAgent'?'agent-manage':m.method==='cancelJob'?'cancel':'run';team.require(studioIdentities.get(ws)!,projectId,action,typeof args[0]==='string'?args[0]:undefined);if(m.method==='removeAgent'&&!team.allowedAgent(projectId,identifier(args[0])))throw new TeamAccessError();}
    if(draining&&m.method!=='storageHealth')throw new CoreError('Core is draining; mutations are disabled.');
    switch(m.method){
      case 'records':value=records.request(projectId,args[0],args[1]);break;
      case 'operations':{if(args[0]==='report')value=teamOperations.report(projectId,team?agent=>team.allowedAgent(projectId,agent):undefined);else if(args[0]==='link')value=teamOperations.link(projectId,args[1],team?studioIdentities.get(ws)?.userId:undefined);else throw new CoreError('Invalid operations action.');break;}
      case 'team':{if(!team){value={mode:'local-single-user'};break;}const identity=studioIdentities.get(ws)!;switch(args[0]){case 'describe':value=team.describe(identity,projectId);break;case 'management':value=team.management(identity,projectId);break;case 'save-user':value=team.saveUser(identity,projectId,args[1]);revokeStudioAccess();break;case 'issue-session':value=team.issueSession(identity,projectId,args[1]);break;case 'revoke-session':value=team.revokeSession(identity,projectId,args[1]);revokeStudioAccess();break;case 'configuration':value=team.configuration(identity);break;case 'update':team.update(identity,args[1] as TeamConfiguration);revokeAgentConnections();revokeStudioAccess();value=team.describe(identity,projectId);break;case 'agents':value=team.agentOverview(identity,projectId);break;case 'register-agent':value=team.registerCredential(identity,projectId,args[1]);break;case 'revoke-agent':value=team.revokeCredential(identity,projectId,args[1],args[2]);revokeAgentConnections();break;case 'audit':value=team.audit(identity,projectId);break;default:throw new TeamAccessError();}break;}
      case 'storageHealth':value={mode:store?'sqlite':'memory',schema:store?STORAGE_VERSION:null,artifactAudit:artifactAudit.filter(a=>service.snapshot(projectId).artifacts.some(v=>v.id===a.id))};break;
      case 'scheduler': {const previousIds=new Set(scheduler.list(projectId).schedules.map(s=>s.id));switch(args[0]){case 'list':scheduler.refresh();value=scheduler.list(projectId);break;case 'register':value=scheduler.register(projectId,args[1]);break;case 'save':value=scheduler.save(projectId,args[1],args[2]===undefined?undefined:identifier(args[2]));if(team)grantSchedules(scheduler.list(projectId).schedules.filter(s=>!previousIds.has(s.id)||s.id===args[2]).map(s=>s.id),studioIdentities.get(ws)!);break;case 'enable':value=scheduler.enable(projectId,identifier(args[1]),args[2] as boolean);if(team&&args[2]===true)grantSchedules([identifier(args[1])],studioIdentities.get(ws)!);break;case 'remove':value=scheduler.remove(projectId,identifier(args[1]));break;case 'run':{const scheduleId=identifier(args[1]);if(team)manualScheduleGrants.set(scheduleId,studioIdentities.get(ws)!);try{value=await scheduler.runNow(projectId,scheduleId,identifier(args[2]));}finally{manualScheduleGrants.delete(scheduleId);}break;}default:throw new CoreError('Scheduler: invalid-input.');}break;}
      case 'createJob': {const input=args[0] as CreateJob;if(!input||(!input.payload?.testPlan&&input.payload?.steps?.length!==1))throw new CoreError('Use a structured command or TestPlan.');for(const step of input.payload.steps){if(step.source?.provider==='snapshot'){await verifySnapshot(step.source.snapshot);if(step.source.snapshot.projectId!==projectId)throw new CoreError('Snapshot project mismatch.');}}value=await service.createJob(projectId,input,team?studioIdentities.get(ws)!.userId:undefined);break;}
      case 'dispatch':{const jobId=args[0]===undefined?undefined:identifier(args[0]);if(team){const queue=service.queue(projectId).filter(j=>jobId===undefined||j.id===jobId);if(jobId&&!queue.length)throw new CoreError('Queued Job not found.');grantJobs(queue.map(j=>j.id),studioIdentities.get(ws)!);}value=dispatch(projectId,jobId);break;}
      case 'cancelJob':{const job=service.cancelJob(projectId,identifier(args[0]));value=job;const run=service.snapshot(projectId).runs.find(r=>r.jobId===job.id&&activeRun(r));if(run)send(agents.get(run.agentId)?.socket??ws,{type:'cancel',runId:run.id});break;}
      case 'retryJob':value=service.retryJob(projectId,identifier(args[0]));break;
      case 'registerAgent':value=service.registerAgent(args[0] as Parameters<CoreService['registerAgent']>[0]);break;
      case 'removeAgent':{const agentId=identifier(args[0]);if(agents.has(agentId))throw new CoreError('Disconnect the agent before removing its registration.');value=service.removeAgent(agentId);break;}
      default:throw new CoreError('Unknown Core operation.');
    }
    send(ws,{type:'reply',requestId:id,value:value??null});schedule();
  }
  wss.on('connection',(ws,request)=>{
    let agentId:string|undefined;let authenticated=false;let processing=Promise.resolve();let pending=0;
    const timer=setTimeout(()=>{if(!authenticated)ws.close(1008,'Authentication required');},5000);
    ws.on('error',()=>{});
    ws.on('close',()=>{clearTimeout(timer);studios.delete(ws);deltaClients.delete(ws);published.delete(ws);studioIdentities.delete(ws);if(agentId)lose(agentId,ws);});
    ws.on('message',(raw,binary)=>{if(++pending>64){pending--;ws.close(1008,'Message rate exceeded');return;}operations++;processing=processing.then(async()=>{let m:Message|undefined;
      try {
        if(binary)throw new CoreError('Text JSON required.');m=decode(raw.toString());
        if(!authenticated){
          if(draining)throw new CoreError('Core is draining; new connections are disabled.');
          if(request.url==='/agent'){
            if(m.type!=='register'||(!team&&!auth(m.token,options.agentToken)))throw new CoreError('Authentication failed.');
            agentId=identifier(m.agentId);if(agents.has(agentId))throw new CoreError('Agent identity is already connected.');
            team?.authenticateAgent(agentId,m.token);
            if(team)agentSessionHashes.set(agentId,teamTokenHash(m.token as string));
            if(typeof m.agentVersion!=='string'||m.agentVersion.length>40)throw new CoreError('Invalid Agent version.');
            const input=validateAgent({name:m.name,platform:m.platform,architecture:m.architecture,capabilities:m.capabilities} as Parameters<typeof validateAgent>[0]);
            const inventory=sourceInventory(m.sourceCache);if(inventory)sourceCaches.set(agentId,inventory);
            service.connectAgent(agentId,input);agents.set(agentId,{socket:ws,seen:Date.now()});authenticated=true;
            const active=service.repository.read().runs.filter(r=>r.agentId===agentId&&activeRun(r));
            for(const run of active){if(run.id!==m.activeRunId){if(!orchestratorSafeFinish(run.id))failRun(run.id,'Interrupted execution: Agent has no matching durable claim; no automatic replay.');}else{
              const job=service.repository.read().jobs.find(j=>j.id===run.jobId)!;
              if(!job.payload.testPlan&&run.status==='pending'&&!job.cancellationRequestedAt)service.acceptExecution(run.projectId,run.id);
              restoreDeadline(run.id,ws);if(job.cancellationRequestedAt)send(ws,{type:'cancel',runId:run.id});
            }}
            service.observeAgent(agentId,true);if(typeof m.activeRunId==='string'&&!service.repository.read().runs.some(r=>r.id===m!.activeRunId)){orphanedAgents.add(agentId);service.updateAgentStatus(agentId,'error');}else orphanedAgents.delete(agentId);send(ws,{type:'registered',agentId,heartbeatTimeoutMs:options.heartbeatTimeoutMs??15000});
          }else{
            if(m.type!=='subscribe'||(!team&&!auth(m.token,options.studioToken)))throw new CoreError('Authentication failed.');
            const p=m.project as Project;if(!p||typeof p.name!=='string'||p.name.length>120)throw new CoreError('Invalid Project reference.');identifier(p.id);
            if(team){const identity=team.authenticate(m.token);team.require(identity,p.id,'read');studioIdentities.set(ws,identity);}
            // Reference existing Studio Project metadata; never create a duplicate domain model.
            if(!team||!projects.has(p.id)){if(team)team.require(studioIdentities.get(ws)!,p.id,'agent-manage');rememberProject(p);}studios.set(ws,p.id);if(m.snapshotMode==='delta-v1')deltaClients.add(ws);published.delete(ws);authenticated=true;publish();
          }
          clearTimeout(timer);return;
        }
        if(!agentId){if(m.type==='subscribe'){const p=m.project as Project;if(!p||typeof p.name!=='string'||p.name.length>120)throw new CoreError('Invalid Project reference.');identifier(p.id);if(team)team.require(studioIdentities.get(ws)!,p.id,'read');if(!team||!projects.has(p.id)){if(team)team.require(studioIdentities.get(ws)!,p.id,'agent-manage');rememberProject(p);}studios.set(ws,p.id);published.delete(ws);publish();}else if(m.type==='rpc')await rpc(ws,m);else throw new CoreError('Invalid Studio message.');return;}
        const connection=agents.get(agentId);if(connection?.socket!==ws)throw new CoreError('Stale connection.');
        if(team&&!team.validAgentSession(agentId,agentSessionHashes.get(agentId)??'')){revokeAgentConnections();return;}
        if(m.type==='heartbeat'){if(m.agentId!==agentId||!['idle','busy'].includes(m.status as string))throw new CoreError('Invalid heartbeat.');timestamp(m.timestamp);const inventory=sourceInventory(m.sourceCache);if(inventory)sourceCaches.set(agentId,inventory);connection.seen=Date.now();if(orphanedAgents.has(agentId)){service.repository.transaction(tx=>{const a=tx.agents.get(agentId!)!;a.lastSeenAt=new Date().toISOString();a.status='error';});}else service.observeAgent(agentId,true);return;}
        const runId=identifier(m.runId);const run=service.repository.read().runs.find(r=>r.id===runId);
        if(!run)throw new CoreError('Unknown Run; result retained by Agent for reconciliation.');
        if(run.agentId!==agentId||m.jobId!==run.jobId)throw new CoreError('Run ownership mismatch.');
        if(!activeRun(run)){if(m.type==='result')send(ws,{type:'ack',runId,runStepId:m.runStepId});return;}
        const pipelineJob=service.snapshot(run.projectId).jobs.find(j=>j.id===run.jobId)!;
        if(pipelineJob.payload.testPlan){
          const stepId=identifier(m.runStepId),step=service.snapshot(run.projectId).steps.find(s=>s.id===stepId&&s.runId===runId);
          if(!step)throw new CoreError('Unknown pipeline step.');
          if(m.type==='output'){
            // A started service keeps streaming under its start step while later steps execute.
            if(step.status!=='running'&&!(step.status==='passed'&&pipelineJob.payload.steps[step.order].stage==='start'))throw new CoreError('Output outside step execution.');
            let output=typeof m.text==='string'?m.text:'';
            const values=pipelineJob.payload.steps.flatMap(s=>Object.values(s.env??{})).filter(v=>v.length>=4).sort((a,b)=>b.length-a.length);
            for(const value of values)output=output.split(value).join('[redacted]');
            logs.append(runId,m.sequence,m.stream,output,stepId);schedule();return;
          }
          if(m.type==='accepted'){if(pipelineJob.cancellationRequestedAt&&pipelineJob.payload.steps[step.order].stage!=='cleanup')send(ws,{type:'cancel',runId});return;}
          if(m.type==='result'||m.type==='rejected'){
            if(step.status==='pending')throw new CoreError('Step result before durable assignment.');
            if(step.status!=='running'){send(ws,{type:'ack',runId,runStepId:stepId});advance(runId);return;}
            const status=m.type==='rejected'?'failed':run.termination==='timeout'&&m.status==='cancelled'&&pipelineJob.payload.steps[step.order].stage!=='cleanup'?'timeout':m.status;
            if(!['passed','failed','timeout','cancelled'].includes(status as string))throw new CoreError('Invalid step result.');
            try {
              if(m.type==='result'&&Date.parse(timestamp(m.finishedAt))<Date.parse(timestamp(m.startedAt)))throw new CoreError('Invalid step timestamps.');
              let summary:ReturnType<typeof browserResult>|undefined;try{summary=m.browserResult?browserResult(m.browserResult,Object.values(pipelineJob.payload.steps[step.order].env??{})):undefined;}catch{throw new CoreError('Invalid browser result.');}
              orchestrator.complete(runId,stepId,status as TerminalStatus,m.type==='rejected'?null:m.exitCode as number|null,m.type==='rejected'?'Agent rejected step.':status==='passed'?undefined:(summary?.failures[0]?.message??`${step.name} ${status}.`),m.revision as SourceRevision|undefined,typeof m.serviceId==='string'?m.serviceId:undefined,summary,executionReport(m));
            } catch(error) {if(!(error instanceof CoreError))throw error;orchestrator.complete(runId,stepId,'failed',null,'Agent returned an invalid step result.');send(ws,{type:'cancel',runId});}
            if(pipelineJob.payload.steps[step.order].stage==='source'&&status!=='passed')sourceCaches.delete(agentId);
            artifacts.revoke(stepId);send(ws,{type:'ack',runId,runStepId:stepId});advance(runId);schedule();return;
          }
          throw new CoreError('Unknown pipeline message.');
        }
        if(m.type==='accepted'){
          const job=service.snapshot(run.projectId).jobs.find(j=>j.id===run.jobId)!;
          if(job.cancellationRequestedAt){send(ws,{type:'cancel',runId});return;}
          if(run.status==='pending')service.acceptExecution(run.projectId,runId);
        }else if(m.type==='rejected'){failRun(runId,'Agent rejected the execution request.');}
        else if(m.type==='output'){if(run.status!=='running')throw new CoreError('Output before acceptance.');logs.append(runId,m.sequence,m.stream,m.text);schedule();}
        else if(m.type==='result'){
          if(!['passed','failed','timeout','cancelled'].includes(m.status as string)||!(m.exitCode===null||Number.isInteger(m.exitCode)))throw new CoreError('Invalid result.');const start=timestamp(m.startedAt),end=timestamp(m.finishedAt);if(Date.parse(end)<Date.parse(start))throw new CoreError('Invalid result times.');
          const status=m.status as 'passed'|'failed'|'timeout'|'cancelled';
          if(run.status==='pending'&&status!=='failed'&&status!=='cancelled')throw new CoreError('Result before acceptance.');
          service.completeExecution(run.projectId,runId,status,m.exitCode as number|null,m.error==="Process start failed"?"Agent could not start the executable.":`Agent reported ${status}.`,start,end,executionReport(m));send(ws,{type:'ack',runId});
        }else throw new CoreError('Unknown Agent message.');
      }catch(error){if(error instanceof StorageError){ready=false;event('error','storage.operation_failed');}const reason=error instanceof CoreError||error instanceof StorageError||error instanceof TeamAccessError?error.message:'Invalid request.';send(ws,{type:m?.type==='rpc'?'reply':'error',requestId:m?.requestId,error:reason});if(!authenticated)ws.close(1008,reason.slice(0,100));}
      finally{pending--;operations--;}
    }).catch(()=>{ws.close(1011,'Core operation failed');});});
  });
  const watchdog=setInterval(()=>{if(team)for(const [ws,p] of studios)if(!team.permits(studioIdentities.get(ws)!,p,'read'))ws.close(1008,'Team access expired or revoked');revokeAgentConnections();for(const [id,c] of agents)if(Date.now()-c.seen>(options.heartbeatTimeoutMs??15000)){lose(id,c.socket);c.socket.terminate();}},Math.min(1000,(options.heartbeatTimeoutMs??15000)/2));
  cleanup.push(()=>clearInterval(watchdog));
  const schedulerTimer=setInterval(()=>{if(draining)return;operations++;void scheduler.tick().catch(()=>{event('error','scheduler.tick_failed');}).finally(()=>{operations--;});},500);
  cleanup.push(()=>clearInterval(schedulerTimer));
  const allocationTimer=team?setInterval(()=>{if(draining)return;try{for(const job of service.queue())if(permittedJob(job.id,job.projectId))dispatch(job.projectId,job.id);}catch(error){event('error','team.assignment_failed');if(error instanceof StorageError)ready=false;}},200):undefined;
  cleanup.push(()=>clearInterval(allocationTimer));
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(options.port??4340,host,()=>resolve());});
  ready=true;event('info','core.ready',{version:options.version??'development',protocolVersion:PROTOCOL});
  const address=server.address();return {service,logs,scheduler,store,port:typeof address==='object'&&address?address.port:0,health,stop,close:shutdown};
  }catch(error){await shutdown();throw error;}
}


