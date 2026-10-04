export interface CanvasView {zoom:number;left:number;top:number}
export const canvasViewKey=(projectId:string)=>`tastestudio.graph.view.v1:${encodeURIComponent(projectId)}`;
export function readCanvasView(raw:string|null,projectId:string):CanvasView{
 if(raw===null)return {zoom:1,left:0,top:0};
 if(raw.length>1024)throw Error('Saved canvas view is invalid. Stored data is unchanged.');
 const value=JSON.parse(raw);
 if(value?.version!==1||value.projectId!==projectId||!Number.isFinite(value.zoom)||value.zoom<.05||value.zoom>1.25||![value.left,value.top].every(n=>Number.isFinite(n)&&n>=0&&n<=10000))throw Error('Saved canvas view is invalid. Stored data is unchanged.');
 return {zoom:value.zoom,left:value.left,top:value.top};
}
export function saveCanvasView(storage:Pick<Storage,'getItem'|'setItem'>,projectId:string,view:CanvasView,baseline:string|null){
 const raw=JSON.stringify({version:1,projectId,...view});readCanvasView(raw,projectId);
 const key=canvasViewKey(projectId);
 if(storage.getItem(key)!==baseline)throw Error('Canvas view changed in another window. Reload before saving it.');
 if(raw!==baseline)storage.setItem(key,raw);
 return raw;
}
