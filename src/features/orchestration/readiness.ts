import {validateGraph,type ProjectGraph} from './domain.ts';
import type {ProtocolState} from '../protocol/domain.ts';
import {availableAgentStatus,type Agent} from '../core/domain.ts';
import type {Schedule} from '../scheduler/domain.ts';
import type {AIConfigurationStore} from './ai-config.ts';
import type {ManagedAIConnection} from '../ai/routing.ts';
import {taskAIRequest} from './task-ai.ts';

export interface ReadinessIssue {nodeId?:string;message:string;severity:'configuration'|'waiting'}
export interface ReadinessContext {
 projectId:string;connected:boolean;protocol:ProtocolState|null;
 agents:Pick<Agent,'id'|'status'>[]|null;schedules:Pick<Schedule,'id'|'projectId'>[]|null;
 ai:AIConfigurationStore|null;aiConnections:ManagedAIConnection[];aiConnectionsReady:boolean;
}
/** 구성 안내만 반환한다. 실행 권한과 최종 저장 입력 검증은 Core가 담당한다. */
export function graphReadiness(graph:ProjectGraph,context:ReadinessContext):ReadinessIssue[] {
 const issues:ReadinessIssue[]=[],add=(message:string,nodeId?:string,severity:ReadinessIssue['severity']='configuration')=>issues.push({message,...(nodeId?{nodeId}:{}),severity});
 try{validateGraph(graph,context.projectId);}catch{add('Graph configuration is invalid.');return issues;}
 if(!context.connected)add('Connect to Core to verify runtime references.',undefined,'waiting');
 if(context.protocol===null)add('Waiting for project definition.',undefined,'waiting');
 else if(context.protocol.status!=='Valid')add('Configure a valid project definition.');
 if(context.ai===null)add('Waiting for AI configuration.',undefined,'waiting');
 else if(context.ai.projectId!==graph.projectId){add('AI configuration belongs to another project.');return issues;}
 const tasks=graph.nodes.filter(node=>node.kind==='task');
 if(!tasks.length)add('Add at least one task node.');
 for(const node of graph.nodes){
  if(node.kind==='agent'){
   if(!node.reference)add('Choose a registered Agent.',node.id);
   else if(context.connected&&context.agents&&!context.agents.some(agent=>agent.id===node.reference))add('The referenced Agent is unavailable.',node.id);
  }
  if(['task','approval'].includes(node.kind)&&graph.edges.filter(edge=>edge.to===node.id&&edge.relation==='success').length>1)add('Use one success predecessor; multi-parent joins are unsupported.',node.id);
  if(node.kind==='schedule'){
   const links=graph.edges.filter(edge=>edge.from===node.id&&edge.relation==='triggers');
   if(!node.reference)add('Choose an existing Schedule.',node.id);
   else if(context.connected){
    if(context.schedules===null)add('Waiting for Scheduler references.',node.id,'waiting');
    else if(!context.schedules.some(schedule=>schedule.id===node.reference&&schedule.projectId===graph.projectId))add('The referenced Schedule is unavailable in this project.',node.id);
    if(graph.nodes.some(other=>other.id!==node.id&&other.kind==='schedule'&&other.reference===node.reference))add('A Schedule needs one unique graph binding.',node.id);
   }
   if(links.length!==1||graph.edges.some(edge=>edge.to===links[0]?.to&&edge.relation==='success'))add('Connect the Schedule to one root task.',node.id);
  }
 }
 for(const node of tasks){
  const aiBound=!!context.ai?.bindings[node.id];
  if(context.ai!==null){
   if(aiBound){if(context.connected){if(!context.aiConnectionsReady)add('Waiting for managed AI connections.',node.id,'waiting');else try{taskAIRequest(context.ai!,node,context.aiConnections);}catch{add('Review the AI profile, model and connection.',node.id);}}}
   else if(!node.reference)add('Choose a Protocol task or test.',node.id);
   else if(context.protocol?.status==='Valid'&&!Object.hasOwn(node.taskType==='test'?context.protocol.definition.tests:context.protocol.definition.tasks,node.reference))add('The Protocol reference does not exist.',node.id);
  }
  const roles=graph.edges.filter(edge=>edge.to===node.id&&edge.relation==='performs');
  if(roles.length!==1){add('Connect exactly one responsible role.',node.id);continue;}
  const role=graph.nodes.find(other=>other.id===roles[0].from)!;
  if(role.role==='deployment'){
   const incoming=graph.edges.filter(edge=>edge.to===node.id&&['success','failure'].includes(edge.relation));
   if(incoming.length!==1||incoming[0].relation!=='success'||graph.nodes.find(other=>other.id===incoming[0].from)?.kind!=='approval')add('Deployment needs an immediate approval predecessor.',node.id);
  }
  if(aiBound)continue;
  const assigned=graph.edges.filter(edge=>edge.to===role.id&&edge.relation==='assigns').map(edge=>edge.from);
  const candidates=graph.nodes.filter(other=>other.kind==='agent'&&other.reference&&(assigned.includes(other.id)||graph.edges.some(edge=>edge.relation==='hosts'&&edge.to===other.id&&assigned.includes(edge.from))));
  if(!candidates.length)add('Assign an Agent or its declared device to the responsible role.',node.id);
  else if(context.connected){
   if(context.agents===null)add('Waiting for Agent references.',node.id,'waiting');
   else{
    const registered=context.agents.filter(agent=>candidates.some(candidate=>candidate.reference===agent.id));
    if(!registered.length)add('The responsible role has no registered Agent.',node.id);
    else if(registered.every(agent=>agent.status==='offline'))add('Assigned Agents are offline; execution must wait.',node.id,'waiting');
    else if(!registered.some(agent=>availableAgentStatus(agent.status)))add('Assigned Agents are busy or unavailable; execution must wait.',node.id,'waiting');
   }
  }
 }
 return issues;
}
