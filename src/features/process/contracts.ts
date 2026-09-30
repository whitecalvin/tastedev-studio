export type ProcessStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'exited' | 'failed';
export interface RuntimeCapabilities { filesystem: boolean; process: boolean; pty: boolean; git: boolean }
export interface ProcessStartRequest {
  command: string; args: string[]; cwd: string; environment: Record<string, string>;
  terminalMode: 'pty' | 'output'; runConfigurationId: string; projectId: string; workspaceId: string | null;
}
export interface ProcessSession {
  id: string; configurationId: string; name: string; status: ProcessStatus;
  startedAt: string | null; finishedAt: string | null; exitCode: number | null;
}
export type ProcessEvent = { sessionId: string; sequence: number } & (
  { type: 'started' } | { type: 'stdout' | 'stderr'; data: string } |
  { type: 'exited'; exitCode: number } | { type: 'stopped' } |
  { type: 'failed'; reason: 'start' | 'stream' | 'unexpected-exit' }
);
// Subscribe before start. IDs are caller-generated; per-session sequences strictly
// increase. stop must also cancel a pending start, and resolves after termination.
// exited/stopped/failed are terminal events: the adapter has released the process,
// stream and PTY resources before emitting them. I/O command failures reject their call.
// Implementations must resolve cwd within the authorized workspace, never a shell string.
export interface ProcessHost {
  capabilities: Pick<RuntimeCapabilities, 'process' | 'pty'>;
  subscribe(listener: (event: ProcessEvent) => void): () => void;
  start(sessionId: string, request: ProcessStartRequest): Promise<void>;
  stop(sessionId: string): Promise<void>;
  write(sessionId: string, data: string): Promise<void>;
  resize(sessionId: string, columns: number, rows: number): Promise<void>;
}
export const desktopRequired = 'Local process execution requires the TASTEDEV Studio desktop runtime.';
export class WebUnavailableProcessHost implements ProcessHost {
  readonly capabilities = { process: false, pty: false };
  subscribe() { return () => {}; }
  async start(): Promise<void> { throw new Error(desktopRequired); }
  async stop(): Promise<void> { throw new Error(desktopRequired); }
  async write(): Promise<void> { throw new Error(desktopRequired); }
  async resize(): Promise<void> { throw new Error(desktopRequired); }
}
