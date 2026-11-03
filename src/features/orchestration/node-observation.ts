import type {Agent,CoreSnapshot,RunStep} from '../core/domain.ts';
import type {Schedule,ScheduleRun} from '../scheduler/domain.ts';
import type {ProjectGraph} from './domain.ts';
import type {GraphActivation,GraphOverview} from './execution.ts';
import {graphMonitor} from './monitor.ts';

export interface ObservedWork {
 nodeId:string;label:string;activationId?:string;attempt:number;status:string;
 runId?:string;agentId?:string;step?:Pick<RunStep,'id'|'name'|'status'>;
 source?:{snapshotId:string;checksum:string};
 reasons:string[];history:GraphActivation[];identityConflict:boolean;
 ai?:{connectionId:string;adapter:string;model:string};
 next:'run'|'approval'|'ai'|'wait'|'review';
}
export interface NodeObservation {
 nodeId:string;kind:string;availability:'disconnected'|'unpublished'|'stale'|'reported';
 message:string;agents:Pick<Agent,'id'|'name'|'status'|'platform'|'lastSeenAt'>[];
 work:ObservedWork[];execution?:{id:string;revision:number;status:string;snapshotId?:string;sourceChecksum?:string};
 schedule?:{id:string;status:string;nextRunAt:string|null;history?:Pick<ScheduleRun,'id'|'status'|'graphExecutionId'>};
}
export interface ObservationInput {
 graph:ProjectGraph;overview:GraphOverview|null;snapshot:CoreSnapshot;nodeId:string;
 connected:boolean;dirty?:boolean;executionId?:string;
 schedules?:Schedule[]|null;scheduleHistory?:ScheduleRun[];
}
/** A read-only projection. Configuration relationships never prove execution,
 * and an Agent's live registry status is distinct from a completed task. */
export function nodeObservation(input:ObservationInput):NodeObservation|null {
 const {graph,overview,snapshot,nodeId}=input,node=graph.nodes.find(n=>n.id===nodeId);
 if(!node)return null;
 const result:NodeObservation={nodeId,kind:node.kind,availability:'disconnected',message:'Connect to Core in Agents.',agents:[],work:[]};
 if(!input.connected)return result;
 const definition=overview?.definition;
 if(!definition||definition.projectId!==graph.projectId){result.availability='unpublished';result.message='Publish graph to Core';return result;}
 const monitor=graphMonitor(graph,overview,input.executionId);
 if(input.dirty||JSON.stringify(definition.graph)!==JSON.stringify(graph)||(monitor.execution&&!monitor.compatible)||input.executionId&&!monitor.execution){
  result.availability='stale';result.message='This execution differs from the current graph. Node states are hidden.';return result;
 }
 result.availability='reported';result.message='No run has been reported for this node.';
 const execution=monitor.execution;
 if(execution)result.execution={id:execution.id,revision:execution.revision,status:execution.status,snapshotId:execution.source?.snapshotId,sourceChecksum:execution.source?.checksum};
 const related=new Set<string>(),pending=[node.id];
 while(pending.length){const id=pending.pop()!;if(related.has(id))continue;related.add(id);for(const edge of graph.edges)if(edge.from===id&&['hosts','assigns','performs'].includes(edge.relation))pending.push(edge.to);}
 const agentReferences=new Set(graph.nodes.filter(n=>n.kind==='agent'&&related.has(n.id)&&n.reference).map(n=>n.reference));
 if(node.kind==='agent')agentReferences.add(node.reference);
 for(const agent of snapshot.agents)if(agentReferences.has(agent.id))result.agents.push({id:agent.id,name:agent.name,status:agent.status,platform:agent.platform,lastSeenAt:agent.lastSeenAt});
 let tasks=graph.nodes.filter(n=>related.has(n.id)&&['task','approval'].includes(n.kind));
 if(node.kind==='agent')tasks=graph.nodes.filter(n=>n.kind==='task'&&definition.agents[n.id]?.includes(node.reference));
 for(const task of tasks){
  const history=execution?.activations.filter(a=>a.nodeId===task.id)??[];
  const latest=history.reduce<GraphActivation|undefined>((last,a)=>!last||a.attempt>=last.attempt?a:last,undefined);
  // A shared role may choose another device/Agent. Do not paint that work as
  // executing on this selected machine or on an unselected sibling Agent.
  const activation=latest?.agentId&&['agent','device'].includes(node.kind)&&!agentReferences.has(latest.agentId)?undefined:latest;
  const row:ObservedWork={nodeId:task.id,label:task.label,activationId:activation?.id,attempt:activation?.attempt??0,status:activation?.status??'Not reported',reasons:[],history:activation?history.map(a=>structuredClone(a)):[],identityConflict:false,next:'review'};
  const plan=(execution?.aiTasks??definition.aiTasks)?.[task.id];
  if(plan?.projectId===graph.projectId&&plan.nodeId===task.id)row.ai={...plan.route};
  if(activation){
   row.reasons=[...new Set([...(activation.waitingReasons??[]),...(activation.reason?[activation.reason]:[])])];
   row.agentId=activation.agentId;
   if(activation.runId){
    const run=snapshot.runs.find(r=>r.id===activation.runId&&r.projectId===graph.projectId);
    const job=snapshot.jobs.find(j=>j.id===activation.jobId&&j.projectId===graph.projectId);
    if(run&&job&&run.jobId===job.id&&run.agentId===activation.agentId){
     if(run.cleanupWarning)row.reasons.push(run.cleanupWarning);
     const captured=job.payload.steps.find(s=>s.source?.provider==='snapshot')?.source;
     const source=captured?.provider==='snapshot'?captured.snapshot:undefined;
     let valid=activation.status!=='passed'||run.status==='passed'&&run.exitCode===0&&!!run.finishedAt;
     if(source&&activation.status==='passed'&&!run.revision)valid=false;
     if(source&&run.revision&&(run.revision.snapshotId!==source.snapshotId||run.revision.commit!==source.checksum))valid=false;
     for(const command of job.payload.steps){
      const raw=command.env?.TASTEDEV_GRAPH_CONTEXT;
      if(raw)try{const c=JSON.parse(raw);if(c.executionId!==execution!.id||c.activationId!==activation.id||c.nodeId!==task.id||c.attempt!==activation.attempt||c.revision!==execution!.revision||c.snapshotId!==source?.snapshotId||c.sourceChecksum!==source?.checksum)valid=false;}catch{valid=false;}
      else valid=false;
      if(command.source?.provider==='snapshot'&&(command.source.snapshot.snapshotId!==source?.snapshotId||command.source.snapshot.checksum!==source?.checksum))valid=false;
     }
     if(valid){
      row.runId=run.id;
      if(source)row.source={snapshotId:source.snapshotId,checksum:source.checksum};
      const steps=snapshot.steps.filter(s=>s.runId===run.id).sort((a,b)=>a.order-b.order);
      const step=steps.find(s=>s.status==='running')??steps.find(s=>['failed','timeout'].includes(s.status));
      if(step)row.step={id:step.id,name:step.name,status:step.status};
     }else row.identityConflict=true;
    }else if(run||job)row.identityConflict=true;
    else {row.status='Not reported';row.reasons.push('No run has been reported for this node.');}
   }
   if(row.identityConflict){row.status='Not reported';row.runId=undefined;row.agentId=undefined;row.reasons=['Execution identity does not match this node.'];}
   else if(['approval','ai-fix-review','framework-review'].includes(activation.status))row.next='approval';
   else if(activation.status==='ai-review')row.next='ai';
   else if(row.runId)row.next='run';
   else if(['ready','queued','launching','running','ai-running'].includes(activation.status))row.next='wait';
  }
  result.work.push(row);
 }
 if(node.kind==='schedule'){
  const schedule=input.schedules?.find(s=>s.id===node.reference&&s.projectId===graph.projectId);
  if(schedule){
   const binding=schedule.graph,entry=graph.edges.find(e=>e.from===node.id&&e.relation==='triggers')?.to;
   const valid=!!binding&&binding.revision===definition.revision&&binding.checksum===definition.checksum&&binding.entryNodeId===entry;
   const history=input.scheduleHistory?.filter(h=>h.projectId===graph.projectId&&h.scheduleId===schedule.id&&(!input.executionId||h.graphExecutionId===input.executionId)).at(-1);
   result.schedule={id:schedule.id,status:valid?schedule.status:'invalid',nextRunAt:valid?schedule.nextRunAt:null,...(history?{history:{id:history.id,status:history.status,graphExecutionId:history.graphExecutionId}}:{})};
  }
 }
 return result;
}
