import test from 'node:test';
import assert from 'node:assert/strict';
import {assertLocalExecutionAllowed,localIsolationMessage,strictExecutionIsolation} from '../src/features/process/isolation.ts';
import {resolveProtocol} from '../src/features/protocol/resolver.ts';
import {parseProtocol} from '../src/features/protocol/parser.ts';

const step={name:'syntax',executable:'node',args:['--check','src/service.cjs'],cwd:'.'};
test('project-required isolation cannot be dropped by local validation conversion',()=>{
 const protocol=parseProtocol({'project.yml':JSON.stringify({version:1,project:{name:'isolated',type:'generic'},requirements:{tools:{executionIsolation:true}}}),'tasks.yml':JSON.stringify({syntax:{command:step.executable,args:step.args}})});
 const task=resolveProtocol(protocol,'task','syntax');
 assert.equal(task.requirements.executionIsolation,1);
 assert.throws(()=>assertLocalExecutionAllowed(task.requirements,task.payload.steps[0]),{message:localIsolationMessage});
 const {isolation:discarded,...withoutPolicy}=task.payload.steps[0];assert(discarded);
 assert.throws(()=>assertLocalExecutionAllowed(task.requirements,withoutPolicy),{message:localIsolationMessage});
});
test('step isolation is protected even when the parent requirement is missing',()=>{
 assert.throws(()=>assertLocalExecutionAllowed({}, {...step,isolation:strictExecutionIsolation()}),{message:localIsolationMessage});
 assert.throws(()=>assertLocalExecutionAllowed({}, {...step,isolation:{version:2,filesystem:'workspace',network:'deny',childProcesses:'bounded',maxProcesses:2}}),{message:localIsolationMessage});
});
test('explicit ordinary IDE validation remains available without an isolation claim',()=>{
 assert.doesNotThrow(()=>assertLocalExecutionAllowed({},step));
});
