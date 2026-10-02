import { FileError, type FileSystemHost, type FolderConnection } from './contracts.ts';
import { childPath, nonRoot, normalizePath, parentPath, hiddenNames } from './paths.ts';
import type { ProjectService } from '../projects/services/project-service.ts';
export function fileMessage(error: unknown) {
  if (error instanceof FileError) return error.message;
  if (error instanceof DOMException) {
    const messages: Record<string, string> = { AbortError: 'Folder selection was cancelled.', NotAllowedError: 'Permission denied. Request access or reconnect the folder.', SecurityError: 'The browser blocked folder access. Use a secure top-level Chrome or Edge page and connect again.', NotFoundError: 'The file or folder no longer exists. Refresh Explorer.', InvalidStateError: 'Folder access was lost. Reconnect the folder.', TypeMismatchError: 'This name is already used by a different entry type.', NoModificationAllowedError: 'The file is locked or read-only. Close other writers and retry.', QuotaExceededError: 'The write failed because storage is full.' };
    return messages[error.name] ?? `Filesystem operation failed: ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Filesystem operation failed. Your unsaved edits are preserved.';
}
export class WorkspaceFileService {
  readonly host: FileSystemHost;
  connection: FolderConnection | null = null;
  constructor(host: FileSystemHost) { this.host = host; }
  private id() { if (!this.connection) throw new FileError('access', 'No workspace folder is connected.'); return this.connection.id; }
  async restore(projectId: string) { this.connection = await this.host.restore(projectId); return this.connection; }
  async connect(projectId: string) { const connection = await this.host.selectDirectory(); this.connection = await this.host.bind(projectId, connection.id); return this.connection; }
  async requestAccess() { const id = this.id(); const permission = await this.host.permission(id, true); this.connection = { ...this.connection!, permission }; return this.connection; }
  async checkPermission() { if (this.connection) this.connection = { ...this.connection, permission: await this.host.permission(this.connection.id) }; return this.connection; }
  async disconnect(projectId: string) { if (this.connection) await this.host.disconnect(projectId, this.connection.id); this.connection = null; }
  async list(path = '', showHidden = false) { return (await this.host.readDirectory(this.id(), normalizePath(path))).filter(entry => showHidden || !hiddenNames.has(entry.name)); }
  async read(path: string) { return this.host.readFile(this.id(), nonRoot(path)); }
  async readBytes(path:string){return this.host.readBytes?this.host.readBytes(this.id(),nonRoot(path)):new TextEncoder().encode((await this.read(path)).content);}
  async write(path: string, content: string, expected: string) { return this.host.writeFile(this.id(), nonRoot(path), content, expected); }
  async create(parent: string, name: string, kind: 'file' | 'directory') { const path = childPath(parent, name); if (await this.host.exists(this.id(), path)) throw new FileError('duplicate', 'A file or folder with this name already exists.'); if (kind === 'file') await this.host.createFile(this.id(), path); else await this.host.createDirectory(this.id(), path); return path; }
  async rename(path: string, name: string) { const source = nonRoot(path), destination = childPath(parentPath(source), name); if (source === destination) return source; if (await this.host.exists(this.id(), destination)) throw new FileError('duplicate', 'A file or folder with this name already exists.'); await this.host.rename(this.id(), source, destination); return destination; }
  async delete(path: string) { return this.host.delete(this.id(), nonRoot(path)); }
}
export async function openFolderProject(host: FileSystemHost, projects: ProjectService, onSelected?: (name: string) => void) {
  const selected = await host.selectDirectory();
  onSelected?.(selected.name);
  const list = await projects.list();
  for (const project of list) if (await host.sameDirectory(selected.id, project.id)) { await host.bind(project.id, selected.id); return project; }
  const project = selected.workspacePath ? await projects.create({ name: selected.name, workspacePath: selected.workspacePath, description: '' }) : await projects.registerBrowserFolder(selected.name);
  await host.bind(project.id, selected.id); return project;
}

