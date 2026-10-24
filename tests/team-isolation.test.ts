import test from 'node:test';
import assert from 'node:assert/strict';
import {teamIsolation} from '../src/features/orchestration/team-isolation.ts';
import type {FactoryTask} from '../src/features/orchestration/factory.ts';
import type {GraphOverview} from '../src/features/orchestration/execution.ts';
import type {FixAttempt} from '../src/features/ai/fix-service.ts';
import type {Run} from '../src/features/core/domain.ts';
function fixture(){const task={contract:{taskId:'task',projectId:'project',sourceChecksum:'a'.repeat(64),paths:['src']},attempts:[{executionId:'execution'}]} as FactoryTask,graph={executions:[{id:'execution',activations:[{fixAttemptId:'fix'}]}]} as unknown as GraphOverview,fix={id:'fix',projectId:'project',proposalId:'proposal',status:'passed',patches:[{path:'src/a.ts',baseHash:'base',resultHash:'result',base:'private body',result:'private body2'}],approval:{proposalId:'proposal',files:['src/a.ts']},snapshot:{snapshotId:'snapshot',checksum:'b'.repeat(64)},retestRunId:'run'} as FixAttempt,run={id:'run',projectId:'project',status:'passed',revision:{commit:'b'.repeat(64)}} as Run;return{task,graph,fix,run,read:()=>teamIsolation(task,graph,()=>fix,()=>run)};}
test('workspace report separates pinned baseline, approved changes and exact remote tested Snapshot without bodies',()=>{const f=fixture(),before=JSON.stringify(f.fix),r=f.read();assert.equal(r.mode,'serialized-source-isolated-retest');assert.equal(r.attempts[0].sourceMatchesRun,true);assert.equal(r.issues.length,0);assert.ok(!JSON.stringify(r).includes('private body'));assert.equal(JSON.stringify(f.fix),before);});
test('mismatching retest revision, unapproved file and out-of-scope changes remain visible as defects',()=>{const f=fixture();f.run.revision!.commit='other';f.fix.patches[0].path='outside.ts';const r=f.read();assert.equal(r.attempts[0].sourceMatchesRun,false);assert.equal(r.issues.length,3);});
test('another project or missing attempt never becomes verified Source',()=>{const f=fixture();f.fix.projectId='other';assert.equal(f.read().attempts.length,0);assert.equal(f.read().issues.length,1);});
