import {verifySnapshot} from '../src/features/ai/snapshot.ts';
import {ScheduleService} from '../src/features/scheduler/service.ts';
import {MemoryScheduleRepository} from '../src/features/scheduler/domain.ts';
import {FileScheduleRepository} from './schedule-repository.ts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {artifactGateway,browserResult} from './artifacts.ts';
import {aiGateway} from './ai-gateway.ts';
import {OpenAIProvider} from './ai-provider.ts';
import {CodexProvider} from './codex-provider.ts';
import {GitHubIssueProvider} from './github-provider.ts';
import {issueGateway} from './issue-gateway.ts';
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
import { validateAgent } from '../src/features/core/matcher.ts';
import { decode, identifier, timestamp, PROTOCOL, MESSAGE_LIMIT, RunLogs, type Message } from './protocol.ts';
export interface ServerOptions { schedulePath?:string; issueProvider?:IssueProvider; artifactRoot?:string; artifactBaseUrl?:string; port?:number; host?:string; agentToken:string; studioToken:string; allowLan?:boolean; origins?:string[]; heartbeatTimeoutMs?:number }
const auth=(actual:unknown,expected:string)=>typeof actual==='string'&&actual.length<=512&&timingSafeEqual(createHash('sha256').update(actual).digest(),createHash('sha256').update(expected).digest());
export async function startCoreServer(options:ServerOptions) {
  const host=options.host??'127.0.0.1';
  if(!['127.0.0.1','::1','localhost'].includes(host)&&!options.allowLan)throw new Error('LAN binding requires explicit allowLan.');
  if(options.agentToken.length<16||options.studioToken.length<16)throw new Error('Two configured tokens of at least 16 characters are required.');
  const origins=options.origins??['http://127.0.0.1:4320','http://localhost:4320','http://127.0.0.1:4330','http://127.0.0.1:4317','http://tauri.localhost','https://tauri.localhost','tauri://localhost'];
  const projects=new Map<string,Project>();const service=new CoreService(new InMemoryCoreRepository(),{get:async id=>projects.get(id)??null});
  const logs=new RunLogs();const agents=new Map<string,{socket:WebSocket;seen:number}>();const studios=new Map<WebSocket,string>();
  const orchestrator=new TestOrchestrator(service);
  const scheduler=new ScheduleService(service,options.schedulePath?new FileScheduleRepository(options.schedulePath):new MemoryScheduleRepository(),id=>projects.get(id),(p,j)=>dispatch(p,j));
  const artifacts=artifactGateway(service,options.artifactRoot??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../../resources/artifacts/tastedev-studio'),options.studioToken,origins);
  const runTimers=new Map<string,ReturnType<typeof setTimeout>>();
  function advance(runId:string) {
    const next=orchestrator.next(runId);
    if(!next){const done=orchestrator.finish(runId);if(done){clearTimeout(runTimers.get(runId));runTimers.delete(runId);const ws=agents.get(done.agentId)?.socket;if(ws)send(ws,{type:'closeRun',runId});}return;}
    const {run,job,step,command}=next,ws=agents.get(run.agentId)?.socket;
    if(!ws){failRun(runId,'Agent transport unavailable during pipeline.');return;}
    if(!runTimers.has(runId))runTimers.set(runId,setTimeout(()=>{orchestrator.terminate(runId,'timeout');send(ws,{type:'cancel',runId});},job.payload.testPlan!.timeout));
    // Cleanup has its own bounded allowance beyond the overall deadline.
    if(command.stage==='cleanup'){clearTimeout(runTimers.get(runId));runTimers.delete(runId);}
    send(ws,{type:'execute',agentId:run.agentId,jobId:job.id,runId,runStepId:step.id,projectId:run.projectId,requirements:job.requirements,executable:command.executable,args:command.args,cwd:command.cwd,env:command.env??{},timeoutMs:command.timeoutMs??60000,stage:command.stage,...(command.browser?{browser:command.browser,artifactTransfer:artifacts.grant(runId,step.id,options.artifactBaseUrl??`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`)}:{}),...(command.source?{source:command.source}:{}),...(command.healthcheck?{healthcheck:command.healthcheck}:{})});
  }
  const providerName=process.env.TASTEDEV_AI_PROVIDER??'codex';
  if(!['codex','openai'].includes(providerName))throw new Error('TASTEDEV_AI_PROVIDER must be codex or openai.');
  const provider=providerName==='openai'?new OpenAIProvider(process.env.OPENAI_API_KEY??'',process.env.TASTEDEV_AI_MODEL??'gpt-4.1-mini'):new CodexProvider(process.env.TASTEDEV_CODEX_MODEL);
  const ai=aiGateway(provider,options.studioToken,origins,id=>projects.has(id),Object.entries(process.env).filter(([k])=>/key|secret|token|password/i.test(k)).map(([,v])=>v??'').filter(Boolean),Number(process.env.TASTEDEV_AI_TIMEOUT_MS??120000));
  const issueSecrets=Object.entries(process.env).filter(([k])=>/key|secret|token|password/i.test(k)).map(([,v])=>v??'').filter(Boolean);
  const issues=issueGateway(options.issueProvider??new GitHubIssueProvider(undefined,issueSecrets),options.studioToken,origins,id=>projects.get(id),id=>service.snapshot(id),id=>(logs.read([id])[id]??[]).map(l=>l.text),issueSecrets);
  const server=createServer((req,res)=>{if(req.url?.startsWith('/ai/'))void ai(req,res);else if(req.url?.startsWith('/issues/'))void issues.handle(req,res);else void artifacts.handle(req,res);});
  const wss=new WebSocketServer({noServer:true,maxPayload:MESSAGE_LIMIT,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{if(!['/agent','/studio'].includes(req.url??'')||(req.headers.origin&&!origins.includes(req.headers.origin))){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
  const send=(ws:WebSocket,data:object)=>{if(ws.readyState!==WebSocket.OPEN)return false;if(ws.bufferedAmount>1048576){ws.terminate();return false;}ws.send(JSON.stringify({protocolVersion:PROTOCOL,...data}));return true;};
  function publish(){for(const [ws,id] of studios){const snapshot=service.snapshot(id);send(ws,{type:'snapshot',snapshot,logs:logs.read(snapshot.runs.map(r=>r.id))});}}
  let publishTimer:ReturnType<typeof setTimeout>|undefined;
  const schedule=()=>{publishTimer??=setTimeout(()=>{publishTimer=undefined;publish();},40)};
  const unsubscribe=service.repository.subscribe(schedule);
  function lose(id:string,ws:WebSocket){if(agents.get(id)?.socket!==ws)return;agents.delete(id);service.observeAgent(id,false);}
  function failRun(id:string,summary:string){const run=service.repository.read().runs.find(r=>r.id===id);if(!run||!activeRun(run))return;service.finishRun(run.projectId,run.id,'failed',null,summary);if(!agents.has(run.agentId))service.observeAgent(run.agentId,false);}
  function dispatch(projectId:string,jobId?:string){
    const unsupported=service.queue(projectId).find(j=>j.payload.steps.length!==1&&!j.payload.testPlan);if(unsupported)throw new CoreError('Multi-step execution requires a TestPlan.');
    const a=service.dispatch(projectId,jobId);if(!a)return null;const socket=agents.get(a.agent.id)?.socket;
    if(!socket){failRun(a.run.id,'Agent transport is unavailable.');service.observeAgent(a.agent.id,false);return a;}
    if(a.job.payload.testPlan){advance(a.run.id);return a;}
    const step=a.job.payload.steps[0];send(socket,{type:'execute',agentId:a.agent.id,jobId:a.job.id,runId:a.run.id,projectId,requirements:a.job.requirements,executable:step.executable,args:step.args,cwd:step.cwd,env:step.env??{},timeoutMs:step.timeoutMs??60000});return a;
  }
  async function rpc(ws:WebSocket,m:Message){const id=identifier(m.requestId),projectId=studios.get(ws)!;const args=Array.isArray(m.args)?m.args:[];let value:unknown;
    switch(m.method){
      case 'scheduler': {switch(args[0]){case 'list':scheduler.refresh();value=scheduler.list(projectId);break;case 'register':value=scheduler.register(projectId,args[1]);break;case 'save':value=scheduler.save(projectId,args[1],args[2]===undefined?undefined:identifier(args[2]));break;case 'enable':value=scheduler.enable(projectId,identifier(args[1]),args[2] as boolean);break;case 'remove':value=scheduler.remove(projectId,identifier(args[1]));break;case 'run':value=await scheduler.runNow(projectId,identifier(args[1]),identifier(args[2]));break;default:throw new CoreError('Scheduler: invalid-input.');}break;}
      case 'createJob': {const input=args[0] as CreateJob;if(!input||(!input.payload?.testPlan&&input.payload?.steps?.length!==1))throw new CoreError('Use a structured command or TestPlan.');for(const step of input.payload.steps){if(step.source?.provider==='snapshot'){await verifySnapshot(step.source.snapshot);if(step.source.snapshot.projectId!==projectId)throw new CoreError('Snapshot project mismatch.');}}value=await service.createJob(projectId,input);break;}
      case 'dispatch':value=dispatch(projectId,args[0]===undefined?undefined:identifier(args[0]));break;
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
    ws.on('close',()=>{clearTimeout(timer);studios.delete(ws);if(agentId)lose(agentId,ws);});
    ws.on('message',(raw,binary)=>{if(++pending>64){ws.close(1008,'Message rate exceeded');return;}processing=processing.then(async()=>{let m:Message|undefined;
      try {
        if(binary)throw new CoreError('Text JSON required.');m=decode(raw.toString());
        if(!authenticated){
          if(request.url==='/agent'){
            if(m.type!=='register'||!auth(m.token,options.agentToken))throw new CoreError('Authentication failed.');
            agentId=identifier(m.agentId);if(agents.has(agentId))throw new CoreError('Agent identity is already connected.');
            if(typeof m.agentVersion!=='string'||m.agentVersion.length>40)throw new CoreError('Invalid Agent version.');
            const input=validateAgent({name:m.name,platform:m.platform,architecture:m.architecture,capabilities:m.capabilities} as Parameters<typeof validateAgent>[0]);
            service.connectAgent(agentId,input);agents.set(agentId,{socket:ws,seen:Date.now()});authenticated=true;
            const active=service.repository.read().runs.filter(r=>r.agentId===agentId&&activeRun(r));
            for(const run of active)if(run.id!==m.activeRunId)failRun(run.id,'Agent restarted without this active execution.');
            service.observeAgent(agentId,true);send(ws,{type:'registered',agentId,heartbeatTimeoutMs:options.heartbeatTimeoutMs??15000});
          }else{
            if(m.type!=='subscribe'||!auth(m.token,options.studioToken))throw new CoreError('Authentication failed.');
            const p=m.project as Project;if(!p||typeof p.name!=='string'||p.name.length>120)throw new CoreError('Invalid Project reference.');identifier(p.id);
            // Reference existing Studio Project metadata; never create a duplicate domain model.
            projects.set(p.id,p);studios.set(ws,p.id);authenticated=true;publish();
          }
          clearTimeout(timer);return;
        }
        if(!agentId){if(m.type==='subscribe'){const p=m.project as Project;if(!p||typeof p.name!=='string'||p.name.length>120)throw new CoreError('Invalid Project reference.');identifier(p.id);projects.set(p.id,p);studios.set(ws,p.id);publish();}else if(m.type==='rpc')await rpc(ws,m);else throw new CoreError('Invalid Studio message.');return;}
        const connection=agents.get(agentId);if(connection?.socket!==ws)throw new CoreError('Stale connection.');
        if(m.type==='heartbeat'){if(m.agentId!==agentId||!['idle','busy'].includes(m.status as string))throw new CoreError('Invalid heartbeat.');timestamp(m.timestamp);connection.seen=Date.now();service.observeAgent(agentId,true);return;}
        const runId=identifier(m.runId);const run=service.repository.read().runs.find(r=>r.id===runId);
        if(!run){if(m.type==='result'){send(ws,{type:'ack',runId,runStepId:m.runStepId});send(ws,{type:'closeRun',runId});return;}throw new CoreError('Unknown Run.');}
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
            if(step.status!=='running'){send(ws,{type:'ack',runId,runStepId:stepId});return;}
            const status=m.type==='rejected'?'failed':run.termination==='timeout'&&m.status==='cancelled'&&pipelineJob.payload.steps[step.order].stage!=='cleanup'?'timeout':m.status;
            if(!['passed','failed','timeout','cancelled'].includes(status as string))throw new CoreError('Invalid step result.');
            try {
              if(m.type==='result'&&Date.parse(timestamp(m.finishedAt))<Date.parse(timestamp(m.startedAt)))throw new CoreError('Invalid step timestamps.');
              if(m.browserResult){const summary=browserResult(m.browserResult,Object.values(pipelineJob.payload.steps[step.order].env??{}));service.repository.transaction(tx=>{tx.steps.get(stepId)!.browserResult=summary;});}
              orchestrator.complete(runId,stepId,status as TerminalStatus,m.type==='rejected'?null:m.exitCode as number|null,m.type==='rejected'?'Agent rejected step.':status==='passed'?undefined:(service.repository.read().steps.find(s=>s.id===stepId)?.browserResult?.failures[0]?.message??`${step.name} ${status}.`),m.revision as SourceRevision|undefined,typeof m.serviceId==='string'?m.serviceId:undefined);
            } catch {orchestrator.complete(runId,stepId,'failed',null,'Agent returned an invalid step result.');send(ws,{type:'cancel',runId});}
            artifacts.revoke(stepId);send(ws,{type:'ack',runId,runStepId:stepId});advance(runId);schedule();return;
          }
          throw new CoreError('Unknown pipeline message.');
        }
        if(m.type==='accepted'){
          const job=service.snapshot(run.projectId).jobs.find(j=>j.id===run.jobId)!;
          if(job.cancellationRequestedAt){send(ws,{type:'cancel',runId});return;}
          if(run.status==='pending'){service.startRun(run.projectId,runId);const step=service.snapshot(run.projectId).steps.find(s=>s.runId===runId)!;service.changeStep(run.projectId,runId,step.id,'running');}
        }else if(m.type==='rejected'){failRun(runId,'Agent rejected the execution request.');}
        else if(m.type==='output'){if(run.status!=='running')throw new CoreError('Output before acceptance.');logs.append(runId,m.sequence,m.stream,m.text);schedule();}
        else if(m.type==='result'){
          if(!['passed','failed','timeout','cancelled'].includes(m.status as string)||!(m.exitCode===null||Number.isInteger(m.exitCode)))throw new CoreError('Invalid result.');const start=timestamp(m.startedAt),end=timestamp(m.finishedAt);if(Date.parse(end)<Date.parse(start))throw new CoreError('Invalid result times.');
          const status=m.status as 'passed'|'failed'|'timeout'|'cancelled';
          if(run.status==='pending'&&status!=='failed'&&status!=='cancelled')throw new CoreError('Result before acceptance.');
          if(status==='passed'){const step=service.snapshot(run.projectId).steps.find(s=>s.runId===runId)!;service.changeStep(run.projectId,runId,step.id,'passed',m.exitCode as number);}
          service.finishRun(run.projectId,runId,status,m.exitCode as number|null,m.error==="Process start failed"?"Agent could not start the executable.":`Agent reported ${status}.`);service.repository.transaction(tx=>{const record=tx.runs.get(runId)!;record.startedAt=start;record.finishedAt=end;});send(ws,{type:'ack',runId});
        }else throw new CoreError('Unknown Agent message.');
      }catch(error){const reason=error instanceof CoreError?error.message:'Invalid request.';send(ws,{type:m?.type==='rpc'?'reply':'error',requestId:m?.requestId,error:reason});if(!authenticated)ws.close(1008,reason.slice(0,100));}
      finally{pending--;}
    }).catch(()=>{ws.close(1011,'Core operation failed');});});
  });
  const watchdog=setInterval(()=>{for(const [id,c] of agents)if(Date.now()-c.seen>(options.heartbeatTimeoutMs??15000)){lose(id,c.socket);c.socket.terminate();}},Math.min(1000,(options.heartbeatTimeoutMs??15000)/2));
  const schedulerTimer=setInterval(()=>{void scheduler.tick().catch(()=>{/* Definitions survive transient queue/store failure; no unhandled timer rejection. */});},500);
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(options.port??4340,host,()=>resolve());});
  const address=server.address();return {service,logs,scheduler,port:typeof address==='object'&&address?address.port:0,close:async()=>{clearInterval(schedulerTimer);clearInterval(watchdog);clearTimeout(publishTimer);for(const timer of runTimers.values())clearTimeout(timer);unsubscribe();for(const ws of wss.clients)ws.terminate();await new Promise<void>(resolve=>wss.close(()=>server.close(()=>resolve())));}};
}


