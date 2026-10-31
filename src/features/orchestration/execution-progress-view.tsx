'use client';
import {ExecutionArtifactFlow} from './artifact-flow-view';
import {graphMonitor} from './monitor';
import {Activity} from 'lucide-react';
import {useI18n} from '@/i18n/react';
import type {ProjectGraph} from './domain';
import type {GraphOverview} from './execution';
import {useCore} from '../core/context';
import {useState} from 'react';
import {CustomSelect} from '@/components/ui/custom-select';
import {executionProgress} from './execution-progress';

export function ExecutionProgress({graph,overview,executionId,onChoose,onRun}:{graph:ProjectGraph;overview:GraphOverview|null;executionId:string;onChoose:(id:string)=>void;onRun:(id:string)=>void}) {
 const {t}=useI18n(),core=useCore(),[filter,setFilter]=useState('all'),progress=executionProgress(graph,overview,executionId,core.snapshot);
 if(!progress)return null;
 return <details className="orch-progress"><summary><Activity size={16} aria-hidden="true"/>{t('Execution monitoring')}<span>{t('passed')} {progress.passed}/{progress.total} · {t('running')} {progress.active} · {t('failed')} {progress.failed}</span></summary>
  <p>{t('Approval waiting')} {progress.approvals} · {t('Execution waiting reason')} {progress.waiting}</p><label>{t('Filter')}<CustomSelect value={filter} onChange={e=>setFilter(e.target.value)}>{['all','attention','active'].map(v=><option key={v} value={v}>{t(v)}</option>)}</CustomSelect></label><progress value={progress.passed} max={Math.max(1,progress.total)} aria-label={t('passed')}/>
  <ul>{progress.rows.filter(r=>filter==='all'||filter==='attention'&&r.activation&&['failed','approval','ai-fix-review','ai-review','queued','ready'].includes(r.activation.status)||filter==='active'&&r.activation&&['running','ai-running','launching'].includes(r.activation.status)).map(({node,activation:a,currentStep,reassignments,attempts})=><li key={node.id}><button className="ws-text-button" onClick={()=>onChoose(node.id)}>{node.label}</button><span>{t(a?.status??'Not reported')}</span>{a&&<small>{t('Attempt')} {a.attempt}{a.agentId?` · Agent: ${a.agentId}`:''}</small>}{currentStep&&<p>{t('Current step')}: {currentStep}</p>}{!!reassignments.length&&<p>{t('Assignment history')}: {reassignments.length}</p>}<details><summary>{t('Attempt History')}</summary>{attempts.map(previous=><p key={previous.id}>{previous.attempt} · {t(previous.status)} · {previous.runId??'—'}</p>)}</details>{a?.waitingReasons?.map(reason=><p key={reason}>{t(reason)}</p>)}{a?.reason&&<p>{t(a.reason)}</p>}{a?.runId&&<button className="fs-button" onClick={()=>onRun(a.runId!)}>{t('Open Run')}</button>}</li>)}</ul>
 <ExecutionArtifactFlow execution={graphMonitor(graph,overview,executionId).execution!} onRun={onRun}/></details>;
}
