import { load, CORE_SCHEMA } from 'js-yaml';
import type { JobRequirement, Runtime } from '../core/domain.ts';
import { normalizePath } from '../filesystem/paths.ts';
import { validateSource, validateHealth, validateBrowser } from '../core/test-plan.ts';
import {affectedPattern} from './affected-files.ts';
import { ProtocolError, protocolFiles, type EnvironmentDefinition, type ProtocolSources, type ProtocolState, type RequirementDefinition, type TaskDefinition, type TestDefinition, type TasteDevProjectDefinition } from './domain.ts';

type Dict = Record<string, unknown>;
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);
const own = (o: object, k: string) => Object.hasOwn(o, k);
class Schema {
  readonly file: string;
  constructor(file: string) { this.file = file; }
  fail(path: string, message: string): never { throw new ProtocolError(this.file, path, message); }
  object(value: unknown, path: string, fields?: string[]): Dict {
    if (!value || typeof value !== 'object' || Array.isArray(value)) this.fail(path, 'Expected a mapping.');
    const obj = value as Dict;
    for (const key of Object.keys(obj)) if (unsafeKeys.has(key) || (fields && !fields.includes(key))) this.fail(`${path}.${key}`, 'Unknown or reserved field.');
    return obj;
  }
  string(value: unknown, path: string, max = 120): string {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) this.fail(path, 'Expected a nonempty bounded string.');
    return value;
  }
  enum<const T extends string>(value: unknown, path: string, choices: readonly T[]): T {
    if (!choices.includes(value as T)) this.fail(path, `Expected one of: ${choices.join(', ')}.`);
    return value as T;
  }
  bool(value: unknown, path: string) { if (typeof value !== 'boolean') this.fail(path, 'Expected a boolean.'); return value; }
  timeout(value: unknown, path: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 3600) this.fail(path, 'Timeout must be an integer from 1 to 3600 seconds.');
    return value;
  }
  environment(value: unknown, path: string): EnvironmentDefinition {
    const obj = this.object(value, path);
    if (Object.keys(obj).length > 32) this.fail(path, 'At most 32 environment variables are supported.');
    const result: EnvironmentDefinition = {};
    for (const [key, val] of Object.entries(obj)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key) || typeof val !== 'string' || val.length > 4096 || val.includes('\0')) this.fail(`${path}.${key}`, 'Expected a valid variable name and a string value up to 4096 characters without NUL.');
      result[key] = val;
    }
    return result;
  }
  requirements(value: unknown, path: string): RequirementDefinition {
    const obj = this.object(value, path, ['os', 'architecture', 'runtimes', 'tools', 'browsers', 'gpu']);
    const result: RequirementDefinition = {};
    if (own(obj, 'os')) result.platform = this.enum(obj.os, `${path}.os`, ['windows', 'linux', 'macos']);
    if (own(obj, 'architecture')) result.architecture = this.enum(obj.architecture, `${path}.architecture`, ['x86_64', 'arm64']);
    if (own(obj, 'runtimes')) {
      const runtimes = this.object(obj.runtimes, `${path}.runtimes`, ['node', 'java', 'python', 'rust', 'git', 'playwright']);
      result.runtimes = {};
      for (const [key, val] of Object.entries(runtimes)) {
        if (typeof val !== 'string' || !/^>=\d{1,4}(?:\.\d{1,4}){0,2}$/.test(val)) this.fail(`${path}.runtimes.${key}`, 'Only numeric >=major.minor.patch minimums are supported.');
        result.runtimes[key as Runtime] = val;
      }
    }
    if (own(obj, 'tools')) {
      const tools = this.object(obj.tools, `${path}.tools`, ['git', 'docker']);
      if (own(tools, 'docker')) result.docker = this.bool(tools.docker, `${path}.tools.docker`) ? 'required' : null;
      if (own(tools, 'git')) {
        if (result.runtimes?.git) this.fail(`${path}.tools.git`, 'Declare Git in tools or runtimes, not both.');
        result.runtimes = { ...result.runtimes, git: this.bool(tools.git, `${path}.tools.git`) ? '>=0' : null };
      }
    }
    if (own(obj, 'gpu')) {
      const gpu = this.object(obj.gpu, `${path}.gpu`, ['required']);
      result.gpu = this.bool(gpu.required, `${path}.gpu.required`) ? 'required' : 'optional';
    }
    if (own(obj, 'browsers')) {
      const browsers = this.object(obj.browsers, `${path}.browsers`, ['chromium', 'firefox', 'webkit']);
      if (Object.keys(browsers).length !== 1) this.fail(`${path}.browsers`, 'The current Matcher supports exactly one declared browser constraint.');
      const [name, required] = Object.entries(browsers)[0];
      result.browser = this.bool(required, `${path}.browsers.${name}`) ? name as JobRequirement['browser'] : null;
    }
    return result;
  }
  definitions(value: unknown, path: string) {
    const obj = this.object(value, path);
    if (Object.keys(obj).length > 100) this.fail(path, 'At most 100 definitions per file are supported.');
    for (const key of Object.keys(obj)) if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key)) this.fail(`${path}.${key}`, 'Names must start with a letter and contain only letters, digits, underscores or hyphens (64 maximum).');
    return obj;
  }
  task(name: string, value: unknown): TaskDefinition {
    const obj = this.object(value, name, ['command', 'args', 'cwd', 'environment', 'env', 'timeout', 'requirements']);
    const command = this.string(obj.command, `${name}.command`, 240);
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.+-]*$/.test(command) || /\.(cmd|bat)$/i.test(command)) this.fail(`${name}.command`, 'Use a portable executable name, not a path, batch file or shell expression.');
    const args = own(obj, 'args') ? obj.args : [];
    if (!Array.isArray(args) || args.length > 100 || args.some(a => typeof a !== 'string' || a.length > 1024 || /[\x00-\x1f]/.test(a))) this.fail(`${name}.args`, 'Expected up to 100 string arguments, each at most 1024 characters without control characters.');
    const cwd = own(obj, 'cwd') ? this.string(obj.cwd, `${name}.cwd`, 240) : '.';
    try { if (cwd !== '.' && (normalizePath(cwd) !== cwd || /[%\\]/.test(cwd) || cwd.split('/').some(s => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)))) throw Error(); }
    catch { this.fail(`${name}.cwd`, 'Use a normalized relative path inside the project, or ".".'); }
    return { name, command, args: [...args], cwd, ...(own(obj, 'environment') ? { environment: this.string(obj.environment, `${name}.environment`, 64) } : {}), env: own(obj, 'env') ? this.environment(obj.env, `${name}.env`) : {}, timeout: own(obj, 'timeout') ? this.timeout(obj.timeout, `${name}.timeout`) : 60, requirements: own(obj, 'requirements') ? this.requirements(obj.requirements, `${name}.requirements`) : {} };
  }
}

export function parseYaml(source: string, file: string): unknown {
  if (new TextEncoder().encode(source).length > 65536) throw new ProtocolError(file, '$', 'Protocol files are limited to 64 KiB each.');
  try {
    return load(source, { schema: CORE_SCHEMA, json: false, maxDepth: 16, maxTotalMergeKeys: 0,
      onWarning: () => { throw Error('YAML warning'); },
      listener: (event, state) => { if (event === 'close' && state.anchor !== null) throw Error('Anchors are not supported'); },
    });
  } catch (error) {
    const mark = (error as { mark?: { line: number; column: number } }).mark;
    throw new ProtocolError(file, mark ? `line ${mark.line + 1}:${mark.column + 1}` : '$', 'Invalid YAML. Check syntax, duplicate keys, depth and unsupported anchors or tags.');
  }
}

export function parseProtocol(sources: ProtocolSources): ProtocolState {
  if (sources['project.yml'] === undefined) return { status: 'Not Configured', issues: [] };
  try {
    const parsed: Record<string, unknown> = {};
    for (const file of protocolFiles) parsed[file] = sources[file] === undefined ? {} : parseYaml(sources[file], file);
    const s = new Schema('project.yml');
    const root = s.object(parsed['project.yml'], '$', ['version', 'project', 'requirements', 'environment', 'source', 'executionProfiles']);
    if (root.version !== 1) s.fail('version', 'Protocol version must be the number 1. Other versions are not supported.');
    const project = s.object(root.project, 'project', ['name', 'type']);
    let source;
    if (own(root, 'source')) {
      const raw = s.object(root.source, 'source', ['provider', 'repository', 'revision']);
      try { source = validateSource({ provider: s.enum(raw.provider, 'source.provider', ['git']), repository: s.string(raw.repository, 'source.repository', 1024), revision: s.string(raw.revision, 'source.revision', 200) }); }
      catch { s.fail('source', 'Use a credential-free HTTPS/Git repository URL and a branch, tag or commit revision.'); }
    }
    const definition: TasteDevProjectDefinition = {
      version: 1 as const, project: { name: s.string(project.name, 'project.name'), type: s.string(project.type, 'project.type', 64) },
      ...(source ? { source } : {}),
      requirements: own(root, 'requirements') ? s.requirements(root.requirements, 'requirements') : {},
      environment: own(root, 'environment') ? s.environment(root.environment, 'environment') : {},
      environments: {} as Record<string, EnvironmentDefinition>, tasks: {} as Record<string, TaskDefinition>, tests: {} as Record<string, TestDefinition>,
    };
    const es = new Schema('environments.yml');
    for (const [name, val] of Object.entries(es.definitions(parsed['environments.yml'] === undefined ? {} : parsed['environments.yml'], '$'))) definition.environments[name] = es.environment(val, name);
    const ts = new Schema('tasks.yml');
    for (const [name, val] of Object.entries(ts.definitions(parsed['tasks.yml'] === undefined ? {} : parsed['tasks.yml'], '$'))) {
      const task = ts.task(name, val);
      if (task.environment && !own(definition.environments, task.environment)) ts.fail(`${name}.environment`, 'The referenced environment profile does not exist.');
      const merged = { ...definition.environment, ...(task.environment ? definition.environments[task.environment] : {}), ...task.env };
      ts.environment(merged, `${name}.env`);
      definition.tasks[name] = task;
    }
    const xs = new Schema('tests.yml');
    if (own(root,'executionProfiles')) {
      definition.executionProfiles={};
      for(const [name,value] of Object.entries(s.definitions(root.executionProfiles,'executionProfiles'))){
        const profile=s.object(value,`executionProfiles.${name}`,['requirements','installTask']);
        const installTask=own(profile,'installTask')?s.string(profile.installTask,`executionProfiles.${name}.installTask`,64):undefined;
        if(installTask&&!own(definition.tasks,installTask))s.fail(`executionProfiles.${name}.installTask`,'The installation task must exist in tasks.yml.');
        definition.executionProfiles[name]={requirements:own(profile,'requirements')?s.requirements(profile.requirements,`executionProfiles.${name}.requirements`):{},...(installTask?{installTask}:{})};
      }
    }
    for (const [name, val] of Object.entries(xs.definitions(parsed['tests.yml'] === undefined ? {} : parsed['tests.yml'], '$'))) {
      const x = xs.object(val, name, ['task', 'type', 'requirements', 'timeout', 'pipeline', 'healthcheck', 'environment', 'env', 'browser','affectedFiles','executionProfile']);
      const task = xs.string(x.task, `${name}.task`, 64);
      if (!own(definition.tasks, task)) xs.fail(`${name}.task`, 'The referenced task does not exist.');
      definition.tests[name] = { name, task, type: xs.enum(x.type, `${name}.type`, ['unit', 'integration', 'api', 'browser', 'e2e']), requirements: own(x, 'requirements') ? xs.requirements(x.requirements, `${name}.requirements`) : {}, ...(own(x, 'timeout') ? { timeout: xs.timeout(x.timeout, `${name}.timeout`) } : {}) };
      const test = definition.tests[name];
      if(own(x,'executionProfile')){test.executionProfile=xs.string(x.executionProfile,`${name}.executionProfile`,64);if(!Object.hasOwn(definition.executionProfiles??{},test.executionProfile))xs.fail(`${name}.executionProfile`,'The execution profile must exist in project.yml.');}
      if(own(x,'affectedFiles')){if(!Array.isArray(x.affectedFiles)||!x.affectedFiles.length||x.affectedFiles.length>32)xs.fail(`${name}.affectedFiles`,'Use 1–32 relative file patterns.');try{test.affectedFiles=[...new Set((x.affectedFiles as unknown[]).map(affectedPattern))];}catch{xs.fail(`${name}.affectedFiles`,'Use relative paths with * or ** segments.');}}
      if (own(x,'browser')) {
        const b=xs.object(x.browser,`${name}.browser`,['engine','baseUrl','config']);
        if(!['browser','e2e'].includes(test.type))xs.fail(`${name}.browser`,'Browser settings require a browser/e2e test.');
        try {test.browser=validateBrowser({engine:b.engine as 'playwright',baseUrl:b.baseUrl as string,config:(b.config??'playwright.config.ts') as string});}
        catch {xs.fail(`${name}.browser`,'Use playwright, a loopback HTTP baseUrl and relative config file.');}
      }
      if (own(x, 'pipeline')) {
        const pipeline = xs.object(x.pipeline, `${name}.pipeline`, ['install', 'build', 'start', 'cleanup']);
        test.pipeline = {};
        for (const [stage, ref] of Object.entries(pipeline)) {
          const reference = xs.string(ref, `${name}.pipeline.${stage}`, 64);
          if (!own(definition.tasks, reference)) xs.fail(`${name}.pipeline.${stage}`, 'The referenced task does not exist.');
          test.pipeline[stage as keyof typeof test.pipeline] = reference;
        }
      }
      if (own(x, 'environment')) {
        test.environment = xs.string(x.environment, `${name}.environment`, 64);
        if (!own(definition.environments, test.environment)) xs.fail(`${name}.environment`, 'The referenced environment profile does not exist.');
      }
      if (own(x, 'env')) test.env = xs.environment(x.env, `${name}.env`);
      if (own(x, 'healthcheck')) {
        const health = xs.object(x.healthcheck, `${name}.healthcheck`, ['url', 'expectedStatus', 'timeout', 'retryInterval']);
        try { test.healthcheck = { ...validateHealth({ url: xs.string(health.url, `${name}.healthcheck.url`, 1024), expectedStatus: (health.expectedStatus ?? 200) as number, retryIntervalMs: (health.retryInterval ?? 1) as number * 1000 }), timeout: own(health, 'timeout') ? xs.timeout(health.timeout, `${name}.healthcheck.timeout`) : 30 }; }
        catch { xs.fail(`${name}.healthcheck`, 'Use loopback HTTP, status 100–599, retry interval 0.1–10 seconds and timeout 1–3600 seconds.'); }
        if (!test.pipeline?.start) xs.fail(`${name}.healthcheck`, 'Health check requires a start task.');
      }
      for (const ref of [task, ...Object.values(test.pipeline ?? {})]) {
        const t = definition.tasks[ref];
        xs.environment({ ...definition.environment, ...(t.environment ? definition.environments[t.environment] : {}), ...t.env, ...(test.environment ? definition.environments[test.environment] : {}), ...test.env }, `${name}.env`);
      }
    }
    return { status: 'Valid', issues: [], definition };
  } catch (error) {
    return { status: 'Invalid', issues: [error instanceof ProtocolError ? error.issue : { file: '.tastedev/project.yml', path: '$', message: 'Protocol could not be validated.' }] };
  }
}


