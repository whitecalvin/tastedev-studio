import {CronExpressionParser} from 'cron-parser';
import {SchedulerError,type Trigger} from './domain.ts';
const iso=(n:number)=>new Date(n).toISOString();
export function nextExecution(trigger:Trigger,timezone:string,after:number):string|null {
 try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format(after);}catch{throw new SchedulerError('invalid-timezone')}
 if(trigger.type==='manual'||trigger.type==='event')return null;
 if(trigger.type==='interval'){if(!Number.isInteger(trigger.seconds)||trigger.seconds<60||trigger.seconds>31536000)throw new SchedulerError('invalid-trigger');return iso(after+trigger.seconds*1000);}
 if(trigger.type==='time'){if(typeof trigger.at!=='string'||!/^\d{4}-\d\d-\d\dT/.test(trigger.at)||!/(Z|[+-]\d\d:\d\d)$/.test(trigger.at)||!Number.isFinite(Date.parse(trigger.at)))throw new SchedulerError('invalid-trigger');return Date.parse(trigger.at)>after?iso(Date.parse(trigger.at)):null;}
 if(trigger.type==='cron'){try{if(typeof trigger.expression!=='string'||trigger.expression.length>120||trigger.expression.trim().split(/\s+/).length!==5)throw Error();return CronExpressionParser.parse(trigger.expression,{tz:timezone,currentDate:after}).next().toDate().toISOString();}catch{throw new SchedulerError('invalid-cron')}}
 throw new SchedulerError('invalid-trigger');
}
