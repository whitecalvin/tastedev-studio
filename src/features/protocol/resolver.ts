import type { JobRequirement, Runtime } from '../core/domain.ts';
import { validatePayload, validateRequirements } from '../core/matcher.ts';
import type { CreateJob } from '../core/service.ts';
import type { ProtocolState, RequirementDefinition, TasteDevProjectDefinition, TaskDefinition, TestDefinition } from './domain.ts';
import { gitSourceProvider, type TestPlan, type ExecutionStep } from '../core/test-plan.ts';

export function resolveEnvironment(d: TasteDevProjectDefinition, task: TaskDefinition, test?: TestDefinition) {
  return { ...d.environment, ...(task.environment ? d.environments[task.environment] : {}), ...task.env, ...(test?.environment ? d.environments[test.environment] : {}), ...test?.env };
}

export function mergeRequirements(...layers: RequirementDefinition[]): JobRequirement {
  const combined: RequirementDefinition = {};
  for (const layer of layers) Object.assign(combined, layer, { runtimes: { ...combined.runtimes, ...layer.runtimes } });
  const runtimes: JobRequirement['runtimes'] = {};
  for (const [key, val] of Object.entries(combined.runtimes ?? {})) if (val !== null) runtimes[key as Runtime] = val;
  return validateRequirements({ ...combined, docker: combined.docker ?? undefined, browser: combined.browser ?? undefined, runtimes });
}

/** Pure conversion. Loading and resolving never submit or execute a Job. */
export function resolveProtocol(state: ProtocolState, kind: 'task' | 'test', name: string): CreateJob {
  if (state.status !== 'Valid') throw new Error('Only a valid Protocol can create a Job.');
  const d = state.definition;
  const test = kind === 'test' && Object.hasOwn(d.tests, name) ? d.tests[name] : undefined;
  const taskName = kind === 'test' ? test?.task : name;
  const task = taskName && Object.hasOwn(d.tasks, taskName) ? d.tasks[taskName] : undefined;
  if (!task) throw new Error('The selected task or test no longer exists. Reload Protocol.');
  const env = resolveEnvironment(d, task, test);
  return {
    name: `${kind}: ${name}`, requirements: combineRequirements([mergeRequirements(d.requirements, task.requirements, test?.requirements ?? {}),mergeRequirements(test?.executionProfile?d.executionProfiles![test.executionProfile].requirements:{})]),
    payload: validatePayload({ task: task.name, steps: [{ name: task.name, executable: task.command, args: [...task.args], cwd: task.cwd, env, timeoutMs: (test?.timeout ?? task.timeout) * 1000 }] }),
  };
}

/** Intersect already-resolved step constraints, never weaken another step's needs. */
export function combineRequirements(layers: JobRequirement[]): JobRequirement {
  const result: JobRequirement = { runtimes: {} };
  for (const layer of layers) {
    for (const key of ['platform', 'architecture', 'browser'] as const) {
      if (result[key] && layer[key] && result[key] !== layer[key]) throw new Error(`Pipeline has conflicting ${key} requirements.`);
      if (layer[key]) Object.assign(result, { [key]: layer[key] });
    }
    for (const key of ['docker', 'gpu', 'pty'] as const) if (layer[key] === 'required') result[key] = 'required';
    if(layer.gpu==='optional'&&!result.gpu)result.gpu='optional';
    for (const key of ['cpuCores', 'memoryMiB'] as const) if (layer[key]) result[key] = Math.max(result[key] ?? 0, layer[key]!);
    for (const [key, value] of Object.entries(layer.runtimes ?? {})) {
      const runtime = key as Runtime;
      const numeric = (v: string) => v.slice(2).split('.').map(Number).reduce((n, x, i) => n + x * 10000 ** (2 - i), 0);
      if (!result.runtimes![runtime] || numeric(value) > numeric(result.runtimes![runtime]!)) result.runtimes![runtime] = value;
    }
  }
  return validateRequirements(result);
}
export function resolveTestPlan(state: ProtocolState, projectId: string, name: string, id = crypto.randomUUID()): TestPlan {
  if (state.status !== 'Valid' || !Object.hasOwn(state.definition.tests, name)) throw new Error('Select a valid Test definition.');
  const d = state.definition, test = d.tests[name];
  const profile = test.executionProfile ? d.executionProfiles?.[test.executionProfile] : undefined;
  if(test.executionProfile&&!profile)throw Error('Execution profile no longer exists. Reload Protocol.');
  const steps: ExecutionStep[] = [], requirements: JobRequirement[] = [];
  if(profile)requirements.push(mergeRequirements(profile.requirements));
  if (d.source) { steps.push(gitSourceProvider.prepare(d.source)); requirements.push({ runtimes: { git: '>=0' } }); }
  const addTask = (stage: ExecutionStep['stage'], ref: string) => {
    const t = d.tasks[ref];
    requirements.push(mergeRequirements(d.requirements, t.requirements, test.requirements));
    steps.push({ name: stage![0].toUpperCase() + stage!.slice(1), stage, taskReference: ref, executable: t.command, args: [...t.args], cwd: d.source ? (t.cwd === '.' ? 'source' : `source/${t.cwd}`) : t.cwd, env: resolveEnvironment(d, t, test), timeoutMs: t.timeout * 1000 });
  };
  for (const stage of ['install', 'build', 'start'] as const) {const task=test.pipeline?.[stage]??(stage==='install'?profile?.installTask:undefined);if(task)addTask(stage,task);}
  if (test.healthcheck) steps.push({ name: 'Health check', stage: 'healthcheck', executable: 'http', args: [], cwd: '.', healthcheck: test.healthcheck, timeoutMs: test.healthcheck.timeout * 1000 });
  addTask('test', test.task);
  if(test.browser){steps.at(-1)!.browser=test.browser;steps.at(-1)!.name='Browser test';requirements.push({browser:'chromium',runtimes:{node:'>=24',playwright:'>=1.62.1'}});}
  if (test.pipeline?.cleanup) addTask('cleanup', test.pipeline.cleanup);
  // Always end the run session, including a run without a project cleanup task.
  else steps.push({ name: 'Cleanup', stage: 'cleanup', executable: 'internal-stop-services', args: [], cwd: '.', timeoutMs: 10000 });
  return { id, projectId, testName: name, type: test.type, ...(profile?{executionProfile:{name:test.executionProfile!,requirements:mergeRequirements(profile.requirements),...(profile.installTask?{installTask:profile.installTask}:{})}}:{}), requirements: combineRequirements(requirements), environment: resolveEnvironment(d, d.tasks[test.task], test), timeout: (test.timeout ?? 600) * 1000, steps };
}
