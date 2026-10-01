import test from 'node:test';
import assert from 'node:assert/strict';
import {CoreService} from '../src/features/core/service.ts';
import {InMemoryCoreRepository} from '../src/features/core/repository.ts';
import {ScheduleService} from '../src/features/scheduler/service.ts';
import {SchedulerError,MemoryScheduleRepository} from '../src/features/scheduler/domain.ts';
import type {Project} from '../src/features/projects/types/project.ts';
const project={id:'team-scheduler',name:'Controlled'} as Project;
const sources={'project.yml':JSON.stringify({version:1,project:{name:'controlled',type:'node'}}),'tasks.yml':JSON.stringify({assertion:{command:'node',args:['-v']}}),'tests.yml':JSON.stringify({smoke:{task:'assertion',type:'unit'}})};
function fixture(){let allowed=true,now=Date.parse('2026-10-01T00:00:00Z'),dispatches=0;const core=new CoreService(new InMemoryCoreRepository(),{get:async()=>project});const service=new ScheduleService(core,new MemoryScheduleRepository(),()=>project,()=>{dispatches++},()=>now,undefined,()=>{if(!allowed)throw new SchedulerError('disabled');return 'alice';});service.register(project.id,sources);return{core,service,revoke:()=>{allowed=false;},advance:()=>{now+=60000;},dispatches:()=>dispatches};}
test('revoked scheduled authority cancels queued work without dispatching it',async()=>{const f=fixture();const schedule=f.service.save(project.id,{name:'Controlled',testName:'smoke',enabled:true,timezone:'UTC',trigger:{type:'manual'}}).schedules[0];await f.service.runNow(project.id,schedule.id,'approved');assert.equal(f.core.queue()[0].createdBy,'alice');assert.equal(f.dispatches(),1);f.revoke();await f.service.tick();assert.equal(f.dispatches(),1);assert.equal(f.core.snapshot(project.id).jobs[0].status,'cancelled');assert.equal(f.service.list(project.id).history[0].reason,'disabled');});
test('revoked automatic authority disables due schedule before creating a Job',async()=>{const f=fixture();f.service.save(project.id,{name:'Controlled',testName:'smoke',enabled:true,timezone:'UTC',trigger:{type:'interval',seconds:60}});f.revoke();f.advance();await f.service.tick();assert.equal(f.core.snapshot(project.id).jobs.length,0);assert.equal(f.service.list(project.id).schedules[0].status,'disabled');assert.equal(f.dispatches(),0);});
