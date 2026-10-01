import type { FileSystemHost } from '../filesystem/contracts.ts';
import { protocolFiles, type ProtocolFile, type ProtocolSources } from './domain.ts';
import { parseProtocol, parseYaml } from './parser.ts';

export interface ProtocolDraft {
  sources: ProtocolSources;
  file: 'tasks.yml' | 'tests.yml';
  name: string;
  originalName?: string;
  value: Record<string, unknown>;
}
export async function readProtocolSources(host: FileSystemHost, connectionId: string): Promise<ProtocolSources> {
  const result: ProtocolSources = {};
  for (const file of protocolFiles) {
    const path = `.tastedev/${file}`;
    if (await host.exists(connectionId, path)) result[file] = (await host.readFile(connectionId, path)).content;
  }
  return result;
}
export function definitionMap(sources: ProtocolSources, file: 'tasks.yml' | 'tests.yml'): Record<string, unknown> {
  if (sources[file] === undefined) return {};
  return { ...(parseYaml(sources[file], file) as Record<string, unknown>) };
}
/** Change one definition and preserve raw, schema-valid neighboring definitions. */
export function previewDraft(draft: ProtocolDraft) {
  const baseline = parseProtocol(draft.sources);
  if (baseline.status !== 'Valid') throw Error('Fix existing Protocol errors before using the form.');
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(draft.name)) throw Error('Use a name beginning with a letter, up to 64 letters, digits, underscores or hyphens.');
  const definitions = definitionMap(draft.sources, draft.file);
  if (draft.name !== draft.originalName && Object.hasOwn(definitions, draft.name)) throw Error('This definition name already exists.');
  if (draft.originalName && !Object.hasOwn(definitions, draft.originalName)) throw Error('The original definition is no longer present.');
  if (draft.originalName && draft.originalName !== draft.name) delete definitions[draft.originalName];
  definitions[draft.name] = draft.value;
  const content = JSON.stringify(definitions, null, 2) + '\n';
  const sources = { ...draft.sources, [draft.file]: content };
  const state = parseProtocol(sources);
  if (state.status !== 'Valid') throw Error(state.issues.map(issue => `${issue.file} ${issue.path}: ${issue.message}`).join('\n'));
  return { content, sources, state };
}
/** The host rechecks expected bytes. A stale form never overwrites newer disk edits. */
export async function saveDraft(host: FileSystemHost, connectionId: string, draft: ProtocolDraft, guard: (file: ProtocolFile) => void) {
  const preview = previewDraft(draft);
  guard(draft.file);
  const fresh = await readProtocolSources(host, connectionId);
  for (const file of protocolFiles) if (fresh[file] !== draft.sources[file]) throw Error('Protocol changed on disk. Reload the form; your changes have not been applied.');
  guard(draft.file);
  const path = `.tastedev/${draft.file}`;
  if (fresh[draft.file] === undefined) await host.createFile(connectionId, path);
  guard(draft.file);
  await host.writeFile(connectionId, path, preview.content, fresh[draft.file] ?? '');
  return preview;
}
