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
