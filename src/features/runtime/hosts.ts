import { WebFileSystemHost } from '../filesystem/web-host.ts';
import { WebUnavailableProcessHost } from '../process/contracts.ts';
import { WebUnavailableGitHost } from '../git/contracts.ts';
import { TauriFileSystemHost, TauriProcessHost, TauriGitHost } from './native-hosts.ts';
export function detectRuntime(surface: unknown = typeof window === 'undefined' ? undefined : window): 'desktop' | 'web' {
  return typeof surface === 'object' && surface !== null && '__TAURI_INTERNALS__' in surface ? 'desktop' : 'web';
}
export function createHosts(runtime = detectRuntime()) {
  return runtime === 'desktop' ? { runtime, filesystem: new TauriFileSystemHost(), process: new TauriProcessHost(), git: new TauriGitHost() } : { runtime, filesystem: new WebFileSystemHost(), process: new WebUnavailableProcessHost(), git: new WebUnavailableGitHost() };
}
let hosts: ReturnType<typeof createHosts> | undefined;
export function runtimeHosts() { if (!hosts) hosts = createHosts(); return hosts; }
export function projectHref(id: string) { return detectRuntime() === 'desktop' ? `/workspace/?project=${encodeURIComponent(id)}` : `/projects/${encodeURIComponent(id)}`; }
