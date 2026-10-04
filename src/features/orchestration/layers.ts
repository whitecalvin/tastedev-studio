export const layerActions=['front','back','forward','backward'] as const;
export type LayerAction=typeof layerActions[number];
export const layerKey=(projectId:string)=>`tastestudio.graph.layers.v1:${encodeURIComponent(projectId)}`;
// 표시 순서는 실행 그래프/체크섬과 분리한다. 처음부터 끝까지 아래→위 순서다.
export function nodeLayers(order:readonly string[],ids:readonly string[]):string[]{
 const valid=new Set(ids),seen=new Set<string>();
 return [...order,...ids].filter(id=>{if(!valid.has(id)||seen.has(id))return false;seen.add(id);return true;});
}
export function moveLayer(order:readonly string[],id:string,action:LayerAction):string[]{
 const index=order.indexOf(id);if(index<0)return [...order];
 const next=[...order],target=action==='front'?order.length-1:action==='back'?0:action==='forward'?Math.min(order.length-1,index+1):Math.max(0,index-1);
 next.splice(index,1);next.splice(target,0,id);return next;
}
export function nodeLayer(order:readonly string[],id:string,dragging:string|null):number{
 return id===dragging?order.length+1:order.indexOf(id)+1;
}
export function readLayers(raw:string|null,projectId:string):string[]{
 if(raw===null)return [];if(raw.length>10000)throw Error('Node layer order could not be loaded.');
 const value=JSON.parse(raw);
 if(!value||value.version!==1||value.projectId!==projectId||!Array.isArray(value.order)||value.order.length>60||value.order.some((id:unknown)=>typeof id!=='string'||!id||id.length>120)||new Set(value.order).size!==value.order.length)throw Error('Node layer order could not be loaded.');
 return [...value.order];
}
export function saveLayers(storage:{getItem(key:string):string|null;setItem(key:string,value:string):void},projectId:string,order:string[],expected:string|null){
 const key=layerKey(projectId),raw=JSON.stringify({version:1,projectId,order});readLayers(raw,projectId);
 if(storage.getItem(key)!==expected)throw Error('Node layer order changed in another window.');
 storage.setItem(key,raw);return raw;
}
