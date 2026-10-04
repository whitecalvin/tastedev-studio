import type {ProjectGraph,GraphEdge,GraphNode} from './domain.ts';
export interface NodeConnection {edge:GraphEdge;node:GraphNode}
/** Immediate neighbours only: failure feedback is data, never a traversal/execution loop. */
export function nodeConnections(graph:ProjectGraph,nodeId:string,projectId:string){
 const incoming:NodeConnection[]=[],outgoing:NodeConnection[]=[];
 if(graph.projectId!==projectId||!graph.nodes.some(node=>node.id===nodeId))return {incoming,outgoing};
 const nodes=new Map(graph.nodes.map(node=>[node.id,node]));
 for(const edge of graph.edges){
  if(edge.from===edge.to||!nodes.has(edge.from)||!nodes.has(edge.to))continue;
  if(edge.to===nodeId)incoming.push({edge,node:nodes.get(edge.from)!});
  if(edge.from===nodeId)outgoing.push({edge,node:nodes.get(edge.to)!});
 }
 return {incoming,outgoing};
}
