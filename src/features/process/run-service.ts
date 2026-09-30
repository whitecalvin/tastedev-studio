import { desktopRequired, type ProcessEvent, type ProcessHost, type ProcessSession, type ProcessStartRequest } from './contracts.ts';
import { validateConfiguration, type RunConfiguration } from './configurations.ts';
import { TerminalStore } from './terminal-store.ts';
export type DirtyChoice = 'save' | 'without' | 'cancel';
export async function prepareRun(editor: { dirty(): boolean; saveAll(): Promise<void> }, choose: () => Promise<DirtyChoice>) {
  if (!editor.dirty()) return true;
  const choice = await choose(); if (choice === 'cancel') return false;
  if (choice === 'save') { await editor.saveAll(); if (editor.dirty()) throw new Error('Files changed while saving. Review remaining unsaved edits before running.'); }
  return true;
}
const active = (session: ProcessSession | null) => !!session && ['starting', 'running', 'stopping'].includes(session.status);
export class RunService {
  readonly terminal = new TerminalStore();
  readonly output = new TerminalStore('Output');
  readonly host: ProcessHost;
  private unsubscribe: (() => void) | null = null;
  private listeners = new Set<() => void>();
  private lastSequence = -1;
  private disposed = false;
  private mode: ProcessStartRequest['terminalMode'] = 'output';
  private value: { session: ProcessSession | null; message: string } = { session: null, message: '' };
  constructor(host: ProcessHost) { this.host = host; }
  snapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(message = this.value.message, session = this.value.session) { this.value = { session, message }; for (const listener of this.listeners) listener(); }
  private destination() { return this.mode === 'pty' ? this.terminal : this.output; }
  private detach() { this.unsubscribe?.(); this.unsubscribe = null; }
  private finish(status: 'exited' | 'failed', exitCode: number | null, message: string) {
    if (!this.value.session) return;
    this.detach(); this.destination().end(); this.output.append('system', message + '\r\n');
    this.publish(message, { ...this.value.session, status, exitCode, finishedAt: new Date().toISOString() });
  }
  private event = (event: ProcessEvent) => {
    const session = this.value.session;
    if (this.disposed || !session || event.sessionId !== session.id || event.sequence <= this.lastSequence || !active(session)) return;
    this.lastSequence = event.sequence;
    switch (event.type) {
      case 'started': if (session.status === 'starting') this.publish('Process running.', { ...session, status: 'running', startedAt: new Date().toISOString() }); break;
      case 'stdout': case 'stderr': this.destination().append(event.type, event.data); break;
      case 'exited': this.finish('exited', event.exitCode, `Process exited with code ${event.exitCode}.${event.exitCode !== 0 ? ' Review output before retrying.' : ''}`); break;
      case 'stopped': this.finish('exited', null, 'Process stopped.'); break;
      case 'failed': this.finish('failed', null, event.reason === 'stream' ? 'Process output failed. Review the runtime and retry.' : event.reason === 'start' ? 'Process could not start. Check executable and workspace access.' : 'Process ended unexpectedly. Review output before retrying.'); break;
    }
  };
  async start(configuration: RunConfiguration, projectId: string, workspaceId: string | null, checkCwd?: (path: string) => Promise<void>) {
    if (this.disposed) throw new Error('Run session is closed.');
    if (active(this.value.session)) return false;
    const config = validateConfiguration(configuration);
    if (!this.host.capabilities.process || (config.type === 'terminal' && !this.host.capabilities.pty)) { this.output.append('system', desktopRequired + '\r\n'); this.publish(desktopRequired); return false; }
    const id = crypto.randomUUID(); this.lastSequence = -1; this.mode = config.type === 'terminal' ? 'pty' : 'output';
    this.publish('Starting process…', { id, name: config.name, configurationId: configuration.id, status: 'starting', startedAt: null, finishedAt: null, exitCode: null });
    this.destination().associate(id, config.name); this.unsubscribe = this.host.subscribe(this.event);
    try {
      if (!workspaceId) throw new Error('Workspace unavailable');
      await checkCwd?.(config.cwd);
      if (this.disposed || this.value.session?.status !== 'starting') return false;
      await this.host.start(id, { command: config.command, args: config.args, cwd: config.cwd, environment: config.env, terminalMode: this.mode, runConfigurationId: configuration.id, projectId, workspaceId });
      if (this.disposed) await this.host.stop(id);
      return true;
    } catch { if (!this.disposed && active(this.value.session)) this.finish('failed', null, 'Process could not start. Check the executable, workspace connection and relative working directory.'); return false; }
  }
  async stop() {
    const session = this.value.session; if (!active(session) || !session || session.status === 'stopping') return;
    const previous = session.status; this.publish('Stopping process…', { ...session, status: 'stopping' });
    try { await this.host.stop(session.id); if (!this.disposed && active(this.value.session)) this.finish('exited', null, 'Process stopped.'); }
    catch { if (!this.disposed && this.value.session?.status === 'stopping') this.publish('Stop failed. The process may still be active. Retry Stop.', { ...this.value.session, status: previous }); }
  }
  async input(data: string) { const s = this.value.session; if (!s || s.status !== 'running' || this.mode !== 'pty') return; try { await this.host.write(s.id, data); } catch { this.publish('Terminal input failed. Retry or stop the process.'); } }
  async resize(columns: number, rows: number) { const s = this.value.session; if (!s || !active(s) || this.mode !== 'pty' || !Number.isInteger(columns) || !Number.isInteger(rows) || columns < 2 || rows < 1) return; try { await this.host.resize(s.id, columns, rows); } catch { this.publish('Terminal resize failed. Resize again or stop the process.'); } }
  async closeTerminal() { if (this.mode === 'pty' && active(this.value.session)) { await this.stop(); if (active(this.value.session)) return false; } this.terminal.close(); return true; }
  async dispose() { if (this.disposed) return; this.disposed = true; const s = this.value.session; this.detach(); this.listeners.clear(); this.terminal.close(); this.output.close(); if (s && active(s)) await this.host.stop(s.id); }
}
