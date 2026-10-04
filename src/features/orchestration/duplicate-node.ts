import {validateGraph,type ProjectGraph} from './domain.ts';
/** Copy a definition, never its connections, external binding or execution identity. */
export function duplicateNode(graph:ProjectGraph,nodeId:string,newId:string,label:string,projectId:string){
 const source=validateGraph(graph,projectId),node=source.nodes.find(node=>node.id===nodeId);
 if(!node||source.nodes.length>=60||source.nodes.some(node=>node.id===newId))throw Error('Node could not be duplicated. Graph is unchanged.');
 let name='';for(const char of label.trim()){if(name.length+char.length>120)break;name+=char;}
 const copy={id:newId,kind:node.kind,label:name,x:node.x<=2760?node.x+40:Math.max(0,node.x-40),y:node.y<=1760?node.y+40:Math.max(0,node.y-40),reference:'',role:node.role,taskType:node.taskType};
 return {graph:validateGraph({...source,nodes:[...source.nodes,copy]},projectId),node:copy};
}
