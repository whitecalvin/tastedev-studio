import { FileError, type FileSystemHost, type FolderConnection, type FileEntry, type Permission } from './contracts.ts';
import { normalizePath, nonRoot, parentPath } from './paths.ts';
import { checkFile, decodeText } from '../editor/policy.ts';
import { HandleStore } from './handle-store.ts';

export interface RuntimeDirectory extends FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>;
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<RuntimeDirectory>;
}
type PickerWindow = Window & { showDirectoryPicker?: (options: { mode: 'readwrite'; id: string }) => Promise<RuntimeDirectory> };
type Stored = { handle: RuntimeDirectory; persistent: boolean };
export class WebFileSystemHost implements FileSystemHost {
  private roots = new Map<string, Stored>();
  private projects = new Map<string, string>();
  private store = new HandleStore();
  supported() { return typeof window !== 'undefined' && window.isSecureContext && typeof (window as PickerWindow).showDirectoryPicker === 'function'; }
  private root(id: string) { const value = this.roots.get(id); if (!value) throw new FileError('access', 'No authorized folder is connected. Connect the folder again.'); return value; }
  private async info(id: string): Promise<FolderConnection> { const value = this.root(id); return { id, name: value.handle.name, permission: await this.permission(id), persistent: value.persistent }; }
  async selectDirectory() {
    if (!this.supported()) throw new FileError('unsupported', 'Folder access is unsupported here. Open Studio in a secure desktop Chrome or Edge browser.');
    // Invoke before any await to preserve the browser's user-activation requirement.
    let handle: RuntimeDirectory;
    try { handle = await (window as PickerWindow).showDirectoryPicker!({ mode: 'readwrite', id: 'tastedev-workspace' }); }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new FileError('picker-aborted', `Folder connection did not complete. The picker was dismissed or the browser did not grant access. Browser detail: ${error.name}: ${error.message || 'No additional detail provided.'}`);
      throw error;
    }
    const id = crypto.randomUUID(); this.roots.set(id, { handle, persistent: false }); return this.info(id);
  }
  async restore(projectId: string) {
    const existing = this.projects.get(projectId); if (existing && this.roots.has(existing)) return this.info(existing);
    if (!this.supported()) return null;
    let handle: FileSystemDirectoryHandle | undefined;
    try { handle = await this.store.get(projectId); } catch { return null; }
    if (!handle) return null;
    const id = crypto.randomUUID(); this.roots.set(id, { handle: handle as RuntimeDirectory, persistent: true }); this.projects.set(projectId, id); return this.info(id);
  }
  async bind(projectId: string, connectionId: string) {
    const value = this.root(connectionId);
    try { await this.store.put(projectId, value.handle); value.persistent = true; } catch { value.persistent = false; }
    const previous = this.projects.get(projectId); if (previous && previous !== connectionId) this.roots.delete(previous);
    this.projects.set(projectId, connectionId); return this.info(connectionId);
  }
  async sameDirectory(connectionId: string, projectId: string) {
    const existing = await this.restore(projectId); return !!existing && this.root(connectionId).handle.isSameEntry(this.root(existing.id).handle);
  }
  async permission(id: string, request = false): Promise<Permission> {
    const handle = this.root(id).handle;
    try { return await (request ? handle.requestPermission({ mode: 'readwrite' }) : handle.queryPermission({ mode: 'readwrite' })); }
    catch { return 'unavailable'; }
  }
  async disconnect(projectId: string, id: string) {
    // Do not report disconnect complete if the persisted association could not be removed.
    if (this.root(id).persistent) await this.store.put(projectId, null);
    this.projects.delete(projectId); this.roots.delete(id);
  }
  private async directory(id: string, path: string) {
    const normalized = normalizePath(path);
    if (await this.permission(id) !== 'granted') throw new FileError('permission', 'Folder access is required. Use Request access or reconnect the folder.');
    let directory = this.root(id).handle;
    for (const part of normalized.split('/').filter(Boolean)) directory = await directory.getDirectoryHandle(part);
    return directory;
  }
  private async file(id: string, path: string) { const normalized = nonRoot(path); return (await this.directory(id, parentPath(normalized))).getFileHandle(normalized.split('/').pop()!); }
  async readDirectory(id: string, path: string): Promise<FileEntry[]> {
    const normalized = normalizePath(path), directory = await this.directory(id, normalized), entries: FileEntry[] = [];
    for await (const entry of directory.values()) entries.push({ name: entry.name, kind: entry.kind, path: [normalized, entry.name].filter(Boolean).join('/') });
    return entries.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1);
  }
  async readFile(id: string, path: string) {
    const file = await (await this.file(id, path)).getFile(); checkFile(path, file.size);
    return { content: decodeText(path, new Uint8Array(await file.arrayBuffer())), size: file.size, modified: file.lastModified };
  }
  async writeFile(id: string, path: string, content: string, expected: string) {
    checkFile(path, new TextEncoder().encode(content).length);
    if ((await this.readFile(id, path)).content !== expected) throw new FileError('conflict', 'The file changed on disk. Your edits are preserved. Reload from disk or reconcile the changes before saving.');
    const stream = await (await this.file(id, path)).createWritable();
    try { await stream.write(content); await stream.close(); }
    catch (error) { await stream.abort().catch(() => undefined); throw error; }
  }
  async exists(id: string, path: string) {
    const normalized = normalizePath(path); if (!normalized) { await this.directory(id, ''); return true; }
    const parent = await this.directory(id, parentPath(normalized)), name = normalized.split('/').pop()!;
    try { await parent.getFileHandle(name); return true; }
    catch (error) { if (error instanceof DOMException && error.name === 'TypeMismatchError') return true; if (error instanceof DOMException && error.name === 'NotFoundError') return false; throw error; }
  }
  private async destination(id: string, path: string) { const normalized = nonRoot(path); if (await this.exists(id, normalized)) throw new FileError('duplicate', 'A file or folder with this name already exists.'); return { parent: await this.directory(id, parentPath(normalized)), name: normalized.split('/').pop()! }; }
  async createFile(id: string, path: string) { const { parent, name } = await this.destination(id, path); await parent.getFileHandle(name, { create: true }); }
  async createDirectory(id: string, path: string) { const { parent, name } = await this.destination(id, path); await parent.getDirectoryHandle(name, { create: true }); }
  async delete(id: string, path: string) { const normalized = nonRoot(path); await (await this.directory(id, parentPath(normalized))).removeEntry(normalized.split('/').pop()!, { recursive: true }); }
  async rename(id: string, path: string, destination: string) {
    const source = nonRoot(path), target = nonRoot(destination);
    if (parentPath(source) !== parentPath(target)) throw new FileError('path', 'Rename must keep the entry in its current parent folder.');
    await this.destination(id, target);
    // External directory handles do not offer portable atomic rename. Bounded copy,
    // byte verification, source revalidation, then removal; failures keep the source.
    const manifest: { path: string; kind: 'file' | 'directory'; bytes?: Uint8Array }[] = [];
    let total = 0;
    const collect = async (entry: FileEntry) => {
      if (manifest.length >= 1000) throw new FileError('rename-limit', 'Rename is limited to 1,000 entries. Rename this folder outside Studio, then reconnect.');
      if (entry.kind === 'file') { const file = await (await this.file(id, entry.path)).getFile(); total += file.size; if (total > 50 * 1024 * 1024) throw new FileError('rename-limit', 'Rename is limited to 50 MiB. Rename this folder outside Studio, then refresh.'); manifest.push({ ...entry, bytes: new Uint8Array(await file.arrayBuffer()) }); }
      else { manifest.push(entry); for (const child of await this.readDirectory(id, entry.path)) await collect(child); }
    };
    const entry = (await this.readDirectory(id, parentPath(source))).find(item => item.path === source);
    if (!entry) throw new FileError('not-found', 'The entry no longer exists. Refresh Explorer.');
    await collect(entry);
    const compare = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((value, i) => value === b[i]);
    let copying = false;
    try {
      for (const item of manifest) {
        const to = target + item.path.slice(source.length); copying = true;
        if (item.kind === 'directory') await this.createDirectory(id, to);
        else { await this.createFile(id, to); const stream = await (await this.file(id, to)).createWritable(); try { await stream.write(new Blob([item.bytes!.slice().buffer])); await stream.close(); } catch (error) { await stream.abort().catch(() => undefined); throw error; } }
      }
      for (const item of manifest) {
        if (item.kind === 'file') {
          const original = new Uint8Array(await (await (await this.file(id, item.path)).getFile()).arrayBuffer());
          const copied = new Uint8Array(await (await (await this.file(id, target + item.path.slice(source.length))).getFile()).arrayBuffer());
          if (!compare(original, item.bytes!) || !compare(copied, item.bytes!)) throw new FileError('conflict', 'Files changed during rename.');
        } else { const actual = (await this.readDirectory(id, item.path)).map(v => `${v.kind}:${v.path}`).sort(); const expected = manifest.filter(v => v.path !== item.path && parentPath(v.path) === item.path).map(v => `${v.kind}:${v.path}`).sort(); if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new FileError('conflict', 'Folder contents changed during rename.'); }
      }
      await this.delete(id, source);
    } catch (error) { if (copying) throw new FileError('rename-partial', `Rename did not complete. The source and a possible copy at “${target}” are retained; inspect them before retrying. ${error instanceof Error ? error.message : ''}`); throw error; }
  }
}
