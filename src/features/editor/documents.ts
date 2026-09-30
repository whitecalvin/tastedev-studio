import { FileError } from '../filesystem/contracts.ts';
import { containsPath, normalizePath } from '../filesystem/paths.ts';
import { detectLanguage } from './policy.ts';
import type { WorkspaceFileService } from '../filesystem/file-service.ts';
export interface EditorDocument { id: string; path: string; name: string; content: string; savedContent: string; language: string }
export interface DocumentState { openEditors: EditorDocument[]; activeEditorId: string | null; dirtyEditors: string[] }
export type CloseChoice = 'save' | 'discard' | 'cancel';
export class Documents {
  selection: {path:string;text:string;start:number} | undefined;
  revealLine: number | undefined;
  reveal(line:number){this.revealLine=line;this.update(this.state.openEditors);}
  private files: WorkspaceFileService;
  private state: DocumentState = { openEditors: [], activeEditorId: null, dirtyEditors: [] };
  private listeners = new Set<() => void>();
  constructor(files: WorkspaceFileService) { this.files = files; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private update(editors: EditorDocument[], active = this.state.activeEditorId) { this.state = { openEditors: editors, activeEditorId: active, dirtyEditors: editors.filter(d => d.content !== d.savedContent).map(d => d.id) }; this.listeners.forEach(fn => fn()); }
  get(id: string) { const doc = this.state.openEditors.find(d => d.id === id); if (!doc) throw new FileError('document', 'This editor is no longer open.'); return doc; }
  activate(id: string) { this.get(id); this.update(this.state.openEditors, id); }
  async open(path: string) {
    const normalized = normalizePath(path), existing = this.state.openEditors.find(d => d.path === normalized);
    if (existing) { this.activate(existing.id); return; }
    const file = await this.files.read(normalized);
    // Recheck after IO so overlapping opens never duplicate a tab.
    const concurrent = this.state.openEditors.find(d => d.path === normalized); if (concurrent) { this.activate(concurrent.id); return; }
    const doc: EditorDocument = { id: crypto.randomUUID(), path: normalized, name: normalized.split('/').pop()!, content: file.content, savedContent: file.content, language: detectLanguage(normalized) };
    this.update([...this.state.openEditors, doc], doc.id);
  }
  edit(id: string, content: string) { this.update(this.state.openEditors.map(d => d.id === id ? { ...d, content } : d)); }
  async save(id: string) {
    const doc = this.get(id); if (doc.content === doc.savedContent) return;
    const content = doc.content;
    await this.files.write(doc.path, content, doc.savedContent);
    this.update(this.state.openEditors.map(d => d.id === id ? { ...d, savedContent: content } : d));
  }
  async saveAll() { const failures: string[] = []; for (const id of [...this.state.dirtyEditors]) { try { await this.save(id); } catch (error) { failures.push(`${this.get(id).path}: ${error instanceof Error ? error.message : 'Save failed'}`); } } return failures; }
  async close(id: string, choice: CloseChoice = 'cancel') {
    const doc = this.get(id);
    if (doc.content !== doc.savedContent) { if (choice === 'cancel') return false; if (choice === 'save') { await this.save(id); if (this.state.dirtyEditors.includes(id)) throw new FileError('dirty', 'The file changed while saving. Review it before closing.'); } }
    const index = this.state.openEditors.findIndex(d => d.id === id), rest = this.state.openEditors.filter(d => d.id !== id);
    this.update(rest, this.state.activeEditorId === id ? (rest[Math.min(index, rest.length - 1)]?.id ?? null) : this.state.activeEditorId); return true;
  }
  async reload(id: string, discard = false) { const doc = this.get(id); if (doc.content !== doc.savedContent && !discard) throw new FileError('dirty', 'Reload would discard unsaved changes.'); const file = await this.files.read(doc.path); if (this.get(id).content !== doc.content) throw new FileError('dirty', 'The document changed during reload. Your edits are preserved.'); this.update(this.state.openEditors.map(d => d.id === id ? { ...d, content: file.content, savedContent: file.content } : d)); }
  renamed(source: string, target: string) { this.update(this.state.openEditors.map(d => { if (!containsPath(source, d.path)) return d; const path = target + d.path.slice(source.length); return { ...d, path, name: path.split('/').pop()!, language: detectLanguage(path) }; })); }
  removed(path: string) { const remaining = this.state.openEditors.filter(d => !containsPath(path, d.path)); this.update(remaining, remaining.some(d => d.id === this.state.activeEditorId) ? this.state.activeEditorId : remaining[0]?.id ?? null); }
  clear() { this.selection=undefined; this.revealLine=undefined; this.update([], null); }
}
