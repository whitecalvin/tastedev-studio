import {activeRun,type Agent,type Artifact,type CoreEvent,type CoreSnapshot,type Job,type Run,type RunStep} from './domain.ts';
export interface EntityRepository<T extends { id: string }> { get(id: string): T | undefined; list(): T[]; save(value: T): void; remove(id: string): void }
export type AgentRepository = EntityRepository<Agent>;
export type JobRepository = EntityRepository<Job>;
export type RunRepository = EntityRepository<Run>;
export type ArtifactRepository = EntityRepository<Artifact>;
export interface CoreRepositories { agents: AgentRepository; jobs: JobRepository; runs: RunRepository; steps: EntityRepository<RunStep>; artifacts: ArtifactRepository; events: EntityRepository<CoreEvent> }
export interface CoreRepository { read(): CoreSnapshot; readEntity?<K extends keyof CoreSnapshot>(kind:K,id:string):CoreSnapshot[K][number]|undefined;readActiveRuns?():Run[]; readProject?(projectId:string,terminalLimit?:number,runId?:string):CoreSnapshot;readRows?<K extends keyof CoreSnapshot>(kind:K):CoreSnapshot[K]; transaction<T>(operation: (repositories: CoreRepositories) => T): T; subscribe(listener: () => void): () => void; revision(): number }
const empty = (): CoreSnapshot => ({ agents: [], jobs: [], runs: [], steps: [], artifacts: [], events: [] });
function immutable<T>(value:T):T {if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))immutable(child);Object.freeze(value);}return value;}
/** Clone only entities exposed to the operation. A list deliberately materializes
 * its whole collection because callers may mutate returned rows. Sealing removes
 * unchanged clones and detaches changed rows from retained transaction handles. */
function draftRepository<T extends {id: string}>(original: T[]) {
  const rows=original.slice(),exposed=new Set<T>();
  function expose(index:number){const row=rows[index];if(!exposed.has(row)){const copy=structuredClone(row);exposed.add(copy);rows[index]=copy;}return rows[index];}
  const access:EntityRepository<T>={
    get(id){const index=rows.findIndex(row=>row.id===id);return index<0?undefined:expose(index);},
    list(){for(let i=0;i<rows.length;i++)expose(i);return rows;},
    save(value){const copy=structuredClone(value),index=rows.findIndex(row=>row.id===value.id);exposed.add(copy);if(index<0)rows.push(copy);else rows[index]=copy;},
    remove(id){const index=rows.findIndex(row=>row.id===id);if(index>=0)rows.splice(index,1);},
  };
  return {access,seal(){const before=new Map(original.map(row=>[row.id,row]));return rows.map(row=>{if(!exposed.has(row))return row;const prior=before.get(row.id);return prior&&JSON.stringify(prior)===JSON.stringify(row)?prior:structuredClone(row);});}};
}
/** One synchronous transaction publishes the entire state, or nothing on failure.
 * Session memory only; a server repository must supply the equivalent atomic unit of work. */
export class InMemoryCoreRepository implements CoreRepository {
  private state = empty(); private version = 0; private listeners = new Set<() => void>();
  private commit?: (state: CoreSnapshot, revision: number, before:CoreSnapshot) => void;
  private writing=false;
  constructor(initial: CoreSnapshot = empty(), commit?: (state: CoreSnapshot, revision: number, before:CoreSnapshot) => void, revision = 0) {
    this.state = immutable(structuredClone(initial)); this.version = revision; this.commit = commit;
  }
  read() { return structuredClone(this.state); }
  readEntity<K extends keyof CoreSnapshot>(kind:K,id:string):CoreSnapshot[K][number]|undefined {return structuredClone(this.state[kind].find(row=>row.id===id));}
  readActiveRuns(){return structuredClone(this.state.runs.filter(activeRun));}
  readRows<K extends keyof CoreSnapshot>(kind:K):CoreSnapshot[K] {return structuredClone(this.state[kind]);}
  /** Select before cloning: unrelated projects and excluded terminal payloads never
   * enter the detached result. Transactions retain the existing atomic isolation. */
  readProject(projectId:string,terminalLimit?:number,runId?:string):CoreSnapshot {
    if(terminalLimit!==undefined&&(!Number.isInteger(terminalLimit)||terminalLimit<1||terminalLimit>1000))throw Error('Invalid live history limit.');
    let runs=this.state.runs.filter(r=>r.projectId===projectId&&(!runId||r.id===runId));
    if(terminalLimit!==undefined){const selected=new Set([...runs.filter(activeRun),...runs.filter(r=>!activeRun(r)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).slice(0,terminalLimit)].map(r=>r.id));runs=runs.filter(r=>selected.has(r.id));}
    const runIds=new Set(runs.map(r=>r.id)),jobIds=new Set(runs.map(r=>r.jobId));
    if(terminalLimit!==undefined)for(const j of this.state.jobs.filter(j=>j.projectId===projectId&&!['queued','assigned','running'].includes(j.status)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).slice(0,terminalLimit))jobIds.add(j.id);
    const jobs=this.state.jobs.filter(j=>j.projectId===projectId&&(runId?jobIds.has(j.id):terminalLimit===undefined||jobIds.has(j.id)||['queued','assigned','running'].includes(j.status)));
    // Authorization filters global Agent events in CoreService before the live
    // window is applied. Truncating here could hide earlier authorized events.
    const events=this.state.events.filter(e=>e.projectId===projectId||!e.projectId);
    return structuredClone({agents:this.state.agents,jobs,runs,steps:this.state.steps.filter(s=>runIds.has(s.runId)),artifacts:this.state.artifacts.filter(a=>runIds.has(a.runId)),events});
  }
  revision = () => this.version;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  transaction<T>(operation: (repositories: CoreRepositories) => T): T {
    if(this.writing)throw Error('Nested Core transactions are not allowed.');
    this.writing=true;
    try {
    const agents=draftRepository(this.state.agents),jobs=draftRepository(this.state.jobs),runs=draftRepository(this.state.runs),steps=draftRepository(this.state.steps),artifacts=draftRepository(this.state.artifacts),events=draftRepository(this.state.events);
    const result = operation({agents:agents.access,jobs:jobs.access,runs:runs.access,steps:steps.access,artifacts:artifacts.access,events:events.access});
    if (result instanceof Promise) throw new Error('Core transactions must be synchronous.');
    const detached = structuredClone(result);
    const draft:CoreSnapshot=immutable({agents:agents.seal(),jobs:jobs.seal(),runs:runs.seal(),steps:steps.seal(),artifacts:artifacts.seal(),events:events.seal().slice(-1000)});
    // A durable adapter must commit successfully before memory or observers change.
    this.commit?.(draft, this.version + 1,this.state);
    this.state = draft; this.version++;
    this.writing=false;
    for (const listener of this.listeners) { try { listener(); } catch { /* Observer failure cannot undo a committed transaction. */ } }
    return detached;
    } finally {this.writing=false;}
  }
}
