export interface OutputChunk { sequence: number; stream: 'stdout' | 'stderr' | 'system'; data: string }
export interface TerminalSession { id: string; name: string; processSessionId: string | null; status: 'idle' | 'active' | 'ended' | 'closed'; createdAt: string }
export const OUTPUT_LIMIT = 200_000;
export class TerminalStore {
  private listeners = new Set<() => void>();
  private sequence = 0;
  private value: { session: TerminalSession; chunks: OutputChunk[]; revision: number; truncated: boolean };
  constructor(name = 'Terminal') { this.value = { session: { id: crypto.randomUUID(), name, processSessionId: null, status: 'idle', createdAt: new Date().toISOString() }, chunks: [], revision: 0, truncated: false }; }
  snapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { for (const listener of this.listeners) listener(); }
  associate(processSessionId: string, name: string) { this.value = { ...this.value, session: { ...this.value.session, name, processSessionId, status: 'active' } }; this.emit(); }
  end() { this.value = { ...this.value, session: { ...this.value.session, status: 'ended' } }; this.emit(); }
  append(stream: OutputChunk['stream'], data: string) {
    if (this.value.session.status === 'closed' || !data) return;
    let chunks = [...this.value.chunks, { sequence: ++this.sequence, stream, data: data.slice(-OUTPUT_LIMIT) }];
    let size = chunks.reduce((sum, c) => sum + c.data.length, 0), truncated = this.value.truncated || data.length > OUTPUT_LIMIT;
    while (chunks.length > 1000 || (size > OUTPUT_LIMIT && chunks.length > 1)) { size -= chunks[0].data.length; chunks = chunks.slice(1); truncated = true; }
    this.value = { ...this.value, chunks, truncated }; this.emit();
  }
  clear() { this.value = { ...this.value, chunks: [], revision: this.value.revision + 1, truncated: false }; this.emit(); }
  close() { this.clear(); this.value = { ...this.value, session: { ...this.value.session, status: 'closed' } }; this.emit(); this.listeners.clear(); }
}
