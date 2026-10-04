'use client';
import {CircleAlert,ChevronRight} from 'lucide-react';
import {useI18n} from '@/i18n/react';
import type {GraphNode} from './domain';
import type {ReadinessIssue} from './readiness';

export function GraphReadiness({issues,nodes,onChoose,disabled}:{issues:ReadinessIssue[];nodes:GraphNode[];onChoose:(id:string)=>void;disabled:boolean}){
 const {t}=useI18n();
 return <details className="orch-readiness"><summary><CircleAlert size={16} aria-hidden="true"/>{t('Graph setup checklist')}<span>{issues.length}</span></summary>
  <p>{t('These are setup checks. Core validates saved inputs, capabilities and permissions before execution.')}</p>
  {!issues.length?<p>{t('No setup issues found. Execution still requires Core validation and review.')}</p>:<ul>{issues.map((issue,index)=>{
   const node=nodes.find(candidate=>candidate.id===issue.nodeId);
   return <li key={`${issue.nodeId??'project'}:${index}`}><span><small>{t(issue.severity==='waiting'?'Waiting':'Configuration')}</small>{node&&<strong>{node.label}</strong>}{t(issue.message)}</span>{node&&<button type="button" title={t('Node settings')} aria-label={t('Review {label} settings',{label:node.label})} disabled={disabled} onClick={()=>onChoose(node.id)}><ChevronRight size={16} aria-hidden="true"/></button>}</li>;
  })}</ul>}
 </details>;
}
