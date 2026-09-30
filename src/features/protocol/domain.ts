import type { JobRequirement, Runtime } from '../core/domain.ts';

/** Normalized constraints; explicit null removes an inherited optional constraint. */
export type RequirementDefinition = Omit<JobRequirement, 'docker' | 'browser' | 'runtimes'> & {
  docker?: 'required' | null;
  browser?: JobRequirement['browser'] | null;
  runtimes?: Partial<Record<Runtime, string | null>>;
};
export type EnvironmentDefinition = Record<string, string>;
export interface TaskDefinition {
  name: string; command: string; args: string[]; cwd: string;
  environment?: string; env: EnvironmentDefinition; timeout: number;
  requirements: RequirementDefinition;
}
export interface TestDefinition {
  browser?: import('../core/test-plan.ts').BrowserTest;
  name: string; task: string; type: 'unit' | 'integration' | 'api' | 'browser' | 'e2e';
  requirements: RequirementDefinition; timeout?: number;
  pipeline?: Partial<Record<'install' | 'build' | 'start' | 'cleanup', string>>;
  healthcheck?: import('../core/test-plan.ts').HealthCheck & { timeout: number };
  environment?: string; env?: EnvironmentDefinition;
}
export interface TasteDevProjectDefinition {
  version: 1; project: { name: string; type: string };
  source?: import('../core/test-plan.ts').GitSource;
  requirements: RequirementDefinition; environment: EnvironmentDefinition;
  environments: Record<string, EnvironmentDefinition>;
  tasks: Record<string, TaskDefinition>; tests: Record<string, TestDefinition>;
}
export const protocolFiles = ['project.yml', 'environments.yml', 'tasks.yml', 'tests.yml'] as const;
export type ProtocolFile = typeof protocolFiles[number];
export type ProtocolSources = Partial<Record<ProtocolFile, string>>;
export interface ProtocolIssue { file: string; path: string; message: string }
export type ProtocolState = { status: 'Not Configured'; issues: ProtocolIssue[] }
  | { status: 'Invalid'; issues: ProtocolIssue[] }
  | { status: 'Valid'; issues: []; definition: TasteDevProjectDefinition };
export class ProtocolError extends Error {
  readonly issue: ProtocolIssue;
  constructor(file: string, path: string, message: string) {
    super(message); this.name = 'ProtocolError'; this.issue = { file: `.tastedev/${file}`, path, message };
  }
}
