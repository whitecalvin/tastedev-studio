'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {canvasViewKey,readCanvasView,saveCanvasView,type CanvasView} from './canvas-view';
/** Presentation-only persistence. Hidden canvases cannot overwrite the saved view. */
export function useCanvasView(projectId:string,enabled:boolean){
 const scroll=useRef<HTMLDivElement>(null),baseline=useRef<string|null>(null),pending=useRef<CanvasView|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const pendingWrite=useRef<{projectId:string;view:CanvasView;baseline:string|null}|null>(null);
 const [state,setState]=useState({projectId:'',view:{zoom:1,left:0,top:0},error:''});
 const current=useRef(state);
 useLayoutEffect(()=>{current.current=state;},[state]);
 useEffect(()=>{let live=true;queueMicrotask(()=>{if(!live)return;try{const raw=localStorage.getItem(canvasViewKey(projectId)),view=readCanvasView(raw,projectId);baseline.current=raw;pending.current=view;setState({projectId,view,error:''});}catch{pending.current={zoom:1,left:0,top:0};setState({projectId,view:{zoom:1,left:0,top:0},error:'Saved canvas view could not be restored. Stored data is unchanged.'});}});return()=>{live=false;if(timer.current)clearTimeout(timer.current);timer.current=null;const write=pendingWrite.current;pendingWrite.current=null;if(write?.projectId===projectId){try{saveCanvasView(localStorage,write.projectId,write.view,write.baseline);}catch{/* Preserve the existing record when storage or concurrency checks fail. */}}};},[projectId]);
 function persist(view:CanvasView){
  if(current.current.projectId!==projectId||current.current.error)return;
  try{baseline.current=saveCanvasView(localStorage,projectId,view,baseline.current);}catch{setState(previous=>({...previous,error:'Canvas view could not be saved. Stored data is unchanged.'}));}
 }
 function remember(){
  const element=scroll.current;
  if(!enabled||pending.current||current.current.projectId!==projectId||!element?.clientWidth||!element.clientHeight)return;
  const view={zoom:current.current.view.zoom,left:element.scrollLeft,top:element.scrollTop};
  // Write once after a scroll burst, including the final position.
  if(timer.current)clearTimeout(timer.current);
  pendingWrite.current=current.current.error?null:{projectId,view,baseline:baseline.current};
  timer.current=setTimeout(()=>{timer.current=null;pendingWrite.current=null;persist(view);},150);
 }
 useLayoutEffect(()=>{
  const element=scroll.current;if(!element||!enabled||state.projectId!==projectId)return;
  const apply=()=>{if(!element.clientWidth||!element.clientHeight||!pending.current)return;const view=pending.current;pending.current=null;element.scrollTo({left:view.left,top:view.top,behavior:'instant'});remember();};
  apply();const observer=new ResizeObserver(apply);observer.observe(element);return()=>observer.disconnect();
 // The observer always captures this project's rendered view, not another project.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[projectId,enabled,state]);
 function move(view:CanvasView){if(current.current.projectId!==projectId)return;if(timer.current)clearTimeout(timer.current);timer.current=null;pendingWrite.current=null;pending.current=view;setState(previous=>({...previous,view}));}
 const zoom=state.projectId===projectId?state.view.zoom:1;
 return {scroll,zoom,move,remember,error:state.projectId===projectId?state.error:'',setZoom:(value:number)=>move({zoom:value,left:scroll.current?.scrollLeft??0,top:scroll.current?.scrollTop??0})};
}
