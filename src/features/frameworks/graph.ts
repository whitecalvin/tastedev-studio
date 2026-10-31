import {newNode,validateGraph,type ProjectGraph} from '../orchestration/domain.ts';
import {catalog} from './catalog.ts';
import {instructionRef,type ExecutionMode} from './domain.ts';
export function placeFrameworkSelection(graph:ProjectGraph,input:{roleIds:string[];skillIds:string[];agentNodeId:string;mode:ExecutionMode;arguments:string}){
 if(!input.roleIds.length||new Set(input.roleIds).size!==input.roleIds.length||new Set(input.skillIds).size!==input.skillIds.length)throw Error('Select distinct framework roles and skills.');
 if(!graph.nodes.some(n=>n.id===input.agentNodeId&&n.kind==='agent'))throw Error('Select an execution Agent node.');
 const next=structuredClone(graph),selected=new Map<string,string>();
 for(const id of [...input.roleIds,...input.skillIds]){
  const entry=catalog.entries.find(e=>e.id===id);if(!entry||!['role','skill'].includes(entry.kind))throw Error('Unknown framework definition.');
  const nodeId='ccgs-'+id.replace(':','-');if(next.nodes.some(n=>n.id===nodeId))throw Error('Framework selection is already on the canvas.');
  const n={...newNode(entry.kind==='role'?'role':'task',nodeId,next.nodes.length%40),label:String(entry.frontmatter.name??id.split(':')[1]).slice(0,120),instructionRef:instructionRef(entry)};
  if(entry.kind==='skill')Object.assign(n,{taskType:'test',frameworkTask:{mode:input.mode,skillId:entry.id,arguments:input.arguments,roleId:String(entry.frontmatter['allowed-tools']??'').includes('AskUserQuestion')?'workflow':input.roleIds[0]}});
  next.nodes.push(n);selected.set(id,nodeId);
  next.edges.push({id:nodeId+'-binding',from:entry.kind==='role'?input.agentNodeId:selected.get(input.roleIds[0])!,to:nodeId,relation:entry.kind==='role'?'assigns':'performs'});
 }
 return validateGraph(next,next.projectId);
}
