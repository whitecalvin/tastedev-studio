'use client';
import {useI18n} from '@/i18n/react';
import type {Schedule,ScheduleRun} from './domain';
import {scheduleOperations,scheduleTime} from './operations';

export function ScheduleOperations({projectId,schedules,history,onChoose}:{projectId:string;schedules:Schedule[];history:ScheduleRun[];onChoose:(id:string)=>void}) {
 const {t,locale}=useI18n(),rows=scheduleOperations(projectId,schedules,history);
 return <section className="schedule-operations"><h2>{t('Schedules')}</h2><div className="schedule-operations-scroll"><table><thead><tr><th>{t('Name')}</th><th>{t('Status')}</th><th>{t('Next Run')}</th><th>{t('Timezone')}</th><th>{t('Schedule History')}</th></tr></thead><tbody>{rows.map(({schedule:s,latest,overlap,missed})=><tr key={s.id}><td><button className="ws-text-button" onClick={()=>onChoose(s.id)}>{s.name}</button></td><td>{t(s.status)}</td><td>{scheduleTime(s.nextRunAt,s.timezone,locale)??t('Manual, disabled or waiting for Protocol')}</td><td>{s.timezone}</td><td>{latest?t(latest.status):t('Never')} · {t('overlap')}: {overlap} · {t('missed')}: {missed}</td></tr>)}</tbody></table></div></section>;
}
