import {CronExpressionParser} from 'cron-parser';
import type {Project} from '../projects/types/project.ts';
import {protocolFiles,type ProtocolSources,type ProtocolState} from '../protocol/domain.ts';
import {parseProtocol} from '../protocol/parser.ts';
import {resolveTestPlan} from '../protocol/resolver.ts';
import {planPayload} from '../core/test-plan.ts';
import type {CreateJob,CoreService} from '../core/service.ts';
import {SchedulerError,type Schedule,type ScheduleInput,type ScheduleRepository,type ScheduleRun,type Trigger,type TriggerEvent,type ScheduleNotification} from './domain.ts';
export const MIN_INTERVAL_SECONDS=60;
const iso=(n:number)=>new Date(n).toISOString();
export function nextExecution(trigger:Trigger,timezone:string,after:number):string|null {
 try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format(after);}catch{throw new SchedulerError('invalid-timezone')}
 if(trigger.type==='manual'||trigger.type==='event')return null;
 if(trigger.type==='interval'){if(!Number.isInteger(trigger.seconds)||trigger.seconds<60||trigger.seconds>31536000)throw new SchedulerError('invalid-trigger');return iso(after+trigger.seconds*1000);}
 if(trigger.type==='time'){if(typeof trigger.at!=='string'||!/^\d{4}-\d\d-\d\dT/.test(trigger.at)||!/(Z|[+-]\d\d:\d\d)$/.test(trigger.at)||!Number.isFinite(Date.parse(trigger.at)))throw new SchedulerError('invalid-trigger');return Date.parse(trigger.at)>after?iso(Date.parse(trigger.at)):null;}
 if(trigger.type==='cron'){try{if(typeof trigger.expression!=='string'||trigger.expression.length>120||trigger.expression.trim().split(/\s+/).length!==5)throw Error();return CronExpressionParser.parse(trigger.expression,{tz:timezone,currentDate:after}).next().toDate().toISOString();}catch{throw new SchedulerError('invalid-cron')}}
 throw new SchedulerError('invalid-trigger');
}
export function validateSchedule(value:unknown,now:number):ScheduleInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new SchedulerError('invalid-input');const v=value as ScheduleInput;
 if(Object.keys(v).some(k=>!['name','testName','enabled','trigger','timezone'].includes(k))||typeof v.name!=='string'||!v.name.trim()||v.name.length>120||typeof v.testName!=='string'||!v.testName||v.testName.length>120||typeof v.enabled!=='boolean'||typeof v.timezone!=='string'||v.timezone.length>80||!v.trigger||typeof v.trigger!=='object')throw new SchedulerError('invalid-input');
 const t=v.trigger,keys:Record<Trigger['type'],string[]>={manual:['type'],cron:['type','expression'],interval:['type','seconds'],time:['type','at'],event:['type','adapter','key']};if(!keys[t.type]||Object.keys(t).some(k=>!keys[t.type].includes(k)))throw new SchedulerError('invalid-trigger');
 if(t.type==='event'&&(!['git','external','dependency','os'].includes(t.adapter)||typeof t.key!=='string'||!t.key||t.key.length>120))throw new SchedulerError('invalid-trigger');
 nextExecution(t,v.timezone,now);if(t.type==='time'&&v.enabled&&Date.parse(t.at)<=now)throw new SchedulerError('invalid-trigger');return structuredClone({...v,name:v.name.trim()});
}
export interface ScheduleRuntime {
 schedules:Schedule[]; protocols:[string,ProtocolState][]; history:ScheduleRun[];
 identities:string[]; notifications:ScheduleNotification[]; pending:[string,CreateJob][];
}
export interface SchedulePersistence {load():ScheduleRuntime|undefined;save(state:ScheduleRuntime):void}
export class ScheduleService {
 readonly core:CoreService;readonly repository:ScheduleRepository;readonly project:(id:string)=>Project|undefined;readonly dispatch:(p:string,j:string)=>unknown;readonly now:()=>number;
 runtimeError:string|null=null;private schedules:Schedule[];private protocols=new Map<string,ProtocolState>();private history:ScheduleRun[]=[];private identities=new Set<string>();private notifications:ScheduleNotification[]=[];private ticking=false;private firing=false;
 private pending=new Map<string,CreateJob>();private persistence?:SchedulePersistence;private committed:ScheduleRuntime;
 constructor(core:CoreService,repository:ScheduleRepository,project:(id:string)=>Project|undefined,dispatch:(p:string,j:string)=>unknown,now:()=>number=Date.now,persistence?:SchedulePersistence){
  this.core=core;this.repository=repository;this.project=project;this.dispatch=dispatch;this.now=now;this.persistence=persistence;
  const saved=persistence?.load();this.schedules=saved?[]:repository.load().map(s=>({...s,status:s.enabled?'awaiting-protocol':'disabled',nextRunAt:null}));
  if(saved)this.restore(saved);this.committed=this.state();if(persistence&&!saved)this.checkpoint();
 }
 private state():ScheduleRuntime{return structuredClone({schedules:this.schedules,protocols:[...this.protocols],history:this.history,identities:[...this.identities],notifications:this.notifications,pending:[...this.pending]});}
 private restore(s:ScheduleRuntime){this.schedules=structuredClone(s.schedules);this.protocols=new Map(structuredClone(s.protocols));this.history=structuredClone(s.history);this.identities=new Set(s.identities);this.notifications=structuredClone(s.notifications);this.pending=new Map(structuredClone(s.pending));}
 private checkpoint(){if(!this.persistence)return;try{const state=this.state();this.persistence.save(state);this.committed=state;}catch{this.restore(this.committed);throw new SchedulerError('persistence');}}
 private persist(next:Schedule[]){if(this.persistence){this.schedules=next;this.checkpoint();}else{try{this.repository.save(next);}catch{throw new SchedulerError('persistence')}this.schedules=next;}}
 private own(project:string,id:string){const s=this.schedules.find(s=>s.id===id&&s.projectId===project);if(!s)throw new SchedulerError('boundary');return s;}
 private protocol(projectId:string,test:string){if(!this.project(projectId))throw new SchedulerError('missing-project');const state=this.protocols.get(projectId);if(state?.status!=='Valid')throw new SchedulerError('invalid-protocol');if(!Object.hasOwn(state.definition.tests,test))throw new SchedulerError('missing-test');return state;}
 register(projectId:string,sources:unknown){if(!this.project(projectId))throw new SchedulerError('missing-project');if(!sources||typeof sources!=='object'||Array.isArray(sources)||Object.entries(sources).some(([k,v])=>!protocolFiles.includes(k as typeof protocolFiles[number])||typeof v!=='string'||v.length>65536))throw new SchedulerError('invalid-protocol');const state=parseProtocol(sources as ProtocolSources);this.protocols.set(projectId,state);const next=this.schedules.map(s=>{if(s.projectId!==projectId||!s.enabled)return s;try{this.protocol(projectId,s.testName);return{...s,status:'enabled' as const,error:undefined,nextRunAt:s.status==='enabled'?s.nextRunAt:nextExecution(s.trigger,s.timezone,this.now())}}catch(e){return{...s,status:'invalid' as const,nextRunAt:null,error:e instanceof SchedulerError?e.code:'invalid-protocol' as const}}});this.persist(next);if(state.status!=='Valid')throw new SchedulerError('invalid-protocol');return this.list(projectId);}
 list(projectId:string){return structuredClone({schedules:this.schedules.filter(s=>s.projectId===projectId),history:this.history.filter(h=>h.projectId===projectId),notifications:this.notifications.filter(n=>this.schedules.some(s=>s.id===n.scheduleId&&s.projectId===projectId)),tests:this.protocols.get(projectId)?.status==='Valid'?Object.keys((this.protocols.get(projectId) as Extract<ProtocolState,{status:'Valid'}>).definition.tests):[],policy:{runtimeError:this.runtimeError,minimumIntervalSeconds:60,overlap:'skip same Project/Test including queued jobs',missed:'skip; no backlog',autoAnalysis:false,lifetime:'Core process; UI may close',persistence:this.persistence?'SQLite encrypted Protocol, definitions, trigger identities and history':'Definitions only; resync saved Protocol after Core restart'}});}
 save(projectId:string,input:unknown,id?:string){const v=validateSchedule(input,this.now());this.protocol(projectId,v.testName);const old=id?this.own(projectId,id):null;if(!old&&this.schedules.length>=100)throw new SchedulerError('invalid-input');const s:Schedule={...v,id:old?.id??crypto.randomUUID(),projectId,createdAt:old?.createdAt??iso(this.now()),updatedAt:iso(this.now()),lastTriggeredAt:old?.lastTriggeredAt??null,nextRunAt:v.enabled?nextExecution(v.trigger,v.timezone,this.now()):null,status:v.enabled?'enabled':'disabled'};this.persist([...this.schedules.filter(c=>c.id!==s.id),s]);return this.list(projectId);}
 enable(projectId:string,id:string,enabled:boolean){if(typeof enabled!=='boolean')throw new SchedulerError('invalid-input');const s=this.own(projectId,id);if(enabled)this.protocol(projectId,s.testName);this.persist(this.schedules.map(v=>v.id===id?{...v,enabled,status:enabled?'enabled':'disabled',nextRunAt:enabled?nextExecution(v.trigger,v.timezone,this.now()):null,updatedAt:iso(this.now()),error:undefined}:v));return this.list(projectId);}
 remove(projectId:string,id:string){this.own(projectId,id);this.persist(this.schedules.filter(s=>s.id!==id));return this.list(projectId);}
 private record(s:Schedule,e:TriggerEvent,status:ScheduleRun['status'],reason?:ScheduleRun['reason']){const h:ScheduleRun={id:crypto.randomUUID(),scheduleId:s.id,projectId:s.projectId,triggeredAt:iso(this.now()),scheduledAt:e.scheduledAt,triggerType:e.type,status,reason};this.history.push(h);if(!this.persistence&&this.history.length>1000)this.history.splice(0,this.history.length-1000);return h;}
 private emit(type:ScheduleNotification['type'],h:ScheduleRun){this.notifications.push({type,scheduleId:h.scheduleId,historyId:h.id,timestamp:iso(this.now())});if(this.notifications.length>1000)this.notifications.shift();}
 private async queuePending(historyId:string){const input=this.pending.get(historyId),h=this.history.find(h=>h.id===historyId);if(!input||!h)return;
  // Durable intent precedes createJob. Its identity resolves a crash after Job commit.
  const job=await this.core.createJob(h.projectId,input);h.jobId=job.id;this.pending.delete(historyId);
  this.persist(this.schedules.map(s=>s.id===h.scheduleId?{...s,lastTriggeredAt:h.triggeredAt,updatedAt:h.triggeredAt}:s));this.emit('schedule.triggered',h);this.checkpoint();
  this.dispatch(h.projectId,job.id);this.refresh();return structuredClone(h);
 }
 async fire(projectId:string,id:string,event:TriggerEvent){const s=this.own(projectId,id);if(!s.enabled)throw new SchedulerError('disabled');if(event.scheduleId!==id||typeof event.id!=='string'||!event.id||event.id.length>120||!Number.isFinite(Date.parse(event.scheduledAt)))throw new SchedulerError('invalid-trigger');if(event.type!=='run-now'&&event.type!==s.trigger.type)throw new SchedulerError('invalid-trigger');if(s.trigger.type==='event'&&event.type!=='run-now')throw new SchedulerError('runtime-unavailable');const key=event.type==='run-now'?id+':manual:'+event.id:id+':'+event.scheduledAt+':'+event.id;if(this.identities.has(key))throw new SchedulerError('duplicate');this.identities.add(key);if(!this.persistence&&this.identities.size>3000)this.identities.delete(this.identities.values().next().value!);
  if(this.firing){const h=this.record(s,event,'skipped','capacity');this.checkpoint();return h;}this.firing=true;let historyId:string|undefined;
  try{const state=this.protocol(projectId,s.testName);const jobs=this.core.snapshot(projectId).jobs;
   if(jobs.some(j=>j.payload.testPlan?.testName===s.testName&&['queued','assigned','running'].includes(j.status))){const h=this.record(s,event,'skipped','overlap');this.checkpoint();return h;}
   if(this.core.repository.read().jobs.filter(j=>['queued','assigned','running'].includes(j.status)).length>=16){const h=this.record(s,event,'skipped','capacity');this.checkpoint();return h;}
   const plan=resolveTestPlan(state,projectId,s.testName),h=this.record(s,event,'queued');historyId=h.id;
   this.pending.set(h.id,{name:'schedule: '+s.name,requirements:plan.requirements,payload:planPayload(plan),maxAttempts:1,idempotencyKey:h.id});this.checkpoint();
   return (await this.queuePending(h.id))!;
  }catch(e){if(e instanceof SchedulerError&&e.code==='persistence')throw e;
   const h=historyId?this.history.find(h=>h.id===historyId)!:this.record(s,event,'error',e instanceof SchedulerError?e.code:'queue-failure');
   if(this.persistence&&historyId){this.runtimeError='queue-failure';return structuredClone(h);}
   h.status='error';h.reason=e instanceof SchedulerError?e.code:'queue-failure';this.pending.delete(h.id);this.emit('schedule.failed',h);this.checkpoint();return structuredClone(h);
  }finally{this.firing=false;}
 }
 async runNow(projectId:string,id:string,identity:string){if(typeof identity!=='string'||!identity||identity.length>120)throw new SchedulerError('invalid-trigger');return this.fire(projectId,id,{id:identity,scheduleId:id,type:'run-now',scheduledAt:iso(Math.floor(this.now()/1000)*1000)});}
 refresh(){let changed=false;for(const h of this.history){if(!h.jobId||!['queued','running'].includes(h.status))continue;const before=JSON.stringify(h),snap=this.core.snapshot(h.projectId),run=snap.runs.find(r=>r.jobId===h.jobId);if(run){h.runId=run.id;h.agentId=run.agentId;h.status=['pending','running'].includes(run.status)?'running':run.status as ScheduleRun['status'];if(run.finishedAt&&run.startedAt)h.durationMs=Date.parse(run.finishedAt)-Date.parse(run.startedAt);if(!['queued','running'].includes(h.status))this.emit(h.status==='passed'?'schedule.completed':'schedule.failed',h);}else if(snap.jobs.find(j=>j.id===h.jobId)?.status==='cancelled')h.status='cancelled';changed ||= before!==JSON.stringify(h);}if(changed)this.checkpoint();}
 async tick(){if(this.ticking||this.firing)return;this.ticking=true;try{
  for(const id of [...this.pending.keys()])await this.queuePending(id);
  this.refresh();for(const h of this.history.filter(h=>h.status==='queued'&&h.jobId))this.dispatch(h.projectId,h.jobId!);
  for(const s of [...this.schedules]){if(!s.enabled||s.status!=='enabled'||!s.nextRunAt||Date.parse(s.nextRunAt)>this.now())continue;const at=s.nextRunAt,e:TriggerEvent={id:at,scheduleId:s.id,scheduledAt:at,type:s.trigger.type};
   // On restart missed slots are consumed, never accumulated as a backlog.
   if(this.now()-Date.parse(at)>10000){this.record(s,e,'skipped','missed');this.persist(this.schedules.map(v=>v.id===s.id?{...v,nextRunAt:nextExecution(v.trigger,v.timezone,this.now())}:v));}
   else{try{await this.fire(s.projectId,s.id,e);}catch(error){if(!(error instanceof SchedulerError)||error.code!=='duplicate')throw error;}this.persist(this.schedules.map(v=>v.id===s.id?{...v,nextRunAt:nextExecution(v.trigger,v.timezone,this.now())}:v));}
  }this.refresh();this.runtimeError=null;
 }catch(e){this.runtimeError=e instanceof SchedulerError?e.code:'runtime-unavailable';throw e;}finally{this.ticking=false;}}
}
