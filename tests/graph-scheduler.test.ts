import test from 'node:test';
import assert from 'node:assert/strict';
import {CoreService} from '../src/features/core/service.ts';
import {InMemoryCoreRepository} from '../src/features/core/repository.ts';
import {ScheduleService,validateSchedule} from '../src/features/scheduler/service.ts';
import {MemoryScheduleRepository} from '../src/features/scheduler/domain.ts';
import type {Project} from '../src/features/projects/types/project.ts';
const target={revision:1,checksum:'a'.repeat(64),entryNodeId:'root'};
function fixture(){const core=new CoreService(new InMemoryCoreRepository(),{get:async id=>({id,name:'Graph'} as Project)});let clock=Date.now(),active=false,valid=true,status:'running'|'passed'|'failed'|'cancelled'='running',launches=0,permitted=true;
 const service=new ScheduleService(core,new MemoryScheduleRepository(),id=>({id,name:'Graph'} as Project),()=>{throw Error('Graph must not use ordinary Test dispatch');},()=>clock,undefined,()=>{if(!permitted)throw Error('Forbidden');return'user';});
 service.setGraphAdapter({validate:()=>{if(!valid)throw Error('Stale graph');},active:()=>active,launch:async(_p,_t,id)=>{launches++;active=true;return id;},status:()=>status});
 const save=()=>service.save('p',{name:'Reviewed graph',testName:'graph-label',enabled:true,graph:target,trigger:{type:'interval',seconds:60},timezone:'UTC'}).schedules[0];
 return{service,core,save,launches:()=>launches,advance:()=>{clock+=60000;},finish:()=>{status='passed';active=false;},invalidate:()=>{valid=false;},deny:()=>{permitted=false;}};
}
test('Existing Scheduler launches a reviewed graph, keeps trigger identity and tracks Graph completion',async()=>{const f=fixture();f.save();f.advance();await f.service.tick();const h=f.service.list('p').history[0];assert(h.graphExecutionId);assert.equal(f.core.snapshot('p').jobs.length,0);assert.equal(h.status,'running');assert.equal(f.launches(),1);await f.service.tick();assert.equal(f.launches(),1);f.finish();f.service.refresh();assert.equal(f.service.list('p').history[0].status,'passed');});
test('Active graph skips overlap; a new publication invalidates the schedule instead of executing its latest revision',async()=>{const f=fixture(),s=f.save();await f.service.runNow('p',s.id,'one');const overlap=await f.service.runNow('p',s.id,'two');assert.equal(overlap.reason,'overlap');f.finish();f.invalidate();const stale=await f.service.runNow('p',s.id,'three');assert.equal(stale.reason,'invalid-protocol');assert.equal(f.launches(),1);assert.throws(()=>f.service.enable('p',s.id,true));});
test('Schedule launch requires current authority and graph targets are strictly structured',async()=>{const f=fixture(),s=f.save();f.deny();const result=await f.service.runNow('p',s.id,'blocked');assert.equal(result.status,'error');assert.equal(f.launches(),0);const base={name:'n',testName:'graph',enabled:true,trigger:{type:'manual'},timezone:'UTC'};for(const graph of [{...target,revision:0},{...target,checksum:'bad'},{...target,command:'shell'},null])assert.throws(()=>validateSchedule({...base,graph},Date.now()));});
