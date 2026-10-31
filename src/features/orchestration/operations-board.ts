import {matchAgent} from '../core/matcher.ts';
import {resolveProtocol} from '../protocol/resolver.ts';
import type {ProtocolState} from '../protocol/domain.ts';
import type {Agent} from '../core/domain.ts';
import type {ProjectGraph} from './domain.ts';

/** Report only explicit graph membership; an Agent name never proves a physical PC identity. */
export function deviceOperations(graph:ProjectGraph,agents:Agent[],connected:boolean) {
 const registered=new Map((connected?agents:[]).map(agent=>[agent.id,agent]));
 const agentNodes=graph.nodes.filter(node=>node.kind==='agent');
 function members(deviceId:string|null) {
  return agentNodes.filter(node=>deviceId===null?!graph.edges.some(edge=>edge.relation==='hosts'&&edge.to===node.id):graph.edges.some(edge=>edge.relation==='hosts'&&edge.from===deviceId&&edge.to===node.id)).map(node=>({node,report:registered.get(node.reference)}));
 }
 const devices=graph.nodes.filter(node=>node.kind==='device').map(device=>{
  const agents=members(device.id),sources=new Set([device.id,...agents.map(agent=>agent.node.id)]);
  const roleIds=new Set(graph.edges.filter(edge=>edge.relation==='assigns'&&sources.has(edge.from)).map(edge=>edge.to));
  const roles=graph.nodes.filter(node=>node.kind==='role'&&roleIds.has(node.id));
  const taskIds=new Set(graph.edges.filter(edge=>edge.relation==='performs'&&roleIds.has(edge.from)).map(edge=>edge.to));
  const tasks=graph.nodes.filter(node=>node.kind==='task'&&taskIds.has(node.id));
  return {device,agents,roles,tasks};
 });
 return {devices,unassigned:members(null)};
}

/** Local preparation preview only. Core rechecks policy and authorization at dispatch. */
export function deviceTaskReadiness(graph:ProjectGraph,agents:Agent[],connected:boolean,protocol:ProtocolState|null,deviceId:string){
 const row=deviceOperations(graph,agents,connected).devices.find(r=>r.device.id===deviceId);if(!row)return[];
 return row.tasks.map(task=>{const base={node:task,cwd:undefined as string|undefined,matches:[] as {agentId:string;matches:boolean;reasons:string[]}[]};if(!connected)return{...base,state:'waiting',message:'Connect to Core to verify runtime references.'};if(!task.reference)return{...base,state:'unverified',message:'Review the AI profile, model and connection.'};if(protocol?.status!=='Valid')return{...base,state:'configuration',message:'Configure a valid project definition.'};try{const job=resolveProtocol(protocol,task.taskType,task.reference),role=graph.edges.find(e=>e.to===task.id&&e.relation==='performs')?.from,assigned=new Set(graph.edges.filter(e=>e.to===role&&e.relation==='assigns').map(e=>e.from)),reports=row.agents.filter(a=>assigned.has(deviceId)||assigned.has(a.node.id)).flatMap(a=>a.report?[a.report]:[]),matches=reports.map(a=>matchAgent(a,job.requirements));return{...base,cwd:job.payload.steps[0]?.cwd,matches,state:matches.some(m=>m.matches)?'ready':'waiting',message:!matches.length?'The responsible role has no registered Agent.':matches.some(m=>m.matches)?'Ready':'Assigned Agents are busy or unavailable; execution must wait.'};}catch{return{...base,state:'configuration',message:'The Protocol reference does not exist.'};}});
}
