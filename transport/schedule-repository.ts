import fs from 'node:fs';
import path from 'node:path';
import type {Schedule,ScheduleRepository} from '../src/features/scheduler/domain.ts';
import {validateSchedule} from '../src/features/scheduler/service.ts';
/** Definitions only: no YAML, environment, command, token, Run or artifact payload is persisted. */
export class FileScheduleRepository implements ScheduleRepository {
 readonly file:string;constructor(file:string){this.file=file;}
 load(){if(!fs.existsSync(this.file))return[];try{if(fs.statSync(this.file).size>200000)throw Error();const data=JSON.parse(fs.readFileSync(this.file,'utf8'));if(data.version!==1||!Array.isArray(data.schedules)||data.schedules.length>100)throw Error();return data.schedules.map((s:Schedule)=>{validateSchedule({name:s.name,testName:s.testName,enabled:false,timezone:s.timezone,trigger:s.trigger},Date.now());if(typeof s.id!=='string'||typeof s.projectId!=='string'||!/^[-a-zA-Z0-9]{1,120}$/.test(s.id)||!/^[-a-zA-Z0-9]{1,120}$/.test(s.projectId)||typeof s.enabled!=='boolean')throw Error();return s;});}catch{throw new Error('Scheduler definitions invalid; original file preserved.');}}
 save(schedules:Schedule[]){fs.mkdirSync(path.dirname(this.file),{recursive:true});const clean=schedules.map(({id,projectId,name,enabled,testName,trigger,timezone,createdAt,updatedAt,lastTriggeredAt})=>({id,projectId,name,enabled,testName,trigger,timezone,createdAt,updatedAt,lastTriggeredAt,nextRunAt:null,status:enabled?'awaiting-protocol':'disabled'}));const temp=this.file+'.tmp';try{fs.writeFileSync(temp,JSON.stringify({version:1,schedules:clean},null,2),{mode:0o600});fs.renameSync(temp,this.file);}catch(e){if(fs.existsSync(temp))fs.unlinkSync(temp);throw e;}}
}
