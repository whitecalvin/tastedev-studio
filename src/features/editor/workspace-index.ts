import type { FileEntry } from '../filesystem/contracts.ts';
import { normalizePath } from '../filesystem/paths.ts';
export interface IndexReader { list(path: string): Promise<FileEntry[]>; read(path: string): Promise<{ content: string }> }
export function boundIndexReader(files: IndexReader & {connection: {id:string} | null}, connectionId: string): IndexReader {
  const check=()=>{if(files.connection?.id!==connectionId)throw new DOMException('Workspace changed','AbortError');};
  return {list:async path=>{check();const result=await files.list(path);check();return result;},read:async path=>{check();const result=await files.read(path);check();return result;}};
}
export interface IndexedFile { path: string; content: string }
const ignored = new Set(['.git','node_modules','.next','.next-desktop','target','dist','build','artifacts','.tastedev-cache']);
export const indexLimits = { files: 500, bytes: 8 * 1024 * 1024, entries: 5000, results: 200 };
export function indexable(path: string) {
  const parts = normalizePath(path).split('/');
  return !parts.some(part => ignored.has(part) || /^\.env(?:\.|$)/i.test(part) || /^(?:credentials|id_rsa|id_ed25519)(?:\.|$)/i.test(part))
    && /\.(?:[cm]?[jt]sx?|json|ya?ml|md|txt|css|html|rs|pyi?|java|toml)$/i.test(path);
}
/** Bounded, cancellable traversal with literal searches and no writes. */
export async function indexWorkspace(reader: IndexReader, signal: AbortSignal, dirty: readonly IndexedFile[] = [], languagesOnly = false) {
  const files: IndexedFile[] = [], skipped: string[] = [], queue = ['']; let bytes = 0, entries = 0, limited = false;
  const overlays = new Map(dirty.map(file => [normalizePath(file.path), file.content]));
  const check = () => { if (signal.aborted) throw new DOMException('Cancelled', 'AbortError'); };
  while (queue.length && !limited) {
    check(); const parent = queue.shift()!;
    let children: FileEntry[];
    try { children = await reader.list(parent); check(); } catch(error) { check(); if(error instanceof DOMException&&error.name==='AbortError')throw error; skipped.push(parent || '.'); continue; }
    for (const child of children) {
      check(); if (++entries > indexLimits.entries) { limited = true; break; }
      // Reject a host result outside the directory requested, including aliases/traversal.
      let normalized: string;
      try { normalized = normalizePath(child.path); } catch { skipped.push(child.path); continue; }
      if (normalized !== [parent,child.name].filter(Boolean).join('/') || child.name.includes('/') || child.name.includes('\\')) { skipped.push(child.path); continue; }
      if (child.kind === 'directory') { if (!ignored.has(child.name) && normalized.split('/').length <= 20) queue.push(normalized); continue; }
      if (!indexable(normalized) || (languagesOnly && !/\.[cm]?[jt]sx?$/i.test(normalized))) continue;
      if (files.length >= indexLimits.files) { limited = true; break; }
      try {
        const content = overlays.get(normalized) ?? (await reader.read(normalized)).content;
        check(); const size = new TextEncoder().encode(content).length;
        if (size > 512 * 1024 || content.includes('\0')) { skipped.push(normalized); continue; }
        if (bytes + size > indexLimits.bytes) { limited = true; break; }
        bytes += size; files.push({path:normalized,content});
      } catch(error) { check(); if(error instanceof DOMException&&error.name==='AbortError')throw error; skipped.push(normalized); }
    }
  }
  check(); return {files,bytes,limited,skipped};
}
export interface SearchHit {path:string;line:number;column:number;text:string}
export function searchIndex(files: readonly IndexedFile[], query: string, caseSensitive = false) {
  if (!query || query.length > 256 || /[\r\n\0]/.test(query)) throw Error('Enter a search phrase up to 256 characters on one line.');
  // Escape all metacharacters: the user supplies a literal phrase, never a regex program.
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), caseSensitive?'g':'gi'); const hits: SearchHit[] = []; let limited = false;
  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    for (let i=0;i<lines.length;i++) {
      const text = lines[i];
      for (const match of text.matchAll(pattern)) {
        const column = match.index;
        if(hits.length >= indexLimits.results){limited=true;return {hits,limited};}
        hits.push({path:file.path,line:i+1,column:column+1,text:text.slice(Math.max(0,column-60),column+200)});
      }
    }
  }
  return {hits,limited};
}
