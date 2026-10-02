import { CoreError, type Agent, type AgentCapability, type Job, type JobPayload, type JobRequirement } from './domain.ts';
import { validateSource, validateHealth, validateBrowser } from './test-plan.ts';
const platforms = ['windows', 'linux', 'macos'], architectures = ['x86_64', 'arm64'], runtimes = ['node', 'java', 'python', 'rust', 'git', 'playwright'], browsers = ['chromium', 'firefox', 'webkit'];
const version = (s: string) => /^\d{1,4}(?:\.\d{1,4}){0,2}$/.test(s);
// Java's runtime version can include an update component, e.g. 25.0.4.1.
// Requirements retain the existing >=major.minor.patch contract.
const runtimeVersion = (runtime: string, value: string) => runtime === 'java' ? /^\d{1,4}(?:\.\d{1,4}){0,3}$/.test(value) : version(value);
export function text(value: string, label: string, max = 120) { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) throw new CoreError(`${label} is invalid.`); return value.trim(); }
function positive(value: number) { return Number.isSafeInteger(value) && value > 0; }
export function validateCapabilities(c: AgentCapability): AgentCapability {
  if (!c || (c.sourceSnapshot!==undefined&&c.sourceSnapshot!==2) || !positive(c.cpuCores) || !positive(c.memoryMiB) || !['docker','gpu','pty'].every(k => typeof c[k as 'docker'] === 'boolean') || !Array.isArray(c.browsers) || c.browsers.some(b => !browsers.includes(b)) || !c.runtimes || Object.entries(c.runtimes).some(([key, v]) => !runtimes.includes(key) || typeof v !== 'string' || !runtimeVersion(key, v))) throw new CoreError('Capabilities must contain valid structured hardware and runtime versions.');
  return { ...(c.sourceSnapshot===2?{sourceSnapshot:2 as const}:{}), cpuCores: c.cpuCores, memoryMiB: c.memoryMiB, docker: c.docker, gpu: c.gpu, pty: c.pty, runtimes: { ...c.runtimes }, browsers: [...new Set(c.browsers)] };
}
export function validateAgent(a: Pick<Agent, 'name' | 'platform' | 'architecture' | 'capabilities'>) {
  if (!platforms.includes(a.platform) || !architectures.includes(a.architecture)) throw new CoreError('Unsupported platform or architecture.');
  return { name: text(a.name, 'Agent name'), platform: a.platform, architecture: a.architecture, capabilities: validateCapabilities(a.capabilities) };
}
export function validateRequirements(r: JobRequirement): JobRequirement {
  if (!r || (r.sourceSnapshot!==undefined&&r.sourceSnapshot!==2) || (r.platform !== undefined && !platforms.includes(r.platform)) || (r.architecture !== undefined && !architectures.includes(r.architecture)) || (r.browser !== undefined && !browsers.includes(r.browser)) || (r.cpuCores !== undefined && !positive(r.cpuCores)) || (r.memoryMiB !== undefined && !positive(r.memoryMiB)) || (r.docker !== undefined && r.docker !== 'required') || (r.pty !== undefined && r.pty !== 'required') || (r.gpu !== undefined && !['required','optional'].includes(r.gpu)) || (r.runtimes !== undefined && Object.entries(r.runtimes).some(([key,v]) => !runtimes.includes(key) || typeof v !== 'string' || !v.startsWith('>=') || !version(v.slice(2))))) throw new CoreError('Invalid requirements. Runtime ranges support >=major.minor.patch only.');
  return { ...(r.sourceSnapshot===2?{sourceSnapshot:2 as const}:{}), platform: r.platform, architecture: r.architecture, cpuCores: r.cpuCores, memoryMiB: r.memoryMiB, docker: r.docker, gpu: r.gpu, pty: r.pty, runtimes: r.runtimes ? {...r.runtimes} : undefined, browser: r.browser };
}
export function validatePayload(payload: JobPayload): JobPayload {
  if (!payload || !Array.isArray(payload.steps) || !payload.steps.length || payload.steps.length > 30) throw new CoreError('A task needs between 1 and 30 structured steps.');
  const steps = payload.steps.map(s => {
    const cwd = text(s.cwd, 'Working directory', 240);
    if (cwd !== '.' && (/^[\\/]|^[a-z]:/i.test(cwd) || cwd.split(/[\\/]/).includes('..'))) throw new CoreError('Working directory must stay relative to the project.');
    if (!Array.isArray(s.args) || s.args.length > 100 || s.args.some(a => typeof a !== 'string' || a.length > 1024 || /[\x00-\x1f]/.test(a))) throw new CoreError('Arguments must be a bounded string array.');
    if(s.timeoutMs!==undefined&&(!Number.isInteger(s.timeoutMs)||s.timeoutMs<100||s.timeoutMs>3600000))throw new CoreError('Timeout must be 100–3600000 milliseconds.');
    if(s.env!==undefined&&(!s.env||Array.isArray(s.env)||typeof s.env!=='object'||Object.keys(s.env).length>32||Object.entries(s.env).some(([k,v])=>!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k)||typeof v!=='string'||v.length>4096||v.includes('\0'))))throw new CoreError('Invalid environment overrides.');
    if (s.stage && !['source','install','build','start','healthcheck','test','cleanup'].includes(s.stage)) throw new CoreError('Invalid pipeline stage.');
    if ((s.source && s.stage !== 'source') || (s.healthcheck && s.stage !== 'healthcheck') || (s.browser && s.stage !== 'test')) throw new CoreError('Operation does not match the stage.');
    return { name: text(s.name, 'Step name'), executable: text(s.executable, 'Executable', 240), args: [...s.args], cwd, ...(s.env?{env:{...s.env}}:{}),...(s.timeoutMs!==undefined?{timeoutMs:s.timeoutMs}:{}), ...(s.stage ? { stage:s.stage } : {}), ...(s.taskReference ? { taskReference:text(s.taskReference,'Task reference',64) } : {}), ...(s.browser ? {browser:validateBrowser(s.browser)} : {}), ...(s.source ? { source:validateSource(s.source) } : {}), ...(s.healthcheck ? { healthcheck:validateHealth(s.healthcheck) } : {}) };
  });
  let testPlan;
  if (payload.testPlan) {
    const p = payload.testPlan; if(steps.some(s=>s.source?.provider==='snapshot'&&s.source.snapshot.schemaVersion===2)&&p.requirements.sourceSnapshot!==2)throw new CoreError('Workspace snapshot v2 requires a compatible Agent.');
    if (!['unit','integration','api','browser','e2e'].includes(p.type) || !Number.isInteger(p.timeout) || p.timeout < 1000 || p.timeout > 3600000) throw new CoreError('Invalid TestPlan type or timeout.');
    const order = ['source','install','build','start','healthcheck','test','cleanup'];
    let previous = -1;
    for (const step of steps) {
      const index = order.indexOf(step.stage ?? '');
      if (index <= previous || index < 0 || step.stage === 'source' && !step.source || step.stage === 'healthcheck' && !step.healthcheck) throw new CoreError('Pipeline steps must be unique and ordered.');
      previous = index;
    }
    if (!steps.some(s=>s.stage==='test') || steps.at(-1)?.stage !== 'cleanup' || steps.some(s=>s.stage==='healthcheck') && !steps.some(s=>s.stage==='start')) throw new CoreError('Pipeline requires test, cleanup and a start before health check.');
    if(steps.some(s=>s.browser)&&(!['browser','e2e'].includes(p.type)||p.requirements.browser!=='chromium'||!p.requirements.runtimes?.playwright))throw new CoreError('Browser pipeline requires Chromium and Playwright capabilities.');
    testPlan = { id:text(p.id,'Plan ID',100), projectId:text(p.projectId,'Project ID',100), testName:text(p.testName,'Test name',64), type:p.type, timeout:p.timeout, requirements:validateRequirements(p.requirements), environment:{...steps.find(s=>s.stage==='test')?.env}, steps };
  } else if (steps.some(s=>s.stage)) throw new CoreError('Pipeline steps require a TestPlan.');
  return { task:text(payload.task,'Task'), steps, ...(testPlan ? { testPlan } : {}) };
}
function atLeast(actual: string, minimum: string) { const a = actual.split('.').map(Number), b = minimum.split('.').map(Number); for (let i=0;i<3;i++) { if ((a[i]??0)!==(b[i]??0)) return (a[i]??0)>(b[i]??0); } return true; }
export function matchAgent(agent: Agent, requirements: JobRequirement) {
  const reasons: string[] = []; if(requirements.sourceSnapshot===2&&agent.capabilities.sourceSnapshot!==2)reasons.push('Workspace snapshot v2 unavailable');
  if (!['online','idle'].includes(agent.status)) reasons.push(`Agent is ${agent.status}`);
  if (requirements.platform && agent.platform !== requirements.platform) reasons.push('OS mismatch');
  if (requirements.architecture && agent.architecture !== requirements.architecture) reasons.push('Architecture mismatch');
  for (const key of ['cpuCores','memoryMiB'] as const) if (requirements[key] && agent.capabilities[key] < requirements[key]) reasons.push(`${key} insufficient`);
  for (const key of ['docker','gpu','pty'] as const) if (requirements[key] === 'required' && !agent.capabilities[key]) reasons.push(`${key} unavailable`);
  if (requirements.browser && !agent.capabilities.browsers.includes(requirements.browser)) reasons.push('Browser unavailable');
  for (const [key, minimum] of Object.entries(requirements.runtimes ?? {})) { const actual = agent.capabilities.runtimes[key as keyof AgentCapability['runtimes']]; if (!actual || !atLeast(actual, minimum.slice(2))) reasons.push(`${key} version insufficient`); }
  return { agentId: agent.id, matches: reasons.length === 0, reasons };
}
export interface SchedulingStrategy { jobs(jobs: Job[]): Job[]; agents(agents: Agent[]): Agent[] }
export const defaultStrategy: SchedulingStrategy = {
  jobs: jobs => [...jobs].sort((a,b) => b.priority-a.priority || a.queuedAt.localeCompare(b.queuedAt)),
  agents: agents => [...agents].sort((a,b) => Number(b.status==='idle')-Number(a.status==='idle') || a.createdAt.localeCompare(b.createdAt)),
};



