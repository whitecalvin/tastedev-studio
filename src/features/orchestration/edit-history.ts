import {validateGraph,type ProjectGraph} from './domain.ts';
export interface GraphEdits {projectId:string;past:ProjectGraph[];future:ProjectGraph[];group:string|null}
export const emptyEdits=(projectId:string):GraphEdits=>({projectId,past:[],future:[],group:null});
const same=(a:ProjectGraph,b:ProjectGraph)=>JSON.stringify(a)===JSON.stringify(b);
export function recordEdit(history:GraphEdits,before:ProjectGraph,after:ProjectGraph,group:string|null=null):GraphEdits{
 const old=validateGraph(before,history.projectId),next=validateGraph(after,history.projectId);
 if(same(old,next))return history;
 const grouped=group!==null&&group===history.group&&history.past.length>0;
 return {...history,past:grouped?history.past:[...history.past,old].slice(-50),future:[],group};
}
export function travelEdit(history:GraphEdits,current:ProjectGraph,direction:'undo'|'redo'){
 const present=validateGraph(current,history.projectId),source=direction==='undo'?history.past:history.future;
 if(!source.length)return null;
 const graph=validateGraph(source.at(-1),history.projectId);
 return {graph,history:direction==='undo'?{...history,past:history.past.slice(0,-1),future:[...history.future,present].slice(-50),group:null}:{...history,past:[...history.past,present].slice(-50),future:history.future.slice(0,-1),group:null}};
}
export function matchesSavedGraph(graph:ProjectGraph,raw:string|null){
 if(raw===null)return false;
 try{return same(validateGraph(graph,graph.projectId),validateGraph(JSON.parse(raw),graph.projectId));}catch{return false;}
}
