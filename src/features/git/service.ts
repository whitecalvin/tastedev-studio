import { normalizePath } from '../filesystem/paths.ts';
import { GitError, gitMessages, type GitHost, type GitScope, type GitRepository, type GitFileStatus, type GitBranch, type GitCommit, type GitDiff, type DiffSide, type GitErrorCode } from './contracts.ts';
export interface GitState {
  phase: 'idle' | 'unavailable' | 'ready' | 'not-repository' | 'error';
  repository: GitRepository | null; files: GitFileStatus[]; branches: GitBranch[]; history: GitCommit[];
  diff: GitDiff | null; busy: string; error: string; notice: string; fresh: boolean;
}
export function initialGitState(): GitState { return { phase: 'idle', repository: null, files: [], branches: [], history: [], diff: null, busy: '', error: '', notice: '', fresh: false }; }
export function gitPath(path: string) { try { if (!path || normalizePath(path) !== path) throw new Error(); return path; } catch { throw new GitError('path'); } }
export const isConflict = (file: GitFileStatus) => file.index === 'conflicted' || file.workingTree === 'conflicted';
export function gitDecoration(files: GitFileStatus[], path: string) { const file = files.find(f => f.path === path); return file ? isConflict(file) ? 'conflicted' : file.workingTree ?? file.index : null; }
export const statusLetters = { untracked: 'U', added: 'A', modified: 'M', deleted: 'D', renamed: 'R', conflicted: '!' } as const;
export class GitService {
  private state = initialGitState();
  private listeners = new Set<() => void>();
  private disposed = false;
  private diffRevision = 0;
  readonly host: GitHost;
  readonly scope: GitScope;
  constructor(host: GitHost, scope: GitScope) { this.host = host; this.scope = scope; }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<GitState>) { if (this.disposed) return; this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  private async operation(name: string, code: GitErrorCode, action: () => Promise<void>) {
    if (this.disposed || this.state.busy) return false;
    this.publish({ busy: name, error: '', notice: '' });
    try { if (!this.host.capabilities.git) { this.publish({ phase: 'unavailable', notice: 'Capability checked: Git is unavailable in this browser.' }); throw new GitError('unavailable'); } await action(); return !this.disposed; }
    catch (error) { this.publish({ error: error instanceof GitError ? error.message : gitMessages[code] }); return false; }
    finally { this.publish({ busy: '' }); }
  }
  private async read() {
    if (this.disposed) return;
    this.publish({ fresh: false, diff: null }); this.diffRevision++;
    let repository: GitRepository | null;
    try { repository = await this.host.detect(this.scope); } catch { throw new GitError('repository'); }
    if (this.disposed) return;
    if (!repository) { this.publish({ ...initialGitState(), phase: 'not-repository', busy: this.state.busy, fresh: true }); return; }
    let files: GitFileStatus[], branches: GitBranch[], history: GitCommit[];
    try { files = await this.host.status(this.scope, repository); files.forEach(f => { gitPath(f.path); if (f.originalPath) gitPath(f.originalPath); }); branches = await this.host.branches(this.scope, repository); } catch { throw new GitError('status'); }
    try { history = (await this.host.log(this.scope, repository, { limit: 50 })).slice(0, 50); } catch { throw new GitError('history'); }
    this.publish({ repository, files, branches, history, phase: 'ready', fresh: true });
  }
  refresh = () => this.operation('Refreshing Git…', 'status', async () => { try { await this.read(); } catch (error) { this.publish({ phase: 'error' }); throw error; } });
  private repository() { if (!this.state.fresh || !this.state.repository) throw new GitError('repository'); return this.state.repository; }
  selectDiff = (path: string, side: DiffSide) => this.operation('Loading diff…', 'diff', async () => {
    gitPath(path); const repository = this.repository();
    if (!this.state.files.some(f => f.path === path && (side === 'staged' ? f.index : f.workingTree))) throw new GitError('diff');
    const revision = ++this.diffRevision; this.publish({ diff: null });
    const diff = await this.host.diff(this.scope, repository, path, side);
    if (diff.path !== path || diff.side !== side || (!diff.binary && (diff.original.length + diff.modified.length > 2 * 1024 * 1024))) throw new GitError('diff');
    if (revision === this.diffRevision) this.publish({ diff: diff.binary ? { ...diff, original: '', modified: '' } : diff });
  });
  closeDiff = () => { this.diffRevision++; this.publish({ diff: null }); };
  changeIndex = (kind: 'stage' | 'unstage', path?: string) => this.operation(kind === 'stage' ? 'Staging files…' : 'Unstaging files…', kind, async () => {
    const repository = this.repository(); if (path !== undefined) gitPath(path);
    const candidates = this.state.files.filter(f => path === undefined || f.path === path);
    if (candidates.some(isConflict)) throw new GitError('conflict');
    const selected = candidates.filter(f => kind === 'stage' ? f.workingTree : f.index);
    if (!selected.length) throw new GitError(kind);
    const paths = [...new Set(selected.flatMap(f => [f.path, ...(f.originalPath ? [f.originalPath] : [])]))];
    paths.forEach(gitPath); this.publish({ fresh: false, diff: null });
    await this.host[kind](this.scope, repository, paths);
    await this.read(); this.publish({ notice: kind === 'stage' ? 'Changes staged.' : 'Changes unstaged.' });
  });
  commit = (message: string) => this.operation('Committing…', 'commit', async () => {
    const repository = this.repository();
    if (!message.trim() || message.length > 4096 || message.includes('\0')) throw new GitError('message');
    if (this.state.files.some(isConflict)) throw new GitError('conflict');
    if (!this.state.files.some(f => f.index)) throw new GitError('empty-index');
    this.publish({ fresh: false, diff: null });
    await this.host.commit(this.scope, repository, message.trim());
    // A successful write is not a failed commit when its subsequent refresh fails.
    try { await this.read(); this.publish({ notice: 'Commit created.' }); }
    catch { this.publish({ notice: 'Commit created. Refresh failed; refresh before another commit.', error: gitMessages.status }); }
  });
  dispose() { this.disposed = true; this.diffRevision++; this.listeners.clear(); }
}
