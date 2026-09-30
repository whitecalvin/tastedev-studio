import type { FileEntry, FileSnapshot, FileSystemHost, FolderConnection, Permission } from '../filesystem/contracts.ts';
import { FileError } from '../filesystem/contracts.ts';
import { GitError, type GitHost, type GitScope, type GitRepository, type GitFileStatus, type GitBranch, type GitDiff, type GitCommit, type DiffSide, type GitErrorCode } from '../git/contracts.ts';
import type { ProcessHost, ProcessEvent, ProcessStartRequest } from '../process/contracts.ts';
import { reportFrontendError } from './frontend-diagnostics.ts';
export interface NativeBridge {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  listen(event: string, listener: (payload: ProcessEvent) => void): Promise<() => void>;
}
export const nativeBridge: NativeBridge = {
  async invoke<T>(command: string, args?: Record<string, unknown>) {
    const api = await import('@tauri-apps/api/core');
    try { return await api.invoke<T>(command, args); }
    catch (error) { if (command !== 'runtime_diagnostic') { reportFrontendError('tauri.invoke', error); void api.invoke('runtime_diagnostic', { event: 'command-failure' }).catch(() => {}); } throw error; }
  },
  async listen(event, listener) { const api = await import('@tauri-apps/api/event'); return api.listen<ProcessEvent>(event, event => listener(event.payload)); },
};
const fileMessages: Record<string, string> = {
  access: 'Connect a workspace folder first.', permission: 'Folder access was denied. Check its permissions.',
  'not-found': 'The file or folder no longer exists. Reconnect or refresh Explorer.', path: 'Choose a valid path inside the workspace. Links and junctions are not supported.',
  conflict: 'The file changed on disk. Reload before saving; your edits are preserved.', duplicate: 'A file or folder with this name already exists.',
  binary: 'This file is not supported UTF-8 text.', large: 'This file exceeds the 2 MiB editor limit.', cancelled: 'Folder selection was cancelled.',
};
export function nativeFileError(value: unknown) { const code = typeof value === 'object' && value !== null && 'code' in value ? String(value.code) : 'filesystem'; return new FileError(code, fileMessages[code] ?? 'Filesystem operation failed. Your unsaved edits are preserved.'); }
export class TauriFileSystemHost implements FileSystemHost {
  private bridge: NativeBridge;
  constructor(bridge = nativeBridge) { this.bridge = bridge; }
  supported() { return true; }
  private async call<T>(command: string, args?: Record<string, unknown>) { try { return await this.bridge.invoke<T>(command, args); } catch (e) { throw nativeFileError(e); } }
  selectDirectory() { return this.call<FolderConnection>('workspace_select'); }
  restore(projectId: string) { return this.call<FolderConnection | null>('workspace_restore', { projectId }); }
  bind(projectId: string, connectionId: string) { return this.call<FolderConnection>('workspace_bind', { projectId, connectionId }); }
  sameDirectory(connectionId: string, projectId: string) { return this.call<boolean>('workspace_same', { connectionId, projectId }); }
  permission(connectionId: string) { return this.call<Permission>('workspace_permission', { connectionId }); }
  disconnect(projectId: string, connectionId: string) { return this.call<void>('workspace_disconnect', { projectId, connectionId }); }
  private file<T>(operation: string, connectionId: string, path: string, extra = {}) { return this.call<T>('workspace_file', { request: { operation, connectionId, path, ...extra } }); }
  readDirectory(id: string, path: string) { return this.file<FileEntry[]>('list', id, path); }
  readFile(id: string, path: string) { return this.file<FileSnapshot>('read', id, path); }
  writeFile(id: string, path: string, content: string, expected: string) { return this.file<void>('write', id, path, { content, expected }); }
  createFile(id: string, path: string) { return this.file<void>('createFile', id, path); }
  createDirectory(id: string, path: string) { return this.file<void>('createDirectory', id, path); }
  rename(id: string, path: string, destination: string) { return this.file<void>('rename', id, path, { destination }); }
  delete(id: string, path: string) { return this.file<void>('delete', id, path); }
  exists(id: string, path: string) { return this.file<boolean>('exists', id, path); }
}
export class TauriGitHost implements GitHost {
  readonly capabilities = { git: true };
  private bridge: NativeBridge;
  constructor(bridge = nativeBridge) { this.bridge = bridge; }
  private async call<T>(operation: string, scope: GitScope, extra = {}, code: GitErrorCode = 'repository') { try { return await this.bridge.invoke<T>('git_operation', { request: { operation, workspaceId: scope.workspaceId, ...extra } }); } catch (error) { throw new GitError(typeof error === 'object' && error !== null && 'code' in error && error.code === 'git-not-found' ? 'missing-git' : code); } }
  detect(scope: GitScope) { return scope.workspaceId ? this.call<GitRepository | null>('detect', scope) : Promise.resolve(null); }
  status(scope: GitScope, repository: GitRepository) { return this.call<GitFileStatus[]>('status', scope, { repository }, 'status'); }
  branches(scope: GitScope, repository: GitRepository) { return this.call<GitBranch[]>('branches', scope, { repository }); }
  diff(scope: GitScope, repository: GitRepository, path: string, side: DiffSide) { return this.call<GitDiff>('diff', scope, { repository, path, side }, 'diff'); }
  stage(scope: GitScope, repository: GitRepository, paths: string[]) { return this.call<void>('stage', scope, { repository, paths }, 'stage'); }
  unstage(scope: GitScope, repository: GitRepository, paths: string[]) { return this.call<void>('unstage', scope, { repository, paths }, 'unstage'); }
  commit(scope: GitScope, repository: GitRepository, message: string) { return this.call<GitCommit>('commit', scope, { repository, message }, 'commit'); }
  log(scope: GitScope, repository: GitRepository, options: { limit: number }) { return this.call<GitCommit[]>('log', scope, { repository, limit: options.limit }, 'history'); }
}
export class TauriProcessHost implements ProcessHost {
  readonly capabilities = { process: true, pty: true };
  private bridge: NativeBridge;
  private listeners = new Set<(event: ProcessEvent) => void>();
  private listening: Promise<() => void> | null = null;
  constructor(bridge = nativeBridge) { this.bridge = bridge; }
  subscribe(listener: (event: ProcessEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); if (!this.listeners.size) { const listening = this.listening; this.listening = null; void listening?.then(unlisten => unlisten()); } }; }
  async start(sessionId: string, request: ProcessStartRequest) {
    this.listening ??= this.bridge.listen('studio-process', event => { for (const listener of this.listeners) {
      try { listener(event); } catch (error) { reportFrontendError('tauri.event', error); void this.bridge.invoke('runtime_diagnostic', { event: 'event-error' }).catch(() => {}); throw error; }
    } });
    await this.listening;
    await this.bridge.invoke('process_start', { sessionId, request });
  }
  async stop(sessionId: string) { await this.bridge.invoke('process_stop', { sessionId }); }
  async write(sessionId: string, data: string) { await this.bridge.invoke('process_write', { sessionId, data }); }
  async resize(sessionId: string, columns: number, rows: number) { await this.bridge.invoke('process_resize', { sessionId, columns, rows }); }
}

