import type { ProjectGraph } from './domain.ts';
import type { GraphActivation, GraphOverview } from './execution.ts';

export function graphMonitor(graph: ProjectGraph, overview: GraphOverview | null, executionId = '') {
  const execution = executionId
    ? overview?.executions.find(e => e.id === executionId && e.projectId === graph.projectId)
    : overview?.executions.findLast(e => e.projectId === graph.projectId);
  const definition = overview?.definition;
  const compatible = !!execution && !!definition && definition.projectId === graph.projectId &&
    execution.revision === definition.revision && execution.checksum === definition.checksum &&
    execution.inputChecksum === definition.inputChecksum && JSON.stringify(definition.graph) === JSON.stringify(graph);
  const nodes = new Map<string, GraphActivation>();
  if (compatible) {
    for (const activation of execution.activations) {
      if (!graph.nodes.some(n => n.id === activation.nodeId && ['task','approval'].includes(n.kind))) continue;
      const previous = nodes.get(activation.nodeId);
      if (!previous || activation.attempt >= previous.attempt) nodes.set(activation.nodeId, activation);
    }
  }
  const activity=new Map<string,{status:GraphActivation['status'];attempt:number;reason?:string}>(),edges=new Map<string,string>();
  if(compatible){
    const rank:GraphActivation['status'][]=['failed','ai-fix-review','ai-review','approval','ai-running','running','launching','queued','ready','cancelled','passed'];
    for(const node of graph.nodes){
      if(nodes.has(node.id)){activity.set(node.id,nodes.get(node.id)!);continue;}
      if(!['device','agent','role'].includes(node.kind))continue;
      const visited=new Set<string>(),pending=[node.id],tasks:string[]=[];
      while(pending.length){const id=pending.pop()!;if(visited.has(id))continue;visited.add(id);if(graph.nodes.some(n=>n.id===id&&n.kind==='task'))tasks.push(id);for(const edge of graph.edges)if(edge.from===id&&['hosts','assigns','performs'].includes(edge.relation))pending.push(edge.to);}
      if(!tasks.some(id=>nodes.has(id)))continue;
      const states=tasks.map(id=>nodes.get(id)??{status:'ready' as const,attempt:0,reason:'Waiting for predecessor work.'}).sort((a,b)=>rank.indexOf(a.status)-rank.indexOf(b.status)),first=states[0];
      if(first)activity.set(node.id,{status:first.status,attempt:Math.max(...states.map(a=>a.attempt)),reason:first.reason});
    }
    for(const edge of graph.edges){const state=activity.get(edge.to)??activity.get(edge.from);if(state)edges.set(edge.id,state.status);}
  }
  return { execution, compatible, nodes, activity, edges };
}
