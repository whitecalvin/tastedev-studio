import test from 'node:test';
import assert from 'node:assert/strict';
import {currentSchedulerSnapshot,schedulerScopeKey,schedulerSessionAction,type SchedulerScope,type SchedulerSnapshot} from '../src/features/scheduler/session.ts';
import {ScheduleService} from '../src/features/scheduler/service.ts';
import {CoreService} from '../src/features/core/service.ts';
import {InMemoryCoreRepository} from '../src/features/core/repository.ts';
import {MemoryScheduleRepository} from '../src/features/scheduler/domain.ts';

const scope:SchedulerScope={projectId:'p',generation:1,connectionKey:'local',connected:true};
function snapshot():SchedulerSnapshot {return new ScheduleService(new CoreService(new InMemoryCoreRepository(),{get:async()=>null}),new MemoryScheduleRepository(),()=>undefined,()=>{throw Error('No execution allowed');}).list('p');}
test('Scheduler records belong to the exact connected project and session',()=>{
 const value=snapshot(),record={key:schedulerScopeKey(scope),snapshot:value};assert.equal(currentSchedulerSnapshot(record,scope),value);
 for(const changed of [{projectId:'other'},{generation:2},{connectionKey:'another'},{connected:false}])assert.equal(currentSchedulerSnapshot(record,{...scope,...changed}),null);
 assert.equal(currentSchedulerSnapshot(null,scope),null);
});
test('mixed-project schedules and trigger history cannot populate the current session',()=>{
 const value=snapshot(),record={key:schedulerScopeKey(scope),snapshot:value};
 value.schedules.push({id:'s',projectId:'other',name:'Foreign',enabled:false,testName:'test',trigger:{type:'manual'},timezone:'UTC',createdAt:'now',updatedAt:'now',lastTriggeredAt:null,nextRunAt:null,status:'disabled'});
 assert.equal(currentSchedulerSnapshot(record,scope),null);value.schedules=[];
 value.history.push({id:'h',scheduleId:'s',projectId:'other',triggeredAt:'now',scheduledAt:'now',triggerType:'manual',status:'cancelled'});
 assert.equal(currentSchedulerSnapshot(record,scope),null);
});
test('fresh responses restore the new session without changing previous records',()=>{
 const value=snapshot(),before=JSON.stringify(value),next={...scope,generation:2};
 assert.equal(currentSchedulerSnapshot({key:schedulerScopeKey(scope),snapshot:value},next),null);
 assert.equal(currentSchedulerSnapshot({key:schedulerScopeKey(next),snapshot:value},next),value);
 assert.equal(JSON.stringify(value),before);
});

test('scope change during mutation prevents follow-up RPC on a new Core session',async()=>{
 let current=true;const calls:string[]=[];const result=await schedulerSessionAction(scope,()=>current,async(type)=>{calls.push(type);current=false;return snapshot();},'enable',['s',true]);
 assert.equal(result,null);assert.deepEqual(calls,['enable']);
});
test('late list responses and disconnected actions never populate the new session',async()=>{
 let current=true;const calls:string[]=[];const result=await schedulerSessionAction(scope,()=>current,async(type)=>{calls.push(type);if(type==='list')current=false;return snapshot();},'cancel',['h']);
 assert.equal(result,null);assert.deepEqual(calls,['cancel','list']);
 assert.equal(await schedulerSessionAction({...scope,connected:false},()=>true,async()=>{throw Error('Must not send');},'run',['s']),null);
});
test('current mutation returns a checked response and rejects foreign project history',async()=>{
 const value=snapshot(),calls:string[]=[];
 assert.equal(await schedulerSessionAction(scope,()=>true,async(type)=>{calls.push(type);return value;},'save',[]),value);assert.deepEqual(calls,['save','list']);
 value.history.push({id:'foreign',projectId:'other',scheduleId:'s',triggeredAt:'now',scheduledAt:'now',triggerType:'manual',status:'cancelled'});
 await assert.rejects(schedulerSessionAction(scope,()=>true,async()=>value,'save',[]),/project mismatch/);
});
