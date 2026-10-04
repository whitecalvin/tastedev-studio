'use client';
import {useState} from 'react';
import {Search,Monitor,Bot,Briefcase,Play,ShieldCheck,Clock} from 'lucide-react';
import {Dialog} from '@/components/ui/dialog';
import {useI18n} from '@/i18n/react';
import type {GraphNode} from './domain';
import {findNodes} from './node-search';
const icons={device:Monitor,agent:Bot,role:Briefcase,task:Play,approval:ShieldCheck,schedule:Clock};
export function NodeSearchDialog({nodes,onClose,onChoose}:{nodes:GraphNode[];onClose:()=>void;onChoose:(id:string)=>void}){
 const {t}=useI18n(),[query,setQuery]=useState(''),results=findNodes(nodes,query,value=>t(value));
 return <Dialog title="Find node" onClose={onClose}><label className="orch-node-search-label">{t('Search node name, kind or reference')}<input type="search" value={query} maxLength={200} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&results.length===1){event.preventDefault();onChoose(results[0].id);}}}/></label><p className="dialog-description" role="status">{t('Matching nodes')}: {results.length}</p><ul className="orch-node-search-results">{results.map(node=>{const Icon=icons[node.kind];return <li key={node.id}><button type="button" onClick={()=>onChoose(node.id)}><Icon size={16} aria-hidden="true"/><span><strong>{t(node.label)}</strong><small>{t(node.kind)}{node.reference?` · ${node.reference}`:''}</small></span><Search size={14} aria-hidden="true"/></button></li>;})}</ul>{!results.length&&<p>{t('No matching nodes.')}</p>}</Dialog>;
}
