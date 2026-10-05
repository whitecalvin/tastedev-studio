import {validateGraph,type ProjectGraph} from './domain.ts';

export function declaredAgentDevice(graph:ProjectGraph,agentNodeId:string){
 return graph.edges.find(edge=>edge.relation==='hosts'&&edge.to===agentNodeId)?.from??'';
}
/** 명시적인 소속 변경만 수행한다. Agent ID나 이름으로 PC를 추측하지 않는다. */
export function assignAgentDevice(graph:ProjectGraph,projectId:string,agentNodeId:string,deviceNodeId:string,edgeId:string):ProjectGraph {
 const validated=validateGraph(graph,projectId);
 if(!validated.nodes.some(node=>node.id===agentNodeId&&node.kind==='agent'))throw Error('Choose an Agent node.');
 if(deviceNodeId&&!validated.nodes.some(node=>node.id===deviceNodeId&&node.kind==='device'))throw Error('Choose a device in this project.');
 const previous=validated.edges.find(edge=>edge.relation==='hosts'&&edge.to===agentNodeId);
 if((previous?.from??'')===deviceNodeId)return validated;
 const edges=validated.edges.filter(edge=>!(edge.relation==='hosts'&&edge.to===agentNodeId));
 if(deviceNodeId)edges.push({id:previous?.id??edgeId,from:deviceNodeId,to:agentNodeId,relation:'hosts'});
 return validateGraph({...validated,edges},projectId);
}

export function deviceAgentNodes(graph:ProjectGraph,deviceNodeId:string){
 const hosted=new Set(graph.edges.filter(edge=>edge.relation==='hosts'&&edge.from===deviceNodeId).map(edge=>edge.to));
 return graph.nodes.filter(node=>node.kind==='agent'&&hosted.has(node.id));
}
