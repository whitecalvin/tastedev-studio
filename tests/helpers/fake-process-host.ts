import type { ProcessEvent, ProcessHost, ProcessStartRequest } from '../../src/features/process/contracts.ts';
export class FakeProcessHost implements ProcessHost {
  readonly capabilities = { process: true, pty: true };
  readonly requests: ProcessStartRequest[] = [];
  readonly inputs: string[] = [];
  readonly sizes: { columns: number; rows: number }[] = [];
  readonly stops: string[] = [];
  listeners = new Set<(event: ProcessEvent) => void>();
  sessionId = ''; sequence = 0; failStart = false; failStop = false; failInput = false; failResize = false;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  subscribe(listener: (event: ProcessEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  emit(event: Omit<Extract<ProcessEvent, { type: 'stdout' | 'stderr' }>, 'sessionId' | 'sequence'> | Omit<Extract<ProcessEvent, { type: 'exited' }>, 'sessionId' | 'sequence'> | { type: 'started' | 'stopped' } | { type: 'failed'; reason: 'start' | 'stream' | 'unexpected-exit' }) {
    const value = { ...event, sessionId: this.sessionId, sequence: ++this.sequence } as ProcessEvent;
    for (const listener of this.listeners) listener(value);
  }
  async start(id: string, request: ProcessStartRequest) { this.sessionId = id; this.sequence = 0; this.requests.push(structuredClone(request)); if (this.failStart) throw new Error('sensitive host error must not leak'); this.emit({ type: 'started' }); }
  delayed(data: string, ms = 5) { const timer = setTimeout(() => { this.timers.delete(timer); this.emit({ type: 'stdout', data }); }, ms); this.timers.add(timer); }
  async stop(id: string) { this.stops.push(id); if (this.failStop) throw new Error('stop failure'); for (const timer of this.timers) clearTimeout(timer); this.timers.clear(); this.emit({ type: 'stopped' }); }
  async write(_id: string, data: string) { if (this.failInput) throw new Error('input failure'); this.inputs.push(data); }
  async resize(_id: string, columns: number, rows: number) { if (this.failResize) throw new Error('resize failure'); this.sizes.push({ columns, rows }); }
}
