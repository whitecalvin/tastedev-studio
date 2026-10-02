import type { TestPlan } from '../core/test-plan.ts';
import type { WorkspaceSnapshot } from '../ai/snapshot.ts';
/** The existing Agent snapshot contract's proposalId slot carries the launch request ID here, not an AI proposal. */
export function withWorkspaceSnapshot(plan: TestPlan, snapshot: WorkspaceSnapshot): TestPlan {
  if (snapshot.projectId !== plan.projectId) throw Error('Workspace snapshot belongs to another project.');
  const hadSource = plan.steps.some(step => step.stage === 'source');
  const steps = plan.steps.filter(step => step.stage !== 'source').map(step => hadSource || step.stage === 'healthcheck' || step.executable === 'internal-stop-services' ? step : { ...step, cwd: step.cwd === '.' ? 'source' : `source/${step.cwd}` });
  return { ...plan, requirements:{...plan.requirements,...(snapshot.schemaVersion===2?{sourceSnapshot:2 as const}:{})}, steps: [{ name: 'Workspace snapshot', stage: 'source', executable: 'snapshot', args: [], cwd: '.', source: { provider: 'snapshot', repository: 'snapshot:' + snapshot.snapshotId, revision: snapshot.baseRevision, snapshot }, timeoutMs: 120000 }, ...steps] };
}
