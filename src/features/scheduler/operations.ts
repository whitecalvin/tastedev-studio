import type {Schedule,ScheduleRun} from './domain.ts';
export function scheduleOperations(projectId:string,schedules:Schedule[],history:ScheduleRun[]) {
 return schedules.filter(s=>s.projectId===projectId).map(schedule=>{
  const events=history.filter(h=>h.projectId===projectId&&h.scheduleId===schedule.id);
  return {schedule,latest:events.at(-1),overlap:events.filter(h=>h.status==='skipped'&&h.reason==='overlap').length,missed:events.filter(h=>h.status==='skipped'&&h.reason==='missed').length};
 }).sort((a,b)=>(a.schedule.nextRunAt??'~').localeCompare(b.schedule.nextRunAt??'~'));
}
export function scheduleTime(value:string|null,timezone:string,locale:string) {
 if(!value)return null;
 try{return new Intl.DateTimeFormat(locale,{timeZone:timezone,dateStyle:'medium',timeStyle:'medium'}).format(new Date(value));}catch{return value;}
}
