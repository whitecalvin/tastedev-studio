import type {WorkspaceSnapshot} from '../ai/snapshot.ts';
import {verifyProjectReference,type ProjectSnapshot} from '../ai/project-snapshot.ts';
import type { JobPayload, JobRequirement } from './domain.ts';

export type TestType = 'unit' | 'integration' | 'api' | 'browser' | 'e2e';
export interface GitSource { provider: 'git'; repository: string; revision: string }
export interface BrowserTest { engine: 'playwright'; baseUrl: string; config: string }
export function validateBrowser(b: BrowserTest): BrowserTest {
  validateHealth({url:b.baseUrl,expectedStatus:200,retryIntervalMs:100});
  if(b.engine!=='playwright'||typeof b.config!=='string'||!/^([A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(ts|js|mts|mjs|cts|cjs)$/.test(b.config)||b.config.includes('..')||b.config.length>200)throw new Error('Browser requires Playwright and a relative config file.');
  return {engine:'playwright',baseUrl:b.baseUrl,config:b.config};
}
export interface HealthCheck { url: string; expectedStatus: number; retryIntervalMs: number }
export type PipelineStage = 'source' | 'install' | 'build' | 'start' | 'healthcheck' | 'test' | 'cleanup';
export interface ExecutionStep {
  name: string; executable: string; args: string[]; cwd: string;
  env?: Record<string, string>; timeoutMs?: number;
  stage?: PipelineStage; taskReference?: string; source?: GitSource | SnapshotSource; healthcheck?: HealthCheck; browser?: BrowserTest;
}
export interface TestPlan {
  id: string; projectId: string; testName: string; type: TestType;
  requirements: JobRequirement; environment: Record<string, string>;
  timeout: number; steps: ExecutionStep[];
}
export interface SnapshotSource {provider:'snapshot';repository:string;revision:string;snapshot:WorkspaceSnapshot}
export interface SourceRevision { repository: string; branch: string; commit: string; snapshotId?:string;proposalId?:string;attempt?:number }
/** Provider contract is independent of orchestration; more providers can add structured operations. */
export interface SourcePreparation { provider: string; prepare(source: GitSource): ExecutionStep }
export const gitSourceProvider: SourcePreparation = {
  provider: 'git',
  prepare(source) { validateSource(source); return { name: 'Source', stage: 'source', executable: 'git', args: [], cwd: '.', source, timeoutMs: 120000 }; },
};
export function validateSource(source: GitSource): GitSource;
export function validateSource(source: SnapshotSource): SnapshotSource;
export function validateSource(source: GitSource | SnapshotSource): GitSource | SnapshotSource;
export function validateSource(source: GitSource | SnapshotSource) {
 if(source.provider==='snapshot'){const s=source.snapshot;if(!s||s.provider!=='snapshot'||source.repository!=='snapshot:'+s.snapshotId||source.revision!==s.baseRevision||!Array.isArray(s.files)||s.files.length>100||JSON.stringify(source).length>52000)throw new Error('Invalid snapshot source.');if(s.schemaVersion===2)verifyProjectReference(s as ProjectSnapshot);return structuredClone(source);}

  let url: URL;
  try { url = new URL(source.repository); } catch { throw new Error('Source requires an absolute Git URL.'); }
  if (source.provider !== 'git' || !['https:', 'git:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash || source.repository.length > 1024 || /[\x00-\x20]/.test(source.repository)) throw new Error('Use a credential-free HTTPS or Git repository URL.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(source.revision) || source.revision.includes('..') || source.revision.includes('//')) throw new Error('Invalid Git branch, tag or commit revision.');
  return { provider: 'git' as const, repository: source.repository, revision: source.revision };
}
export function validateHealth(health: HealthCheck) {
  let url: URL;
  try { url = new URL(health.url); } catch { throw new Error('Invalid health URL.'); }
  // v1 probes the service on the assigned Agent, never arbitrary network endpoints.
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.hash || url.search || health.url.length > 1024 || /[\x00-\x20]/.test(health.url)) throw new Error('Health checks require a credential-free loopback HTTP URL without query.');
  if (!Number.isInteger(health.expectedStatus) || health.expectedStatus < 100 || health.expectedStatus > 599 || !Number.isInteger(health.retryIntervalMs) || health.retryIntervalMs < 100 || health.retryIntervalMs > 10000) throw new Error('Invalid health status or retry interval.');
  return { url:health.url, expectedStatus:health.expectedStatus, retryIntervalMs:health.retryIntervalMs };
}
export function planPayload(plan: TestPlan): JobPayload { return { task: plan.testName, steps: plan.steps, testPlan: plan }; }
