'use client';
import {useLayoutEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {ArrowDown,ArrowUp,Bot,ChevronsDown,ChevronsUp,Clock,Copy,Play,SlidersHorizontal,Trash2,type LucideIcon} from 'lucide-react';
import {useI18n} from '@/i18n/react';

const actionIcons:Record<string,LucideIcon>={
 'Node settings':SlidersHorizontal,
 'Duplicate node':Copy,
 'Bring to front':ChevronsUp,
 'Send to back':ChevronsDown,
 'Bring forward':ArrowUp,
 'Send backward':ArrowDown,
 'Open execution settings':Play,
 'Open Agents':Bot,
 'Open Scheduler':Clock,
 'Remove node':Trash2,
};
export interface NodeMenuAction {label:string;disabled?:boolean;run:()=>void;danger?:boolean}
export function NodeContextMenu({x,y,label,actions,onClose}:{x:number;y:number;label:string;actions:NodeMenuAction[];onClose:()=>void}){
 const {t}=useI18n(),menu=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const element=menu.current!;
  const bounds=element.getBoundingClientRect();
  element.style.left=`${Math.max(8,Math.min(x,window.innerWidth-bounds.width-8))}px`;
  element.style.top=`${Math.max(8,Math.min(y,window.innerHeight-bounds.height-8))}px`;
  element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  const outside=(event:PointerEvent)=>{if(!element.contains(event.target as Node))onClose();};
  const dismiss=()=>onClose();
  window.addEventListener('pointerdown',outside,true);
  window.addEventListener('resize',dismiss);
  window.addEventListener('scroll',dismiss,true);
  return()=>{window.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',dismiss);window.removeEventListener('scroll',dismiss,true);};
 },[x,y,onClose]);
 return createPortal(<div ref={menu} role="menu" aria-label={`${t('Node settings')}: ${t(label)}`} className="orch-context-menu" style={{left:x,top:y}} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{
  const items=Array.from(menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const index=items.indexOf(document.activeElement as HTMLButtonElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
  if(e.key==='Escape'||e.key==='Tab'){e.preventDefault();onClose();}
 }}><div className="orch-context-title">{t(label)}</div>{actions.map(action=>{const Icon=actionIcons[action.label]??SlidersHorizontal;return <button key={action.label} type="button" role="menuitem" disabled={action.disabled} className={action.danger?'danger':undefined} onClick={()=>{onClose();action.run();}}><Icon size={16} aria-hidden="true"/><span>{t(action.label)}</span></button>;})}</div>,document.body);
}
