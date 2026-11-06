import {validateGraph,type ProjectGraph} from './domain.ts';
/** Copy a definition, never its connections, external binding or execution identity. */
export function duplicateNode(graph:ProjectGraph,nodeId:string,newId:string,label:string,projectId:string){
 const source=validateGraph(graph,projectId),node=source.nodes.find(node=>node.id===nodeId);
 if(!node||source.nodes.length>=60||source.nodes.some(node=>node.id===newId))throw Error('Node could not be duplicated. Graph is unchanged.');
 let name='';for(const char of label.trim()){if(name.length+char.length>120)break;name+=char;}
 if(node.kind==='build-package'){
  const children=source.nodes.filter(n=>n.parentId===node.id);if(source.nodes.length+children.length+1>60)throw Error('Node could not be duplicated. Graph is unchanged.');
  const mapping=new Map(children.map((n,i)=>[n.id,newId+'-step-'+i]));
  const copy={...node,id:newId,label:name,x:Math.min(1700,node.x+40),y:Math.min(1300,node.y+40),...(node.subflow?{subflow:{entryId:mapping.get(node.subflow.entryId)!,exitId:mapping.get(node.subflow.exitId)!}}:{})};
  const copied=children.map(n=>({...n,id:mapping.get(n.id)!,parentId:newId,x:n.x+copy.x-node.x,y:n.y+copy.y-node.y,reference:'',frameworkTask:undefined,instructionRef:undefined}));
  const edges=source.edges.filter(e=>mapping.has(e.from)&&mapping.has(e.to)).map((e,i)=>({...e,id:newId+'-flow-'+i,from:mapping.get(e.from)!,to:mapping.get(e.to)!}));
  return{graph:validateGraph({...source,nodes:[...source.nodes,copy,...copied],edges:[...source.edges,...edges]},projectId),node:copy};
 }
 const copy={id:newId,kind:node.kind,label:name,x:node.x<=2760?node.x+40:Math.max(0,node.x-40),y:node.y<=1760?node.y+40:Math.max(0,node.y-40),reference:'',role:node.role,taskType:node.taskType};
 return {graph:validateGraph({...source,nodes:[...source.nodes,copy]},projectId),node:copy};
}
