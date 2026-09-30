import {CoreError} from '../core/domain.ts';
export type Trigger={type:'manual'}|{type:'cron';expression:string}|{type:'interval';seconds:number}|{type:'time';at:string}|{type:'event';adapter:'git'|'external'|'dependency'|'os';key:string};
export type ScheduleStatus='enabled'|'disabled'|'awaiting-protocol'|'invalid';
export interface Schedule {id:string;projectId:string;name:string;enabled:boolean;testName:string;trigger:Trigger;timezone:string;createdAt:string;updatedAt:string;lastTriggeredAt:string|null;nextRunAt:string|null;status:ScheduleStatus;error?:SchedulerErrorCode}
export interface TriggerEvent {id:string;scheduleId:string;scheduledAt:string;type:Trigger['type']|'run-now'}
export interface ScheduleRun {id:string;scheduleId:string;projectId:string;triggeredAt:string;scheduledAt:string;triggerType:TriggerEvent['type'];status:'queued'|'running'|'passed'|'failed'|'cancelled'|'timeout'|'skipped'|'error';jobId?:string;runId?:string;agentId?:string;durationMs?:number;reason?:SchedulerErrorCode|'overlap'|'capacity'|'missed'}
export interface ScheduleNotification {type:'schedule.triggered'|'schedule.failed'|'schedule.completed';scheduleId:string;historyId:string;timestamp:string}
export interface ScheduleInput {name:string;enabled:boolean;testName:string;trigger:Trigger;timezone:string}
export type SchedulerErrorCode='invalid-cron'|'invalid-timezone'|'invalid-trigger'|'invalid-input'|'missing-project'|'missing-test'|'invalid-protocol'|'disabled'|'duplicate'|'queue-failure'|'persistence'|'runtime-unavailable'|'boundary';
export class SchedulerError extends CoreError {readonly code:SchedulerErrorCode;constructor(code:SchedulerErrorCode){super(`Scheduler: ${code}.`);this.code=code;}}
export interface ScheduleRepository {load():Schedule[];save(schedules:Schedule[]):void}
export class MemoryScheduleRepository implements ScheduleRepository {private state:Schedule[]=[];load(){return structuredClone(this.state)}save(s:Schedule[]){this.state=structuredClone(s)}}
