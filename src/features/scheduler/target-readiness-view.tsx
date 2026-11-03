'use client';
import {useEffect,useState} from 'react';
import {useI18n} from '@/i18n/react';
import {useCore} from '../core/context';
import type {GraphOverview} from '../orchestration/execution';
import type {Schedule} from './domain';
import {scheduleTargetReadiness} from './target-readiness';
export function ScheduleTargetReadiness({schedule}:{schedule:Schedule}){
 const core=useCore(),{t}=useI18n(),key=JSON.stringify([core.project.id,core.connection.generation,core.connection.connected,schedule.id,schedule.graph]),[saved,setSaved]=useState<{key:string;value:GraphOverview}|null>(null);
 useEffect(()=>{let active=true,pending=false;async function load(){if(!schedule.graph||!core.remote||!core.connection.connected||pending)return;pending=true;try{const value=await core.connection.graphRequest<GraphOverview>('list');if(active)setSaved({key,value});}catch{if(active)setSaved(null);}finally{pending=false;}}void load();const timer=setInterval(()=>void load(),3000);return()=>{active=false;clearInterval(timer);};},[key,core.remote,core.connection,schedule.graph]);
 const state=scheduleTargetReadiness(schedule,core.project.id,core.remote&&core.connection.connected,saved?.key===key?saved.value:null);
 if(state.status==='protocol')return null;
 const message=state.status==='matched'?'Scheduled graph identity matches.':state.status==='stale'?'Scheduled graph changed. Review and save a new target.':state.status==='overlap'?'An active graph prevents overlapping scheduled execution.':'Scheduled target is not verified.';
 return <section className="schedule-target-readiness" aria-label={t('Scheduled target review')}><h3>{t('Scheduled target review')}</h3><p role="status">{t(message)}</p><code>Graph v{schedule.graph?.revision} · {schedule.graph?.entryNodeId}</code><code>{schedule.graph?.checksum}</code>{'source'in state&&<><code>Source: {state.source??t('Unverified')}</code><code>{state.checksum}</code>{(state.active??[]).map(e=><p key={e.id}>{e.id} · {t(e.status)}</p>)}</>}<p>{t('This check does not authorize execution. Core rechecks the target and each approval at trigger time.')}</p></section>;
}
