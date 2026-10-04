import type {ScheduleService} from './service.ts';
export type SchedulerSnapshot=ReturnType<ScheduleService['list']>;
export interface SchedulerScope {projectId:string;generation:number;connectionKey:string;connected:boolean}
export const schedulerScopeKey=(scope:SchedulerScope)=>JSON.stringify([scope.projectId,scope.generation,scope.connectionKey,scope.connected]);
/** 새 연결/프로젝트가 이전 스케줄과 이력을 실행 대상으로 재사용하지 않도록 한다. */
export function currentSchedulerSnapshot(record:{key:string;snapshot:SchedulerSnapshot}|null,scope:SchedulerScope):SchedulerSnapshot|null {
 if(!scope.connected||record?.key!==schedulerScopeKey(scope))return null;
 if(record.snapshot.schedules.some(schedule=>schedule.projectId!==scope.projectId)||record.snapshot.history.some(history=>history.projectId!==scope.projectId))return null;
 return record.snapshot;
}
/** 변경 요청과 후속 조회 사이에 연결이 바뀌면 새 세션에 요청을 보내지 않는다. */
export async function schedulerSessionAction(scope:SchedulerScope,current:()=>boolean,request:(type:string,...args:unknown[])=>Promise<unknown>,type:string,args:unknown[]):Promise<SchedulerSnapshot|null>{
 if(!scope.connected||!current())return null;
 await request(type,...args);if(!current())return null;
 const snapshot=await request('list') as SchedulerSnapshot;if(!current())return null;
 if(!currentSchedulerSnapshot({key:schedulerScopeKey(scope),snapshot},scope))throw Error('Scheduler project mismatch.');
 return snapshot;
}
