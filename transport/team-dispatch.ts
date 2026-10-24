import {CoreError} from '../src/features/core/domain.ts';
import {teamId,type TeamWorkOverview} from '../src/features/orchestration/team-intent.ts';
import type {GraphOverview} from '../src/features/orchestration/execution.ts';
import type {FactoryOverview} from '../src/features/orchestration/factory.ts';
import type {TeamHandoff,TeamDispatchOverview} from '../src/features/orchestration/team-dispatch.ts';
import type {GraphPersistence} from './graph-execution.ts';
interface DispatchState {version:1;revision:number;handoffs:TeamHandoff[]}
export interface TeamDispatchBridge {work(project:string):TeamWorkOverview;graph(project:string):GraphOverview;factory(project:string):FactoryOverview;graphRequest(project:string,action:string,input:unknown,actor:string):Promise<unknown>;factoryRequest(project:string,action:string,input:unknown,actor:string):Promise<unknown>;authorize(actor:string,project:string,action:'read'|'history-write'|'approve'|'run'|'cancel'):void}
function fail(m:string):never{throw new CoreError('Team dispatch: '+m);}
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
/** Durable handoff metadata delegates all execution/approval/patch work to Graph and Factory. */
export class TeamDispatch {
  private state:DispatchState={version:1,revision:0,handoffs:[]};private serial:Promise<unknown>=Promise.resolve();
  private bridge:TeamDispatchBridge;private persistence?:GraphPersistence;private now:()=>string;
  constructor(bridge:TeamDispatchBridge,persistence?:GraphPersistence,now=()=>new Date().toISOString()){
    this.bridge=bridge;this.persistence=persistence;this.now=now;
    const saved=persistence?.load();if(saved){this.validate(saved as DispatchState);this.state=structuredClone(saved as DispatchState);this.commit(s=>{for(const h of s.handoffs){if(!['launching','dispatched','paused'].includes(h.status))continue;const f=h.factoryTaskId?this.bridge.factory(h.projectId).tasks.find(t=>t.contract.taskId===h.factoryTaskId):undefined,e=this.bridge.graph(h.projectId).executions.find(e=>e.id===h.executionId);if(['completed','passed','failed','cancelled'].includes(f?.status??e?.status??'')){h.status='dispatched';delete h.reason;}else{h.status='paused';h.reason='Core restarted. Review the linked execution before resuming.';}}});}
  }
  private validate(s:DispatchState){if(s.version!==1||!Number.isSafeInteger(s.revision)||s.revision<0||!Array.isArray(s.handoffs)||s.handoffs.length>500||new Set(s.handoffs.map(h=>h.id)).size!==s.handoffs.length)fail('Invalid durable state; preserved.');for(const h of s.handoffs)if(![h.id,h.projectId,h.messageId,h.intentId,h.nodeId,h.executionId].every(teamId)||h.factoryTaskId!==undefined&&!teamId(h.factoryTaskId)||![h.intentDigest,h.graphChecksum,h.inputChecksum].every(hash)||!Number.isSafeInteger(h.intentVersion)||h.intentVersion<1||!Number.isSafeInteger(h.graphRevision)||h.graphRevision<1||!['prepared','launching','dispatched','paused','cancelled'].includes(h.status)||typeof h.actor!=='string'||!Number.isFinite(Date.parse(h.createdAt))||h.approvedAt!==undefined&&!Number.isFinite(Date.parse(h.approvedAt)))fail('Invalid durable handoff; preserved.');}
  private commit(change:(s:DispatchState)=>void){const s=structuredClone(this.state);change(s);if(JSON.stringify(s)===JSON.stringify(this.state))return;s.revision++;this.validate(s);this.persistence?.save(s);this.state=s;}
  overview(project:string):TeamDispatchOverview {return{revision:this.state.revision,durable:!!this.persistence,handoffs:this.state.handoffs.filter(h=>h.projectId===project).map(h=>{const f=h.factoryTaskId?this.bridge.factory(project).tasks.find(t=>t.contract.taskId===h.factoryTaskId):undefined,e=this.bridge.graph(project).executions.find(e=>e.id===(f?.attempts.at(-1)?.executionId??h.executionId));return{...h,actor:undefined,runtimeStatus:h.status==='cancelled'?'cancelled':f?.status??e?.status??h.status,runIds:e?.activations.flatMap(a=>a.runId?[a.runId]:[])??[],analysisIds:e?.activations.flatMap(a=>a.analysisId?[a.analysisId]:[])??[]};})};}
  request(project:string,action:string,input:unknown,actor:string):Promise<TeamDispatchOverview>{const result=this.serial.then(()=>this.perform(project,action,input,actor));this.serial=result.catch(()=>{});return result;}
  private async perform(project:string,action:string,input:unknown,actor:string){
    this.bridge.authorize(actor,project,'read');if(action==='list')return this.overview(project);if(!teamId(project))fail('Invalid project.');
    const i=input as {id:string;revision:number;messageId:string;intentId:string;factoryTaskId?:string};if(!i||!teamId(i.id))fail('Invalid identity.');
    this.bridge.authorize(actor,project,action==='prepare'?'history-write':action==='cancel'?'cancel':'approve');
    let h=this.state.handoffs.find(h=>h.id===i.id&&h.projectId===project);
    if(action==='prepare'&&h){if(h.messageId!==i.messageId||h.intentId!==i.intentId||h.factoryTaskId!==i.factoryTaskId)fail('Identity conflict.');return this.overview(project);}
    if(i.revision!==this.state.revision)fail('Handoff changed. Refresh before continuing.');
    if(action==='prepare'){
      if(this.state.handoffs.length>=500||this.state.handoffs.some(h=>h.id===i.id))fail('Identity conflict or capacity.');
      const work=this.bridge.work(project),message=work.messages.find(m=>m.id===i.messageId),intent=work.intents.find(v=>v.id===i.intentId),assignment=work.assignments.find(a=>a.intentId===i.intentId),d=this.bridge.graph(project).definition;
      if(!message?.acknowledgedAt||message.kind!=='handoff'||!intent?.ready||message.to!==intent.responsibility||!assignment||!d||assignment.intentVersion!==intent.version||assignment.graphRevision!==d.revision||assignment.inputChecksum!==d.inputChecksum)fail('Review an acknowledged handoff and matching recipient assignment.');
      if(this.state.handoffs.some(h=>h.projectId===project&&h.messageId===message.id&&h.status!=='cancelled'))fail('Message already linked to an execution.');
      const f=i.factoryTaskId?this.bridge.factory(project).tasks.find(t=>t.contract.taskId===i.factoryTaskId):undefined;
      if(intent.responsibility==='implementation'&&(!f||f.status!=='draft'||f.contract.intent?.id!==intent.id||f.contract.intent.version!==intent.version||f.contract.intent.digest!==intent.digest||f.contract.implementationNodeId!==assignment.taskNodeId))fail('Choose a reviewed recipient Factory draft.');
      if(intent.responsibility!=='implementation'&&i.factoryTaskId)fail('Read-only handoffs cannot queue implementation work.');
      h={id:i.id,projectId:project,messageId:message.id,intentId:intent.id,intentVersion:intent.version,intentDigest:intent.digest,graphRevision:d.revision,graphChecksum:d.checksum,inputChecksum:d.inputChecksum,nodeId:assignment.taskNodeId,...(f?{factoryTaskId:f.contract.taskId,factoryVersion:f.version}:{}),executionId:'handoff-'+i.id,status:'prepared',createdAt:this.now(),actor};this.commit(s=>s.handoffs.push(h!));return this.overview(project);
    }
    if(!h)fail('Handoff not found.');const target=h!;
    if(action==='cancel'){
      if(target.factoryTaskId){const f=this.bridge.factory(project).tasks.find(f=>f.contract.taskId===target.factoryTaskId);if(f&&!['completed','cancelled'].includes(f.status))await this.bridge.factoryRequest(project,'cancel',{taskId:f.contract.taskId,version:f.version},actor);}
      else{const e=this.bridge.graph(project).executions.find(e=>e.id===target.executionId);if(e&&['running','paused','cancelling'].includes(e.status))await this.bridge.graphRequest(project,'cancel',{executionId:e.id},actor);}
      this.commit(s=>s.handoffs.find(h=>h.id===target.id)!.status='cancelled');return this.overview(project);
    }
    if(!['dispatch','resume'].includes(action))fail('Unknown action.');this.bridge.authorize(actor,project,'run');
    if(target.status==='dispatched')return this.overview(project);if(target.status==='cancelled')fail('Cancelled handoff.');
    const work=this.bridge.work(project),intent=work.intents.find(v=>v.id===target.intentId),assignment=work.assignments.find(a=>a.intentId===target.intentId),d=this.bridge.graph(project).definition;
    if(!intent?.ready||intent.version!==target.intentVersion||intent.digest!==target.intentDigest||!d||d.revision!==target.graphRevision||d.checksum!==target.graphChecksum||d.inputChecksum!==target.inputChecksum||assignment?.taskNodeId!==target.nodeId)fail('Recipient intent or graph changed. Prepare a new handoff.');
    this.commit(s=>Object.assign(s.handoffs.find(h=>h.id===target.id)!,{status:'launching',actor,approvedAt:this.now(),reason:undefined}));
    try{
      if(target.factoryTaskId){const f=this.bridge.factory(project).tasks.find(f=>f.contract.taskId===target.factoryTaskId);if(!f)fail('Factory task unavailable.');if(f!.status==='draft'){if(f!.version!==target.factoryVersion)fail('Factory draft changed.');await this.bridge.factoryRequest(project,'queue',{taskId:f!.contract.taskId,version:f!.version},actor);}else if(f!.status==='paused')await this.bridge.factoryRequest(project,'resume',{taskId:f!.contract.taskId,version:f!.version},actor);else if(['failed','cancelled'].includes(f!.status))fail('Review the failed Factory task directly.');}
      else{const e=this.bridge.graph(project).executions.find(e=>e.id===target.executionId);if(e?.status==='paused')await this.bridge.graphRequest(project,'resume',{executionId:e.id},actor);else if(!e)await this.bridge.graphRequest(project,'start',{revision:target.graphRevision,checksum:target.graphChecksum,entryNodeId:target.nodeId,requestId:target.executionId,teamIntentId:target.intentId},actor);}
      this.commit(s=>Object.assign(s.handoffs.find(h=>h.id===target.id)!,{status:'dispatched',reason:undefined}));
    }catch(error){this.commit(s=>Object.assign(s.handoffs.find(h=>h.id===target.id)!,{status:'paused',reason:'Execution reply unavailable. Review and resume the same handoff.'}));throw error;}
    return this.overview(project);
  }
}
