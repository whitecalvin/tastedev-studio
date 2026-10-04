'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,ChevronsDown,ChevronsUp} from 'lucide-react';
import {useI18n} from '@/i18n/react';
import {layerActions,layerKey,nodeLayers,moveLayer,readLayers,saveLayers,type LayerAction} from './layers';

export function useNodeLayers(projectId:string,ids:string[]){
 const [state,setState]=useState<{projectId:string;order:string[];ready:boolean;error:string}>({projectId,order:[],ready:false,error:''});
 const baseline=useRef<string|null>(null);
 useEffect(()=>{let live=true;queueMicrotask(()=>{if(!live)return;try{const raw=localStorage.getItem(layerKey(projectId));baseline.current=raw;setState({projectId,order:readLayers(raw,projectId),ready:true,error:''});}catch{setState({projectId,order:[],ready:false,error:'Node layer order could not be loaded.'});}});return()=>{live=false;};},[projectId]);
 const order=nodeLayers(state.projectId===projectId?state.order:[],ids),ready=state.projectId===projectId&&state.ready;
 function move(id:string,action:LayerAction){
  if(!ready)return;const next=moveLayer(order,id,action);
  try{baseline.current=saveLayers(localStorage,projectId,next,baseline.current);setState({projectId,order:next,ready:true,error:''});}
  catch(e){setState(previous=>({...previous,error:e instanceof Error?e.message:'Node layer order could not be saved.'}));}
 }
 return {order,ready,error:state.projectId===projectId?state.error:'',move};
}
export function LayerControls({id,layers,disabled}:{id:string;layers:ReturnType<typeof useNodeLayers>;disabled:boolean}){
 const {t}=useI18n(),index=layers.order.indexOf(id);
 return <section aria-label={t('Node stacking order')}><h3>{t('Node stacking order')}</h3><div className="orch-layer-actions" role="group" aria-label={t('Node stacking order')}>
 {layerActions.map(action=>{const label=t({front:'Bring to front',back:'Send to back',forward:'Bring forward',backward:'Send backward'}[action]),Icon={front:ChevronsUp,back:ChevronsDown,forward:ArrowUp,backward:ArrowDown}[action];return <button key={action} type="button" title={label} aria-label={label} disabled={disabled||!layers.ready||index<0||(action==='front'||action==='forward'?index===layers.order.length-1:index===0)} onClick={()=>layers.move(id,action)}><Icon size={16} aria-hidden="true"/></button>;})}
 </div>{layers.error&&<p role="status">{t(layers.error)}</p>}</section>;
}
