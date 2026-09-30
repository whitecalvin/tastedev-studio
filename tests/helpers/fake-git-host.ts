import type { GitHost, GitScope, GitRepository, GitFileStatus, GitBranch, GitCommit, GitDiff, DiffSide } from '../../src/features/git/contracts.ts';
/** Automated tests only. No CLI, files, network or application imports. */
export class FakeGitHost implements GitHost {
  capabilities = { git: true };
  repository: GitRepository | null = { id: 'repo', root: 'workspace/nested', currentBranch: 'feature/studio', detached: false, hasRemote: true };
  files: GitFileStatus[] = [];
  history: GitCommit[] = [];
  calls: { operation: string; projectId: string; paths?: string[]; message?: string }[] = [];
  failure = '';
  wait: (() => Promise<void>) | null = null;
  binary = false;
  private async check(operation: string, scope: GitScope) { this.calls.push({ operation, projectId: scope.projectId }); if (this.wait) await this.wait(); if (this.failure === operation) throw new Error('raw secret diagnostic'); }
  async detect(scope: GitScope) { await this.check('detect', scope); return this.repository; }
  async status(scope: GitScope) { await this.check('status', scope); return structuredClone(this.files); }
  async branches(scope: GitScope): Promise<GitBranch[]> { await this.check('branches', scope); return this.repository?.currentBranch ? [{ name: this.repository.currentBranch, current: true, remote: false }] : []; }
  async diff(scope: GitScope, _repository: GitRepository, path: string, side: DiffSide): Promise<GitDiff> { await this.check('diff', scope); if (!this.files.some(f => f.path === path)) throw new Error('missing'); return { path, side, original: 'export const value = 1;\n', modified: 'export const value = 2;\n', binary: this.binary }; }
  async stage(scope: GitScope, _repository: GitRepository, paths: string[]) { await this.check('stage', scope); this.calls.at(-1)!.paths = paths; this.files = this.files.map(f => paths.includes(f.path) ? { ...f, index: f.workingTree === 'untracked' ? 'added' : f.workingTree ?? f.index, workingTree: null } : f); }
  async unstage(scope: GitScope, _repository: GitRepository, paths: string[]) { await this.check('unstage', scope); this.calls.at(-1)!.paths = paths; this.files = this.files.map(f => paths.includes(f.path) ? { ...f, workingTree: f.workingTree ?? (f.index === 'added' ? 'untracked' : f.index), index: null } : f); }
  async commit(scope: GitScope, _repository: GitRepository, message: string) { await this.check('commit', scope); this.calls.at(-1)!.message = message; const hash = `${this.history.length + 1}`.padStart(40, '0'); const result = { hash, shortHash: hash.slice(-7), message, author: 'Test author', date: '2026-09-29T00:00:00Z' }; this.history.unshift(result); this.files = this.files.filter(f => f.workingTree).map(f => ({ ...f, index: null })); return result; }
  async log(scope: GitScope, _repository: GitRepository, options: { limit: number }) { await this.check('log', scope); return this.history.slice(0, options.limit); }
}
