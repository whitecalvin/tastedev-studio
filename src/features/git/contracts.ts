export const gitDesktopRequired = 'Native Git integration requires the TASTEDEV Studio desktop runtime.';
export type GitKind = 'untracked' | 'added' | 'modified' | 'deleted' | 'renamed' | 'conflicted';
export interface GitFileStatus { path: string; originalPath?: string; index: GitKind | null; workingTree: GitKind | null }
export interface GitRepository { id: string; root: string; currentBranch: string | null; detached: boolean; hasRemote: boolean }
export interface GitBranch { name: string; current: boolean; remote: boolean }
export interface GitCommit { hash: string; shortHash: string; message: string; author: string; date: string }
export type DiffSide = 'staged' | 'working';
export interface GitDiff { path: string; side: DiffSide; original: string; modified: string; binary: boolean }
export interface GitScope { projectId: string; workspaceId: string | null; workspacePath: string | null }
export type GitErrorCode = 'unavailable' | 'missing-git' | 'repository' | 'status' | 'diff' | 'stage' | 'unstage' | 'commit' | 'history' | 'conflict' | 'message' | 'path' | 'empty-index';
export const gitMessages: Record<GitErrorCode, string> = {
  unavailable: gitDesktopRequired, 'missing-git': 'Git executable was not found. Install Git for Windows and restart Studio.', repository: 'The repository could not be read. Check access and refresh.', status: 'Git status could not be refreshed. Refresh before changing the index.',
  diff: 'This diff could not be loaded. Refresh changes and try again.', stage: 'Files could not be staged. Refresh and check repository access.', unstage: 'Files could not be unstaged. Refresh and check repository access.',
  commit: 'The commit could not be completed. Refresh history and status before retrying.', history: 'Commit history could not be loaded. Refresh to try again.', conflict: 'Resolve conflicts on disk before staging or committing.',
  message: 'Enter a commit message of 1–4,096 characters without null characters.', path: 'Choose a valid file inside this repository.', 'empty-index': 'Stage changes before committing.',
};
export class GitError extends Error { readonly code: GitErrorCode; constructor(code: GitErrorCode) { super(gitMessages[code]); this.code = code; } }
/** Scope and repository ID must be authorized by the host, including nested roots/worktrees.
 * Paths are literal repository-relative data, never shell strings or Git pathspec expressions.
 * Native adapters must use executable/args, literal pathspecs, option separators and bounded output.
 * Revalidate index/conflicts before mutations; commit rejection may have an uncertain outcome.
 * Remote operations/credentials are deliberately absent. Extend this boundary in a later step. */
export interface GitHost {
  readonly capabilities: { git: boolean };
  detect(scope: GitScope): Promise<GitRepository | null>;
  status(scope: GitScope, repository: GitRepository): Promise<GitFileStatus[]>;
  branches(scope: GitScope, repository: GitRepository): Promise<GitBranch[]>;
  diff(scope: GitScope, repository: GitRepository, path: string, side: DiffSide): Promise<GitDiff>;
  stage(scope: GitScope, repository: GitRepository, paths: string[]): Promise<void>;
  unstage(scope: GitScope, repository: GitRepository, paths: string[]): Promise<void>;
  commit(scope: GitScope, repository: GitRepository, message: string): Promise<GitCommit>;
  log(scope: GitScope, repository: GitRepository, options: { limit: number }): Promise<GitCommit[]>;
}
export class WebUnavailableGitHost implements GitHost {
  readonly capabilities = { git: false };
  async detect(): Promise<never> { throw new GitError('unavailable'); }
  async status(): Promise<never> { throw new GitError('unavailable'); }
  async branches(): Promise<never> { throw new GitError('unavailable'); }
  async diff(): Promise<never> { throw new GitError('unavailable'); }
  async stage(): Promise<never> { throw new GitError('unavailable'); }
  async unstage(): Promise<never> { throw new GitError('unavailable'); }
  async commit(): Promise<never> { throw new GitError('unavailable'); }
  async log(): Promise<never> { throw new GitError('unavailable'); }
}

