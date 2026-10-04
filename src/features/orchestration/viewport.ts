export interface CanvasBounds {x:number;y:number;width:number;height:number}
/** Fit the visible content without mutating graph coordinates or saved settings. */
export function fitViewport(bounds:CanvasBounds,width:number,height:number){
 if(![bounds.x,bounds.y,bounds.width,bounds.height,width,height].every(Number.isFinite)||bounds.width<=0||bounds.height<=0||width<=0||height<=0)return null;
 const padding=24,zoom=Math.min(1,Math.max(.05,Math.min(Math.max(1,width-padding*2)/bounds.width,Math.max(1,height-padding*2)/bounds.height)));
 return {zoom,left:Math.max(0,(bounds.x+bounds.width/2)*zoom-width/2),top:Math.max(0,(bounds.y+bounds.height/2)*zoom-height/2)};
}
