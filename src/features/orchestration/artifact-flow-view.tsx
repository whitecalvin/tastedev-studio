'use client';
import {useI18n} from '@/i18n/react';
import type {GraphOverview} from './execution';
import {useCore} from '../core/context';
import {executionArtifactFlow} from './artifact-flow';
export function ExecutionArtifactFlow({execution,onRun}:{execution:GraphOverview['executions'][number];onRun:(id:string)=>void}){const {t}=useI18n(),core=useCore(),rows=executionArtifactFlow(execution,core.snapshot);if(!rows.length)return null;return <details className="orch-artifact-plans"><summary>{t('Build artifact flow')} · {rows.length}</summary><p>{t('Historical receipts show transferred identity. Availability and test results are checked separately.')}</p><ul>{rows.map((r,i)=><li key={r.artifact.id+':'+i}><strong>{r.artifact.name}</strong> · {t(r.status)}<p>{r.producerAgent??t('Not reported')} → {r.consumerAgent??t('Not reported')}</p><code>{r.artifact.checksum}</code>{r.target&&<code>{r.target}</code>}<button className="ws-text-button" onClick={()=>onRun(r.artifact.producerRunId)}>{t('Producer Run')}</button>{r.consumerRun&&<button className="ws-text-button" onClick={()=>onRun(r.consumerRun!)}>{t('Consumer Run')}</button>}</li>)}</ul></details>;}
