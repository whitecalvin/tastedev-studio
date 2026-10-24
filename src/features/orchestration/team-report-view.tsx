'use client';
import {useEffect,useRef,useState} from 'react';
import {useI18n} from '@/i18n/react';
import {remoteCore} from '../core/remote-client';
import type {TeamCompletionReport} from './team-report';
export function TeamReportPanel({project,intentId,revision}:{project:string;intentId:string;revision:number}){
  const {t}=useI18n(),key=JSON.stringify([project,intentId,revision,remoteCore.generation]),epoch=useRef(0),lock=useRef(false);
  const [state,setState]=useState<{key:string;value:TeamCompletionReport}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const lifecycle=epoch;lifecycle.current++;return()=>{lifecycle.current++;};},[key]);
  async function load(){if(lock.current)return;lock.current=true;setBusy(true);setError('');const token=epoch.current;try{const value=await remoteCore.teamReportRequest<TeamCompletionReport>(intentId);if(token===epoch.current)setState({key,value});}catch{if(token===epoch.current)setError('Completion report unavailable.');}finally{lock.current=false;setBusy(false);}}
  const report=state?.key===key?state.value:null;
  function download(){if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='team-completion-'+intentId+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section aria-label={t('Completion report')}><h3>{t('Completion report')}</h3><p>{t('Completion requires accepted current contracts, independent review, all quality gates and the actual tested Snapshot. Packaging and deployment are separate.')}</p><div className="orch-team-actions"><button className="fs-button" disabled={busy} onClick={()=>void load()}>{t('Generate completion report')}</button><button className="fs-button" disabled={!report} onClick={download}>{t('Export report')}</button></div>{error&&<p role="alert">{t(error)}</p>}{report&&<><p role="status"><strong>{t(report.status==='verified'?'Implementation verified':'Completion blocked')}</strong> · v{report.intentVersion}</p><p>{t('Historical contracts')} {report.historicalTasks}</p><ul>{report.issues.map(i=><li key={i}>{t(i)}</li>)}</ul>{report.tasks.map(task=><article key={task.id}><strong>{task.id} · {t(task.status)}</strong><code>{task.executionId} · {task.sourceChecksum}</code><ul>{task.gates.map(g=><li key={g.category}>{t(g.category)} · {t(g.result)} · {t(g.kind==='run'?'Actual Run':'Manual review')}</li>)}</ul><code>{task.runIds.join(' · ')}</code></article>)}</>}</section>;
}
