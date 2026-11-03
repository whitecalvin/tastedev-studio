import {validateGraph,type ProjectGraph} from './domain.ts';
import type {GraphOverview} from './execution.ts';
type Definition=NonNullable<GraphOverview['definition']>;
export function executionReviewKey(definition:Definition|null|undefined,entry:string,timeoutMinutes:number,generation:number):string|null{
 if(!definition||definition.graph.projectId!==definition.projectId||definition.source&&definition.source.projectId!==definition.projectId||!Number.isSafeInteger(generation)||generation<0||!Number.isInteger(timeoutMinutes)||timeoutMinutes<1||timeoutMinutes>120)return null;
 const node=definition.graph.nodes.find(n=>n.id===entry);
 if(!node||!['task','approval'].includes(node.kind)||definition.graph.edges.some(e=>e.to===entry&&e.relation==='success'))return null;
 return JSON.stringify([definition.projectId,definition.revision,definition.checksum,definition.inputChecksum,definition.source?.snapshotId??null,definition.source?.checksum??null,definition.source?.baseRevision??null,entry,timeoutMinutes,generation]);
}
export function reviewedExecutionInput(definition:Definition,entry:string,timeoutMinutes:number,generation:number,reviewedKey:string){
 const key=executionReviewKey(definition,entry,timeoutMinutes,generation);
 if(!key||key!==reviewedKey)throw Error('Review the saved graph version before continuing.');
 return{revision:definition.revision,checksum:definition.checksum,entryNodeId:entry,timeoutMinutes};
}
/** Dependency groups are potential parallelism, not a reservation or an approval.
 * Failure edges remain conditional; do not turn feedback into automatic work. */
export function executionPreview(graph:ProjectGraph,definition:Definition|null|undefined,entry:string){
 const empty={levels:[] as {nodeId:string;kind:'approval'|'ai'|'framework'|'protocol';agentIds:string[]}[][],failurePaths:[] as {from:string;to:string}[],blocked:true};
 if(!definition||definition.projectId!==graph.projectId||JSON.stringify(definition.graph)!==JSON.stringify(graph))return empty;
 try{validateGraph(graph,graph.projectId);}catch{return empty;}
 if(!executionReviewKey(definition,entry,1,0))return empty;
 const levels:typeof empty.levels=[],seen=new Set<string>();let current=[entry];
 while(current.length){
  const next=new Set<string>(),level:typeof empty.levels[number]=[];
  for(const id of current){if(seen.has(id))continue;seen.add(id);const node=graph.nodes.find(n=>n.id===id)!;
   level.push({nodeId:id,kind:node.kind==='approval'?'approval':definition.aiTasks?.[id]?'ai':node.frameworkTask?'framework':'protocol',agentIds:[...(definition.agents[id]??[])]});
   for(const edge of graph.edges)if(edge.from===id&&edge.relation==='success')next.add(edge.to);
  }
  if(level.length)levels.push(level);current=[...next];
 }
 return{levels,failurePaths:graph.edges.filter(e=>e.relation==='failure'&&seen.has(e.from)).map(e=>({from:e.from,to:e.to})),blocked:false};
}
