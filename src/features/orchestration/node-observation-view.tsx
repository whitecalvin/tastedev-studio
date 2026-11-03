'use client';
import {Activity,ArrowUpRight,CalendarClock,Cpu} from 'lucide-react';
import {useI18n} from '@/i18n/react';
import {useCore} from '../core/context';
import {useScheduler} from '../scheduler/views';
import {useWorkspace} from '../workspace/context';
import type {ProjectGraph} from './domain';
import type {GraphOverview} from './execution';
import {nodeObservation} from './node-observation';

export function GraphNodeObservation({graph,overview,nodeId,executionId,connected,dirty}:{graph:ProjectGraph;overview:GraphOverview|null;nodeId:string;executionId:string;connected:boolean;dirty:boolean}){
 const {t}=useI18n(),core=useCore(),scheduler=useScheduler(),{dispatch}=useWorkspace();
 const observed=nodeObservation({graph,overview,nodeId,executionId,connected,dirty,snapshot:core.snapshot,schedules:scheduler.snapshot?.schedules??null,scheduleHistory:scheduler.snapshot?.history});
 if(!observed)return null;
 function openRun(id:string){core.select({kind:'run',id});dispatch({type:'activity',value:'runs'});}
 return <section className="orch-node-observation" aria-label={t('Node runtime')} data-observation={observed.availability}>
  <h3><Activity size={15} aria-hidden="true"/>{t('Node runtime')}</h3>
  {observed.availability!=='reported'?<><p role="status">{t(observed.message)}</p>{observed.availability==='disconnected'&&<button className="fs-button" onClick={()=>dispatch({type:'activity',value:'agents'})}>{t('Core connection')}</button>}</>:<>
   {!!observed.agents.length&&<ul className="orch-observed-agents">{observed.agents.map(agent=><li key={agent.id}><Cpu size={14} aria-hidden="true"/><button className="ws-text-button" onClick={()=>{core.select({kind:'agent',id:agent.id});dispatch({type:'activity',value:'agents'});}}>{agent.name}</button><span>{t(agent.status)}</span><small>{agent.platform} · {agent.id}</small></li>)}</ul>}
   {!observed.work.length&&!observed.schedule&&<p>{t(observed.message)}</p>}
   {observed.execution&&<details><summary>{t('Captured execution identity')}</summary><dl><dt>{t('Execution ID')}</dt><dd>{observed.execution.id}</dd><dt>{t('Captured configuration version')}</dt><dd>{observed.execution.revision}</dd>{observed.execution.snapshotId&&<><dt>Snapshot ID</dt><dd>{observed.execution.snapshotId}</dd><dt>{t('Snapshot manifest checksum')}</dt><dd>{observed.execution.sourceChecksum}</dd></>}</dl></details>}
   <ul className="orch-observed-work">{observed.work.map(work=><li key={work.nodeId} data-conflict={work.identityConflict||undefined}><header><strong>{work.label}</strong><span>{t(work.status==='approval'?'Approval waiting':work.status)}</span></header>
    {!!work.attempt&&<small>{t('Attempt')} {work.attempt}{work.agentId?` · Agent: ${work.agentId}`:''}</small>}
    {work.step&&<p>{t('Current step')}: {work.step.name} · {t(work.step.status)}</p>}
    {work.ai&&<p>AI · {work.ai.adapter} · {work.ai.model}<br/><code>{work.ai.connectionId}</code></p>}
    {work.reasons.map(reason=><p key={reason} role={work.identityConflict?'alert':undefined}>{t(reason)}</p>)}
    {work.status==='Not reported'&&!work.reasons.length&&<p>{t('No run has been reported for this node.')}</p>}
    {work.next==='approval'&&<p>{t('Review execution scope')}</p>}
    {work.next==='wait'&&<p>{t('Execution waiting reason')}: {t(work.status)}</p>}
    {work.next==='ai'&&<button className="fs-button" onClick={()=>dispatch({type:'activity',value:'ai'})}>{t('AI')}</button>}
    {work.runId&&<button className="fs-button" onClick={()=>openRun(work.runId!)}><ArrowUpRight size={14} aria-hidden="true"/>{t('Open Run')}</button>}
    {!!work.history.length&&<details><summary>{t('Attempt History')} · {work.history.length}</summary>{work.history.map(attempt=><p key={attempt.id}>{t('Attempt')} {attempt.attempt} · {t(attempt.status)}<br/><code>{attempt.runId??attempt.id}</code></p>)}</details>}
    {work.source&&<details><summary>{t('Execution Source')}</summary><dl><dt>Snapshot ID</dt><dd>{work.source.snapshotId}</dd><dt>{t('Snapshot manifest checksum')}</dt><dd>{work.source.checksum}</dd></dl></details>}
   </li>)}</ul>
   {observed.kind==='schedule'&&<div className="orch-observed-schedule"><p><CalendarClock size={14} aria-hidden="true"/>{t(observed.schedule?.status??'Not reported')}</p>{observed.schedule?.nextRunAt&&<p>{t('Next Run')}: <time dateTime={observed.schedule.nextRunAt}>{observed.schedule.nextRunAt}</time></p>}{observed.schedule?.history&&<p>{t('Execution History')}: {t(observed.schedule.history.status)}<br/><code>{observed.schedule.history.graphExecutionId??observed.schedule.history.id}</code></p>}<button className="fs-button" onClick={()=>{if(observed.schedule)scheduler.setSelected(observed.schedule.id);dispatch({type:'activity',value:'scheduler'});}}>{t('Scheduler')}</button></div>}
  </>}
 </section>;
}
