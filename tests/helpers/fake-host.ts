import { FileError, type FileSystemHost, type FolderConnection, type Permission } from '../../src/features/filesystem/contracts.ts';
import { nonRoot, normalizePath, parentPath, containsPath } from '../../src/features/filesystem/paths.ts';
import { checkFile, decodeText } from '../../src/features/editor/policy.ts';
export class FakeFileSystemHost implements FileSystemHost {
  entries = new Map<string, string | null>([['', null]]);
  fail = new Set<string>();
  reads: string[] = [];
  access: Permission = 'granted';
  connection: FolderConnection = { id: 'authorized', name: 'Disposable fixture', permission: 'granted', persistent: false };
  supported() { return true; }
  async selectDirectory() { return this.connection; }
  async restore() { return this.connection; }
  async bind() { return this.connection; }
  async sameDirectory() { return true; }
  async permission() { return this.access; }
  async disconnect() { this.access = 'unavailable'; }
  private guard(id: string, path: string, operation: string) { if (id !== this.connection.id || this.access !== 'granted') throw new FileError('permission', 'Access denied'); const value = normalizePath(path); if (this.fail.has(operation) || this.fail.has(`${operation}:${value}`)) throw new FileError(operation, `Simulated ${operation} failure`); return value; }
  private require(path: string) { if (!this.entries.has(path)) throw new FileError('not-found', 'Entry not found'); return this.entries.get(path)!; }
  async readDirectory(id: string, path: string) { const normalized = this.guard(id, path, 'readDirectory'); if (this.require(normalized) !== null) throw new FileError('kind', 'Not a directory'); this.reads.push(normalized); return [...this.entries.entries()].filter(([p]) => p !== normalized && parentPath(p) === normalized).map(([p, value]) => ({ path: p, name: p.split('/').pop()!, kind: value === null ? 'directory' as const : 'file' as const })).sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1); }
  async readFile(id: string, path: string) { const normalized = this.guard(id, nonRoot(path), 'readFile'), content = this.require(normalized); if (content === null) throw new FileError('kind', 'Not a file'); const bytes = new TextEncoder().encode(content); return { content: decodeText(path, bytes), size: bytes.length, modified: 0 }; }
  async writeFile(id: string, path: string, content: string, expected: string) { const normalized = this.guard(id, nonRoot(path), 'writeFile'); if (this.require(normalized) !== expected) throw new FileError('conflict', 'Disk content changed'); checkFile(path, new TextEncoder().encode(content).length); this.entries.set(normalized, content); }
  private create(id: string, path: string, content: string | null) { const normalized = this.guard(id, nonRoot(path), 'create'); if (this.entries.has(normalized)) throw new FileError('duplicate', 'Entry already exists'); if (this.require(parentPath(normalized)) !== null) throw new FileError('parent', 'Not a folder'); this.entries.set(normalized, content); }
  async createFile(id: string, path: string) { this.create(id, path, ''); }
  async createDirectory(id: string, path: string) { this.create(id, path, null); }
  async exists(id: string, path: string) { return this.entries.has(this.guard(id, path, 'exists')); }
  async rename(id: string, path: string, destination: string) { const source = this.guard(id, nonRoot(path), 'rename'), target = nonRoot(destination); this.require(source); if (this.entries.has(target)) throw new FileError('duplicate', 'Entry exists'); if (parentPath(source) !== parentPath(target)) throw new FileError('path', 'Rename must preserve parent'); const changed = [...this.entries.entries()].filter(([p]) => containsPath(source, p)); for (const [p, value] of changed) { this.entries.delete(p); this.entries.set(target + p.slice(source.length), value); } }
  async delete(id: string, path: string) { const root = this.guard(id, nonRoot(path), 'delete'); this.require(root); for (const p of this.entries.keys()) if (containsPath(root, p)) this.entries.delete(p); }
}
