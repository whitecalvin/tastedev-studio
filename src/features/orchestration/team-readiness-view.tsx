'use client';
import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,AlertTriangle,CircleX,RefreshCw,ArrowUpRight} from 'lucide-react';
import {useI18n} from '@/i18n/react';
import {remoteCore} from '../core/remote-client';
import type {TeamReadinessReport} from './team-readiness';
export function TeamReadinessPanel({project,intentId,revision,onChoose}:{project:string;intentId:string;revision:number;onChoose:(node:string)=>void}){
  const {t}=useI18n(),key=JSON.stringify([project,intentId,revision,remoteCore.generation]),latest=useRef(key),flight=useRef(false);
  const [result,setResult]=useState<{key:string;value:TeamReadinessReport}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{latest.current=key;return()=>{latest.current='';};},[key]);
  async function inspect(){if(flight.current)return;flight.current=true;setBusy(true);setError('');try{const value=await remoteCore.teamReadinessRequest<TeamReadinessReport>(intentId);if(latest.current===key)setResult({key,value});}catch{if(latest.current===key)setError('Team readiness inspection failed.');}finally{flight.current=false;setBusy(false);}}
  const report=result?.key===key?result.value:null;
  const categories={intent:'Work intent',assignment:'Assignment',source:'Source',agent:'Agent',ai:'AI',permission:'Permissions',storage:'Storage',execution:'Execution'};
  return <section aria-label={t('Execution preflight')} className="orch-team-preflight"><div className="orch-team-actions"><h3>{t('Execution preflight')}</h3><button className="fs-button" disabled={busy} onClick={()=>void inspect()}><RefreshCw size={14} aria-hidden="true"/>{t(busy?'Checking…':'Check execution readiness')}</button></div><p>{t('Checks the published graph, assigned Agent, Source and AI authentication. No model, task or patch is executed.')}</p>{error&&<p role="alert">{t(error)}</p>}{report&&<><p role="status">{t(report.ready?'Ready for reviewed execution':'Execution blocked')} · {t('Graph revision')} {report.graphRevision??'—'} · <time dateTime={report.checkedAt}>{new Date(report.checkedAt).toLocaleTimeString()}</time></p><ul>{report.checks.map(check=>{const Icon=check.status==='passed'?CheckCircle2:check.status==='blocked'?CircleX:AlertTriangle;return <li key={check.id} className="orch-team-check" data-status={check.status}><Icon size={15} aria-hidden="true"/><span><strong>{t(categories[check.category])}</strong> · {t(check.message)}</span>{check.nodeId&&<button className="ws-text-button" aria-label={t('Open assigned node')} onClick={()=>onChoose(check.nodeId!)}><ArrowUpRight size={14} aria-hidden="true"/>{t('Open assigned node')}</button>}</li>;})}</ul><small>{t('Connection inspection does not send source, logs or prompts, and does not run a model. Model availability and quota remain unverified.')}</small></>}</section>;
}
