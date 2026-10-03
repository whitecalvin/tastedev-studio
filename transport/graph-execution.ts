import {createHash,randomUUID} from 'node:crypto';
import {validateGraph,type ProjectGraph} from '../src/features/orchestration/domain.ts';
import type {GraphDefinition,GraphActivation,GraphExecution,GraphOverview} from '../src/features/orchestration/execution.ts';
import {CoreError,activeRun} from '../src/features/core/domain.ts';
import {matchAgent} from '../src/features/core/matcher.ts';
import {validatePayload} from '../src/features/core/matcher.ts';
import type {CoreService} from '../src/features/core/service.ts';
import {parseProtocol} from '../src/features/protocol/parser.ts';
import {protocolFiles,type ProtocolSources} from '../src/features/protocol/domain.ts';
import {resolveProtocol,resolveTestPlan} from '../src/features/protocol/resolver.ts';
import {planPayload} from '../src/features/core/test-plan.ts';
import {graphSourcePlan,graphActivationPlan} from '../src/features/orchestration/source-plan.ts';
import {verifyProjectReference,type ProjectSnapshot} from '../src/features/ai/project-snapshot.ts';
export interface GraphPersistence {load():unknown;save(state:unknown):void}
interface State {version:1;definitions:GraphDefinition[];executions:GraphExecution[]}
type Authority=(actor:string,projectId:string,action:'run'|'approve'|'cancel'|'history-write'|'read')=>void;
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(message:string):never=>{throw new CoreError('Graph: '+message);};
const terminal=(a:GraphActivation)=>['passed','failed','cancelled'].includes(a.status);
const jobActor=(actor:string)=>{if(!actor.startsWith('{'))return actor;const identity=JSON.parse(actor) as {userId:string};return identity.userId;};
/** A durable intent is committed before Job creation. Core idempotency links a lost reply
 * to the same activation; process restart pauses progression rather than replaying work. */
export class GraphExecutionService {
 private state:State={version:1,definitions:[],executions:[]};private serial:Promise<unknown>=Promise.resolve();
 private core:CoreService;private dispatch:(project:string,job:string)=>unknown;private cancelJob:(project:string,job:string)=>void;private persistence?:GraphPersistence;private authority:Authority;private now:()=>number;private verifySource?:(snapshot:ProjectSnapshot,project:string)=>Promise<unknown>;
 constructor(core:CoreService,dispatch:(project:string,job:string)=>unknown,cancelJob:(project:string,job:string)=>void,persistence?:GraphPersistence,authority:Authority=()=>{},now=Date.now,verifySource?:(snapshot:ProjectSnapshot,project:string)=>Promise<unknown>){
  this.core=core;this.dispatch=dispatch;this.cancelJob=cancelJob;this.persistence=persistence;this.authority=authority;this.now=now;this.verifySource=verifySource;
  const saved=persistence?.load();if(saved){const s=saved as State;if(s.version!==1||!Array.isArray(s.definitions)||!Array.isArray(s.executions)||s.definitions.length>100||s.executions.length>500)fail('Invalid durable state; preserved.');for(const d of s.definitions){validateGraph(d.graph,d.projectId);if(d.checksum!==digest(d.graph)||!Number.isInteger(d.revision)||d.revision<1)fail('Definition integrity mismatch.');}for(const e of s.executions){if(!s.definitions.some(d=>d.projectId===e.projectId)||e.definition.projectId!==e.projectId||e.checksum!==digest(e.definition.graph)||!Array.isArray(e.activations)||e.activations.length>180||!Number.isFinite(Date.parse(e.deadline)))fail('Execution integrity mismatch.');}this.state=structuredClone(s);this.commit(next=>{for(const e of next.executions)if(e.status==='running'){e.status='paused';e.reason='Core restarted; review and resume with current authority.';}});}
 }
 private commit(change:(next:State)=>void){const next=structuredClone(this.state);change(next);if(JSON.stringify(next)===JSON.stringify(this.state))return;this.persistence?.save(next);this.state=next;}
 private locked<T>(fn:()=>T|Promise<T>):Promise<T>{const result=this.serial.then(fn);this.serial=result.catch(()=>{});return result;}
 private execution(project:string,id:string){return this.state.executions.find(e=>e.projectId===project&&e.id===id)??fail('Execution not found in project.');}
 overview(project:string):GraphOverview{const d=this.state.definitions.find(d=>d.projectId===project);return structuredClone({definition:d?{...d,plans:undefined}:null,executions:this.state.executions.filter(e=>e.projectId===project).map(e=>({...e,definition:undefined,source:e.definition.source,nodeLabels:Object.fromEntries(e.definition.graph.nodes.map(n=>[n.id,n.label]))})),durable:!!this.persistence});}
 request(project:string,action:string,input:unknown,actor:string){return this.locked(async()=>{
  this.authority(actor,project,action==='list'?'read':action==='publish'?'history-write':action==='approve'?'approve':action==='cancel'?'cancel':'run');
  if(action==='list')return this.overview(project);
  const source=action==='publish'?(input as {snapshot?:ProjectSnapshot})?.snapshot:action==='start'?this.state.definitions.find(d=>d.projectId===project)?.source:['approve','resume'].includes(action)?this.execution(project,(input as {executionId:string})?.executionId).definition.source:undefined;
  if(source){if(!this.verifySource)fail('Source verification unavailable.');await this.verifySource!(source,project);}
  if(action==='publish')this.publish(project,input);
  else if(action==='start')this.start(project,input,actor);
  else if(action==='approve'){const i=input as {executionId:string;activationId:string;revision:number;checksum:string};const e=this.execution(project,i?.executionId);if(e.status!=='running'||e.revision!==i.revision||e.checksum!==i.checksum)fail('Approval version conflict.');const a=e.activations.find(a=>a.id===i.activationId&&a.status==='approval')??fail('Approval activation not waiting.');this.commit(s=>{const target=s.executions.find(v=>v.id===e.id)!.activations.find(v=>v.id===a.id)!;target.status='passed';target.approvedBy=actor;target.approvedAt=new Date(this.now()).toISOString();this.follow(s.executions.find(v=>v.id===e.id)!,target,'success');});}
  else if(action==='resume'){const i=input as {executionId:string};const e=this.execution(project,i?.executionId);if(e.status!=='paused')fail('Only paused execution can resume.');this.commit(s=>{const e2=s.executions.find(v=>v.id===e.id)!;e2.status='running';e2.actor=actor;e2.reason=undefined;});}
  else if(action==='cancel'){const i=input as {executionId:string};const e=this.execution(project,i?.executionId);if(!['running','paused','cancelling'].includes(e.status))fail('Execution already finished.');this.commit(s=>{s.executions.find(v=>v.id===e.id)!.status='cancelling';});}
  else fail('Unknown action.');
  await this.advance();return this.overview(project);
 });}
 private publish(project:string,input:unknown){
  const i=input as {graph:ProjectGraph;sources:ProtocolSources;expectedRevision:number;snapshot?:ProjectSnapshot};const graph=validateGraph(i?.graph,project),previous=this.state.definitions.find(d=>d.projectId===project);
  if(i.expectedRevision!==(previous?.revision??0))fail('Revision conflict; reload Core definition.');
  if(!i.sources||Object.entries(i.sources).some(([k,v])=>!protocolFiles.includes(k as typeof protocolFiles[number])||typeof v!=='string'||v.length>65536))fail('Invalid Protocol sources.');
  const protocol=parseProtocol(i.sources);if(protocol.status!=='Valid')fail('Valid Protocol required.');
  if(i.snapshot){verifyProjectReference(i.snapshot);if(i.snapshot.projectId!==project)fail('Source project mismatch.');}
  const plans:GraphDefinition['plans']={},agents:GraphDefinition['agents']={},deploymentNodes:string[]=[];const snapshot=this.core.snapshot(project);
  for(const n of graph.nodes.filter(n=>n.kind==='task')){
   if(!n.reference)fail('Every task needs a Protocol reference.');
   const p=n.taskType==='test'?resolveTestPlan(protocol,project,n.reference):null;
   plans[n.id]=p?{name:'test: '+n.reference,requirements:p.requirements,payload:planPayload(p)}:resolveProtocol(protocol,'task',n.reference);
   const roles=graph.edges.filter(e=>e.to===n.id&&e.relation==='performs');if(roles.length!==1)fail('Each task needs exactly one responsible role.');
   if(graph.nodes.find(v=>v.id===roles[0].from)?.role==='deployment'){
    const incoming=graph.edges.filter(e=>e.to===n.id&&['success','failure'].includes(e.relation));if(incoming.length!==1||incoming[0].relation!=='success'||graph.nodes.find(v=>v.id===incoming[0].from)?.kind!=='approval')fail('Deployment requires an immediate approval predecessor, including retries.');deploymentNodes.push(n.id);
   }
   if(i.snapshot)plans[n.id]=graphSourcePlan(plans[n.id],project,i.snapshot);
   validatePayload(graphActivationPlan(plans[n.id],{executionId:'preflight',activationId:'preflight',nodeId:n.id,attempt:1,revision:(previous?.revision??0)+1,sourceChecksum:i.snapshot?.checksum,snapshotId:i.snapshot?.snapshotId}).payload);
   const assigned=graph.edges.filter(e=>e.to===roles[0].from&&e.relation==='assigns').map(e=>e.from);
   const candidates=graph.nodes.filter(a=>a.kind==='agent'&&a.reference&&(assigned.includes(a.id)||graph.edges.some(e=>e.relation==='hosts'&&e.to===a.id&&assigned.includes(e.from))));
   agents[n.id]=candidates.map(a=>a.reference).filter(id=>snapshot.agents.some(a=>a.id===id));
   if(!agents[n.id].length)fail('Responsible role needs an accessible registered Agent on its declared device.');
  }
  if(!Object.keys(plans).length)fail('At least one task required.');
  for(const n of graph.nodes.filter(n=>n.kind==='task'||n.kind==='approval'))if(graph.edges.filter(e=>e.to===n.id&&e.relation==='success').length>1)fail('Multi-parent joins are not supported; use one explicit predecessor.');
  const definition:GraphDefinition={...(i.snapshot?{source:i.snapshot}:{}),deploymentNodes,projectId:project,revision:(previous?.revision??0)+1,checksum:digest(graph),inputChecksum:digest(i.sources),graph,plans,agents,publishedAt:new Date(this.now()).toISOString()};
  this.commit(s=>{if(!previous&&s.definitions.length>=100)fail('Definition capacity reached.');s.definitions=s.definitions.filter(d=>d.projectId!==project).concat(definition);});
 }
 private start(project:string,input:unknown,actor:string){const i=input as {revision:number;checksum:string;entryNodeId:string;requestId:string};const d=this.state.definitions.find(d=>d.projectId===project)??fail('Publish definition first.');
  if(d.revision!==i?.revision||d.checksum!==i.checksum)fail('Definition changed; review again.');if(typeof i.requestId!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(i.requestId))fail('Invalid request identity.');
  const existing=this.state.executions.find(e=>e.id===i.requestId);if(existing){if(existing.projectId!==project||existing.revision!==d.revision||existing.inputChecksum!==d.inputChecksum||existing.definition.source?.checksum!==d.source?.checksum||existing.checksum!==d.checksum||existing.activations[0]?.nodeId!==i.entryNodeId)fail('Request identity conflict.');return;}
  const node=d.graph.nodes.find(n=>n.id===i.entryNodeId&&['task','approval'].includes(n.kind))??fail('Choose a task or approval entry.');
  if(d.graph.edges.some(e=>e.to===node.id&&e.relation==='success'))fail('Entry must be a root; approval cannot be bypassed.');
  if(this.state.executions.some(e=>e.projectId===project&&['running','paused','cancelling'].includes(e.status)))fail('Finish or cancel the active project execution first.');
  const e:GraphExecution={id:i.requestId,projectId:project,revision:d.revision,checksum:d.checksum,inputChecksum:d.inputChecksum,definition:structuredClone(d),status:'running',activations:[],actor,createdAt:new Date(this.now()).toISOString(),deadline:new Date(this.now()+600000).toISOString()};this.activate(e,node.id);
  this.commit(s=>{if(s.executions.length>=500)fail('Execution history capacity reached.');s.executions.push(e);});
 }
 private activate(e:GraphExecution,nodeId:string,approvalId?:string){const node=e.definition.graph.nodes.find(n=>n.id===nodeId)!,attempt=e.activations.filter(a=>a.nodeId===nodeId).length+1;if(attempt>e.definition.graph.retryLimit){e.status='failed';e.reason='Retry limit reached.';e.finishedAt=new Date(this.now()).toISOString();return;}if(e.definition.deploymentNodes?.includes(nodeId)&&(!approvalId||!e.activations.some(a=>a.id===approvalId&&a.approvedAt)||e.activations.some(a=>a.approvalId===approvalId))){e.status='failed';e.reason='Fresh deployment approval required.';return;}e.activations.push({id:randomUUID(),nodeId,attempt,...(approvalId?{approvalId}:{}),status:node.kind==='approval'?'approval':'ready'});}
 private follow(e:GraphExecution,a:GraphActivation,relation:'success'|'failure'){const targets=e.definition.graph.edges.filter(v=>v.from===a.nodeId&&v.relation===relation);if(relation==='failure'&&!targets.length){e.status='failed';e.reason='Task failed without a recovery branch.';e.finishedAt=new Date(this.now()).toISOString();return;}for(const edge of targets)this.activate(e,edge.to,a.approvedAt&&e.definition.deploymentNodes?.includes(edge.to)?a.id:undefined);}
 private owner(jobId:string){const job=this.core.repository.readEntity?.('jobs',jobId)??this.core.repository.read().jobs.find(j=>j.id===jobId);return this.state.executions.find(e=>e.activations.some(a=>a.jobId===jobId||job?.idempotencyKey===`graph:${e.id}:${a.id}`));}
 owns(jobId:string){return !!this.owner(jobId);}
 allows(jobId:string){const owner=this.owner(jobId);if(!owner)return true;if(owner.status!=='running')return false;try{this.authority(owner.actor,owner.projectId,'run');return true;}catch{return false;}}
 tick(){return this.locked(()=>this.advance());}
 private async advance(){for(const original of [...this.state.executions]){
  let e=this.execution(original.projectId,original.id);if(['passed','cancelled'].includes(e.status)||e.status==='failed'&&e.activations.every(terminal))continue;
  if(e.status==='paused')continue;
  if(e.status==='running')try{this.authority(e.actor,e.projectId,'run');}catch{this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!;x.status='paused';x.reason='Execution authority expired or revoked.';});continue;}
  if(this.now()>Date.parse(e.deadline)&&e.status==='running')this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!;x.status='cancelling';x.reason='Execution deadline reached.';});
  e=this.execution(e.projectId,e.id);
  for(const originalActivation of [...e.activations]){
   e=this.execution(e.projectId,e.id);const a=e.activations.find(v=>v.id===originalActivation.id)!;if(terminal(a))continue;
   const jobs=this.core.snapshot(e.projectId).jobs;
   // A crash after createJob but before linking is reconciled by its durable key.
   const job=a.jobId?jobs.find(j=>j.id===a.jobId):jobs.find(j=>j.idempotencyKey===`graph:${e.id}:${a.id}`);
   if(e.status==='cancelling'||e.status==='failed'){
    if(job&&['queued','assigned','running'].includes(job.status)){this.cancelJob(e.projectId,job.id);if(job.status!=='queued')continue;}
    this.commit(s=>{s.executions.find(v=>v.id===e.id)!.activations.find(v=>v.id===a.id)!.status='cancelled';});continue;
   }
   if(e.status!=='running'||a.status==='approval')continue;
   if(job){const run=this.core.snapshot(e.projectId).runs.find(r=>r.jobId===job.id);
    this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!,v=x.activations.find(v=>v.id===a.id)!;v.jobId=job.id;v.runId=run?.id;v.agentId=job.pinnedAgentId;
     if(job.status==='succeeded'){v.status='passed';this.follow(x,v,'success');}else if(job.status==='failed'){v.status='failed';this.follow(x,v,'failure');}else if(job.status==='cancelled'){v.status='cancelled';x.status='cancelling';}else v.status=job.status==='queued'?'queued':'running';});
    if(job.status==='queued')this.dispatch(e.projectId,job.id);continue;
   }
   const plan=e.definition.plans[a.nodeId];if(!plan)fail('Immutable plan missing.');
   const agent=this.core.snapshot(e.projectId).agents.find(v=>e.definition.agents[a.nodeId].includes(v.id)&&matchAgent(v,plan.requirements).matches);
   if(!agent)continue;
   this.commit(s=>{const v=s.executions.find(v=>v.id===e.id)!.activations.find(v=>v.id===a.id)!;v.status='launching';v.agentId=agent.id;});
   const bound=graphActivationPlan(plan,{executionId:e.id,activationId:a.id,nodeId:a.nodeId,attempt:a.attempt,revision:e.revision,sourceChecksum:e.definition.source?.checksum,snapshotId:e.definition.source?.snapshotId});
   const queued=await this.core.createJob(e.projectId,{...bound,pinnedAgentId:agent.id,maxAttempts:1,idempotencyKey:`graph:${e.id}:${a.id}`},jobActor(e.actor));
   this.commit(s=>{const v=s.executions.find(v=>v.id===e.id)!.activations.find(v=>v.id===a.id)!;v.jobId=queued.id;v.status='queued';});this.dispatch(e.projectId,queued.id);
  }
  e=this.execution(e.projectId,e.id);
  if(e.status==='cancelling'&&e.activations.every(terminal))this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!;x.status='cancelled';x.finishedAt=new Date(this.now()).toISOString();});
  else if(e.status==='running'&&e.activations.every(terminal))this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!;x.status='passed';x.finishedAt=new Date(this.now()).toISOString();});
 }}
 cancelActive(project:string,jobId:string){const run=this.core.snapshot(project).runs.find(r=>r.jobId===jobId&&activeRun(r));return run;}
}
