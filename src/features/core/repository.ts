import type { Agent, Artifact, CoreEvent, CoreSnapshot, Job, Run, RunStep } from './domain.ts';
export interface EntityRepository<T extends { id: string }> { get(id: string): T | undefined; list(): T[]; save(value: T): void; remove(id: string): void }
export type AgentRepository = EntityRepository<Agent>;
export type JobRepository = EntityRepository<Job>;
export type RunRepository = EntityRepository<Run>;
export type ArtifactRepository = EntityRepository<Artifact>;
export interface CoreRepositories { agents: AgentRepository; jobs: JobRepository; runs: RunRepository; steps: EntityRepository<RunStep>; artifacts: ArtifactRepository; events: EntityRepository<CoreEvent> }
export interface CoreRepository { read(): CoreSnapshot; transaction<T>(operation: (repositories: CoreRepositories) => T): T; subscribe(listener: () => void): () => void; revision(): number }
const empty = (): CoreSnapshot => ({ agents: [], jobs: [], runs: [], steps: [], artifacts: [], events: [] });
function repository<T extends {id: string}>(rows: T[]): EntityRepository<T> { return {
  get: id => rows.find(row => row.id === id), list: () => rows,
  save(value) { const index = rows.findIndex(row => row.id === value.id); if (index < 0) rows.push(value); else rows[index] = value; },
  remove(id) { const index = rows.findIndex(row => row.id === id); if (index >= 0) rows.splice(index, 1); },
}; }
/** One synchronous transaction publishes the entire state, or nothing on failure.
 * Session memory only; a server repository must supply the equivalent atomic unit of work. */
export class InMemoryCoreRepository implements CoreRepository {
  private state = empty(); private version = 0; private listeners = new Set<() => void>();
  private commit?: (state: CoreSnapshot, revision: number) => void;
  constructor(initial: CoreSnapshot = empty(), commit?: (state: CoreSnapshot, revision: number) => void, revision = 0) {
    this.state = structuredClone(initial); this.version = revision; this.commit = commit;
  }
  read() { return structuredClone(this.state); }
  revision = () => this.version;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  transaction<T>(operation: (repositories: CoreRepositories) => T): T {
    const draft = structuredClone(this.state);
    const result = operation({ agents: repository(draft.agents), jobs: repository(draft.jobs), runs: repository(draft.runs), steps: repository(draft.steps), artifacts: repository(draft.artifacts), events: repository(draft.events) });
    if (result instanceof Promise) throw new Error('Core transactions must be synchronous.');
    const detached = structuredClone(result);
    draft.events = draft.events.slice(-1000);
    // A durable adapter must commit successfully before memory or observers change.
    this.commit?.(draft, this.version + 1);
    this.state = structuredClone(draft); this.version++;
    for (const listener of this.listeners) { try { listener(); } catch { /* Observer failure cannot undo a committed transaction. */ } }
    return detached;
  }
}
