import { activeRun, CoreError, type Run, type RunStep, type RunStatus, type BrowserResult } from './domain.ts';
import type { CoreService } from './service.ts';
import type { SourceRevision } from './test-plan.ts';

export type TerminalStatus = Extract<RunStatus, 'passed' | 'failed' | 'timeout' | 'cancelled'>;
/** Owns sequential state and policy; transport delivers the returned structured step. */
export class TestOrchestrator {
  readonly core: CoreService;
  constructor(core: CoreService) { this.core=core; }
  next(runId: string) {
    return this.core.repository.transaction(tx => {
      const run = tx.runs.get(runId);
      if (!run || !activeRun(run)) return null;
      const job = tx.jobs.get(run.jobId)!;
      if (!job.payload.testPlan) throw new CoreError('Run has no TestPlan.');
      if (run.status === 'pending') { run.status = 'running'; run.startedAt = new Date().toISOString(); job.status = 'running'; }
      if (job.cancellationRequestedAt && !run.termination) run.termination = 'cancelled';
      const steps = tx.steps.list().filter(s=>s.runId===runId).sort((a,b)=>a.order-b.order);
      if (steps.some(s=>s.status==='running')) return null;
      for (const step of steps) {
        if (step.status !== 'pending') continue;
        const command = job.payload.steps[step.order];
        if (run.termination && command.stage !== 'cleanup') { step.status = run.termination === 'cancelled' ? 'cancelled' : 'skipped'; step.failureReason = `Not executed after ${run.termination}.`; step.finishedAt = new Date().toISOString(); continue; }
        step.status = 'running'; step.startedAt = new Date().toISOString(); step.taskReference = command.taskReference;
        return { run, job, step, command };
      }
      return null;
    });
  }
  complete(runId: string, stepId: string, status: TerminalStatus, exitCode: number | null, reason?: string, revision?: SourceRevision, serviceId?: string, browserResult?:BrowserResult,executionReport?:import('./domain.ts').ExecutionReport) {
    this.core.repository.transaction(tx => {
      const run = tx.runs.get(runId), step = tx.steps.get(stepId);
      if (!run || !activeRun(run) || !step || step.runId !== runId || step.status !== 'running') throw new CoreError('Unexpected pipeline result.');
      const job = tx.jobs.get(run.jobId)!;
      if (status === 'passed' && exitCode !== 0) throw new CoreError('Successful step requires exit zero.');
      if (status === 'failed' && exitCode === 0) throw new CoreError('Failed step cannot report exit zero.');
      if (exitCode !== null && !Number.isInteger(exitCode)) throw new CoreError('Invalid step exit code.');
      step.status = status; step.exitCode = exitCode; step.finishedAt = new Date().toISOString();
      if(browserResult)step.browserResult=browserResult;if(executionReport)step.executionReport=structuredClone(executionReport);
      if (serviceId) step.serviceId = serviceId;
      if (revision) {
        const source = job.payload.steps[step.order].source;
        if (!source || revision.repository !== source.repository || !/^[a-f0-9]{40,64}$/.test(revision.commit) || typeof revision.branch !== 'string' || revision.branch.length > 200) throw new CoreError('Invalid source revision report.');
        if(source.provider==='snapshot'&&(revision.snapshotId!==source.snapshot.snapshotId||revision.proposalId!==source.snapshot.proposalId||revision.attempt!==source.snapshot.attempt||revision.commit!==source.snapshot.checksum))throw new CoreError('Snapshot identity mismatch.');run.revision = revision;
      }
      if (status === 'passed' && job.payload.steps[step.order].stage === 'source' && !revision) throw new CoreError('Source preparation must report its commit.');
      if (status !== 'passed') {
        step.failureReason = reason?.slice(0,300) || `Step ${status}.`;
        if (!run.primaryFailureStepId) { run.primaryFailureStepId = step.id; run.termination ??= status; }
        else if (job.payload.steps[step.order].stage === 'cleanup') run.cleanupWarning = step.failureReason;
      }
    });
  }
  terminate(runId: string, status: 'cancelled' | 'timeout') {
    this.core.repository.transaction(tx=>{const run=tx.runs.get(runId);if(run && activeRun(run)) run.termination ??= status;});
  }
  finish(runId: string) {
    const s=this.core.repository.read(), run=s.runs.find(r=>r.id===runId);
    if (!run || !activeRun(run) || s.steps.some(s=>s.runId===runId && ['pending','running'].includes(s.status))) return null;
    const failure=s.steps.find(s=>s.id===run.primaryFailureStepId), status=run.termination ?? 'passed';
    return this.core.finishRun(run.projectId,run.id,status,status==='passed'?0:failure?.exitCode === 0 ? null : failure?.exitCode ?? null,(failure?.failureReason ?? (status==='passed'?'All pipeline steps passed.':`Run ${status}.`)).replace(/[\x00-\x1f]/g,' ').slice(0,300));
  }
}
export function testResult(run: Run, steps: RunStep[], testName: string, type: string) {
  return { testName, type, runId:run.id, agent:run.agentId, revision:run.revision, status:run.status, duration:run.startedAt ? Math.max(0,Date.parse(run.finishedAt ?? new Date().toISOString())-Date.parse(run.startedAt)) : 0, failedStep:steps.find(s=>s.id===run.primaryFailureStepId), exitCode:run.exitCode };
}
