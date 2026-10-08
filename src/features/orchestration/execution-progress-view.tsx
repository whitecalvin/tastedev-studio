'use client';
import {Activity} from 'lucide-react';
import {useI18n} from '@/i18n/react';
import type {ProjectGraph} from './domain';
import type {GraphOverview} from './execution';
import {executionProgress} from './execution-progress';

export function ExecutionProgress({graph,overview,executionId,onChoose,onRun}:{graph:ProjectGraph;overview:GraphOverview|null;executionId:string;onChoose:(id:string)=>void;onRun:(id:string)=>void}) {
 const {t}=useI18n(),progress=executionProgress(graph,overview,executionId);
 if(!progress)return null;
 return <details className="orch-progress"><summary><Activity size={16} aria-hidden="true"/>{t('Execution monitoring')}<span>{t('passed')} {progress.passed}/{progress.total} · {t('running')} {progress.active} · {t('failed')} {progress.failed}</span></summary>
  <progress value={progress.passed} max={Math.max(1,progress.total)} aria-label={t('passed')}/>
  <ul>{progress.rows.map(({node,activation:a})=><li key={node.id}><button className="ws-text-button" onClick={()=>onChoose(node.id)}>{node.label}</button><span>{t(a?.status??'Not reported')}</span>{a&&<small>{t('Attempt')} {a.attempt}{a.agentId?` · Agent: ${a.agentId}`:''}</small>}{a?.waitingReasons?.map(reason=><p key={reason}>{t(reason)}</p>)}{a?.reason&&<p>{t(a.reason)}</p>}{a?.runId&&<button className="fs-button" onClick={()=>onRun(a.runId!)}>{t('Open Run')}</button>}</li>)}</ul>
 </details>;
}
