import test from 'node:test';
import assert from 'node:assert/strict';
import { WebFileSystemHost, type RuntimeDirectory } from '../src/features/filesystem/web-host.ts';

test('folder picker abort preserves browser diagnostics instead of assuming user cancellation', async () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true, showDirectoryPicker: async () => { throw new DOMException('Permission was not granted', 'AbortError'); } } });
  await assert.rejects(new WebFileSystemHost().selectDirectory(), /Browser detail: AbortError: Permission was not granted/);
});

// Browser-handle doubles exercise the production Web adapter. They are never
// exposed by application code and never touch real user files.
interface Entry { kind: 'file' | 'directory'; bytes: Uint8Array; children: Map<string, Entry> }
const directory = (): Entry => ({ kind: 'directory', bytes: new Uint8Array(), children: new Map() });
function runtime() {
  const root = directory();
  const state = { permission: 'granted' as PermissionState, failWrite: '', failDelete: '', reads: [] as string[] };
  const handles = new WeakMap<object, Entry>();
  const handle = (entry: Entry, name: string, path: string): FileSystemHandle => {
    const base = { kind: entry.kind, name, async isSameEntry(other: FileSystemHandle) { return handles.get(other) === entry; } };
    if (entry.kind === 'file') {
      const file = { ...base, kind: 'file' as const, async getFile() { return new File([entry.bytes.slice().buffer], name, { lastModified: 1 }); }, async createWritable() {
        let pending = entry.bytes;
        // The adapter only uses write/close/abort, so the double keeps that contract.
        return { async write(data: string | Blob) { if (state.failWrite === path) throw new Error('simulated write failure'); pending = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(await data.arrayBuffer()); }, async close() { entry.bytes = pending; }, async abort() {} } as unknown as FileSystemWritableFileStream;
      } };
      handles.set(file, entry); return file;
    }
    const get = (child: string, kind: Entry['kind'], create = false) => { let result = entry.children.get(child); if (!result && create) { result = { ...directory(), kind }; entry.children.set(child, result); } if (!result) throw new DOMException('Missing', 'NotFoundError'); if (result.kind !== kind) throw new DOMException('Wrong kind', 'TypeMismatchError'); return result; };
    const folder: RuntimeDirectory = { ...base, kind: 'directory', async queryPermission() { return state.permission; }, async requestPermission() { return state.permission; }, async *values() { state.reads.push(path); for (const [child, value] of entry.children) yield handle(value, child, [path, child].filter(Boolean).join('/')); }, async getDirectoryHandle(child, options) { return handle(get(child, 'directory', options?.create), child, [path, child].filter(Boolean).join('/')) as RuntimeDirectory; }, async getFileHandle(child, options) { return handle(get(child, 'file', options?.create), child, [path, child].filter(Boolean).join('/')) as FileSystemFileHandle; }, async removeEntry(child) { const target = [path, child].filter(Boolean).join('/'); if (target === state.failDelete) throw new Error('simulated delete failure'); if (!entry.children.delete(child)) throw new DOMException('Missing', 'NotFoundError'); }, async resolve() { return null; } };
    handles.set(folder, entry); return folder;
  };
  const rootHandle = handle(root, 'fixture', '') as RuntimeDirectory;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true, showDirectoryPicker: async () => rootHandle } });
  return { root, state };
}
test('production Web host uses authorized handles and commits text only after successful close', async () => {
  const { state } = runtime(); const host = new WebFileSystemHost(), connection = await host.selectDirectory();
  await host.createDirectory(connection.id, 'src'); await host.createFile(connection.id, 'src/a.ts'); await host.writeFile(connection.id, 'src/a.ts', 'original', '');
  assert.equal((await host.readFile(connection.id, 'src/a.ts')).content, 'original');
  await host.readDirectory(connection.id, ''); assert.deepEqual(state.reads, ['']);
  await assert.rejects(host.writeFile(connection.id, 'src/a.ts', 'overwrite', 'stale'), /changed on disk/);
  state.failWrite = 'src/a.ts'; await assert.rejects(host.writeFile(connection.id, 'src/a.ts', 'overwrite', 'original')); assert.equal((await host.readFile(connection.id, 'src/a.ts')).content, 'original');
  await assert.rejects(host.readFile('foreign', 'src/a.ts'), /authorized/); state.permission = 'denied'; await assert.rejects(host.readDirectory(connection.id, ''), /access is required/);
});
test('production Web host renames nested folders with verification and protects duplicate destinations', async () => {
  runtime(); const host = new WebFileSystemHost(), { id } = await host.selectDirectory(); await host.createDirectory(id, 'folder'); await host.createDirectory(id, 'folder/deep'); await host.createFile(id, 'folder/deep/a.txt'); await host.writeFile(id, 'folder/deep/a.txt', 'retained bytes', '');
  await host.rename(id, 'folder', 'renamed'); assert.equal(await host.exists(id, 'folder'), false); assert.equal((await host.readFile(id, 'renamed/deep/a.txt')).content, 'retained bytes');
  await host.createDirectory(id, 'duplicate'); await assert.rejects(host.rename(id, 'renamed', 'duplicate'), /already exists/); assert.equal(await host.exists(id, 'renamed'), true); await assert.rejects(host.delete(id, ''), /root/); await assert.rejects(host.rename(id, 'renamed', '../escape'));
});
test('failed copy or source removal during Web rename preserves original and reports partial copy', async () => {
  const { state } = runtime(); const host = new WebFileSystemHost(), { id } = await host.selectDirectory(); await host.createFile(id, 'a.txt'); await host.writeFile(id, 'a.txt', 'important', ''); state.failWrite = 'b.txt';
  await assert.rejects(host.rename(id, 'a.txt', 'b.txt'), /source and a possible copy/); assert.equal((await host.readFile(id, 'a.txt')).content, 'important'); assert.equal(await host.exists(id, 'b.txt'), true);
  state.failWrite = ''; state.failDelete = 'a.txt'; await assert.rejects(host.rename(id, 'a.txt', 'c.txt'), /did not complete/); assert.equal((await host.readFile(id, 'a.txt')).content, 'important'); assert.equal((await host.readFile(id, 'c.txt')).content, 'important');
});
test('Web host falls back to session-only binding when IndexedDB is unavailable', async () => {
  runtime(); const host = new WebFileSystemHost(), selected = await host.selectDirectory(); const bound = await host.bind('project', selected.id); assert.equal(bound.persistent, false); assert.equal((await host.restore('project'))?.id, selected.id); const second = await host.selectDirectory(); assert.equal(await host.sameDirectory(second.id, 'project'), true); await host.disconnect('project', selected.id); await assert.rejects(host.readDirectory(selected.id, ''), /authorized/);
});
