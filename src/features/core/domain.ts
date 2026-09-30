export type Platform = 'windows' | 'linux' | 'macos';
export type Architecture = 'x86_64' | 'arm64';
export type Runtime = 'node' | 'java' | 'python' | 'rust' | 'git' | 'playwright';
export type Browser = 'chromium' | 'firefox' | 'webkit';
export type AgentStatus = 'offline' | 'online' | 'idle' | 'busy' | 'error';
export interface AgentCapability { cpuCores: number; memoryMiB: number; docker: boolean; gpu: boolean; pty: boolean; runtimes: Partial<Record<Runtime, string>>; browsers: Browser[] }
export interface Agent { id: string; name: string; status: AgentStatus; platform: Platform; architecture: Architecture; capabilities: AgentCapability; lastSeenAt: string | null; createdAt: string; updatedAt: string }
export interface JobRequirement { platform?: Platform; architecture?: Architecture; cpuCores?: number; memoryMiB?: number; docker?: 'required'; gpu?: 'required' | 'optional'; pty?: 'required'; runtimes?: Partial<Record<Runtime, string>>; browser?: Browser }
export interface JobPayload { task: string; steps: import('./test-plan.ts').ExecutionStep[]; testPlan?: import('./test-plan.ts').TestPlan }
export type JobStatus = 'queued' | 'assigned' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export interface Job { id: string; projectId: string; type: 'task'; name: string; status: JobStatus; requirements: JobRequirement; payload: JobPayload; priority: number; queuedAt: string; createdAt: string; updatedAt: string; agentId: string | null; sourceJobId: string | null; attempt: number; maxAttempts: number; cancellationRequestedAt: string | null }
export type RunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'timeout';
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'cancelled' | 'timeout';
export interface Run { id: string; jobId: string; projectId: string; agentId: string; status: RunStatus; startedAt: string | null; finishedAt: string | null; exitCode: number | null; createdAt: string; result: { summary: string } | null; revision?: import('./test-plan.ts').SourceRevision; primaryFailureStepId?: string; cleanupWarning?: string; termination?: 'failed' | 'timeout' | 'cancelled' }
export interface RunStep { id: string; runId: string; name: string; order: number; status: StepStatus; startedAt: string | null; finishedAt: string | null; exitCode: number | null; taskReference?: string; failureReason?: string; serviceId?: string; browserResult?: BrowserResult }
export interface BrowserResult { total:number; passed:number; failed:number; skipped:number; duration:number; browserVersion:string; playwrightVersion:string; classification:string; failures:{name:string;message:string;stack?:string;location?:string}[]; consoleErrors:number; pageErrors:number; networkFailures:number; evidenceWarnings:string[] }
export interface Artifact { id: string; runId: string; runStepId: string | null; type: 'log' | 'screenshot' | 'report' | 'trace' | 'video' | 'test-report' | 'browser-console' | 'page-errors' | 'network-log'; name: string; location: string; size: number; createdAt: string; mimeType?:string; checksum?:string }
export interface CoreEvent { id: string; type: 'agent.registered' | 'agent.updated' | 'agent.removed' | 'agent.status.changed' | 'job.created' | 'job.queued' | 'job.assigned' | 'job.cancelled' | 'job.cancellation.requested' | 'run.created' | 'run.started' | 'run.completed' | 'run.failed' | 'run.step.changed' | 'artifact.created'; entityId: string; projectId: string | null; timestamp: string }
export interface CoreSnapshot { agents: Agent[]; jobs: Job[]; runs: Run[]; steps: RunStep[]; artifacts: Artifact[]; events: CoreEvent[] }
export class CoreError extends Error { constructor(message: string) { super(message); this.name = 'CoreError'; } }
export const activeRun = (run: Run) => run.status === 'pending' || run.status === 'running';
export function transition<T extends string>(current: T, next: T, allowed: Record<T, readonly T[]>) { if (!allowed[current]?.includes(next)) throw new CoreError(`Cannot change ${current} to ${next}.`); }
export const jobTransitions: Record<JobStatus, JobStatus[]> = { queued: ['assigned', 'cancelled'], assigned: ['running', 'failed', 'cancelled'], running: ['succeeded', 'failed', 'cancelled'], succeeded: [], failed: [], cancelled: [] };
export const runTransitions: Record<RunStatus, RunStatus[]> = { pending: ['running', 'failed', 'cancelled'], running: ['passed', 'failed', 'cancelled', 'timeout'], passed: [], failed: [], cancelled: [], timeout: [] };
export const stepTransitions: Record<StepStatus, StepStatus[]> = { pending: ['running', 'skipped', 'cancelled'], running: ['passed', 'failed', 'cancelled', 'timeout'], passed: [], failed: [], skipped: [], cancelled: [], timeout: [] };

