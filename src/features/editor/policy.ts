import { FileError } from '../filesystem/contracts.ts';
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const languages: Record<string, string> = { ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', json: 'json', css: 'css', scss: 'scss', html: 'html', md: 'markdown', yaml: 'yaml', yml: 'yaml', xml: 'xml', java: 'java', py: 'python', pyi: 'python', rs: 'rust', sql: 'sql', sh: 'shell', ps1: 'powershell' };
const binaries = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'pdf', 'zip', 'exe', 'dll', 'woff', 'woff2', 'ttf', 'mp4', 'mp3', 'gz', '7z']);
const extension = (path: string) => path.split('.').pop()?.toLowerCase() ?? '';
export const detectLanguage = (path: string) => languages[extension(path)] ?? 'plaintext';
export function checkFile(path: string, size: number) {
  if (binaries.has(extension(path))) throw new FileError('binary', 'Binary files cannot be opened in the text editor.');
  if (size > MAX_FILE_BYTES) throw new FileError('large', 'This file exceeds the 2 MiB text editing limit. No content was loaded or truncated.');
}
export function decodeText(path: string, bytes: Uint8Array): string {
  checkFile(path, bytes.byteLength);
  if (bytes.includes(0)) throw new FileError('binary', 'Binary or UTF-16 content is not supported. Use a UTF-8 text file.');
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new FileError('encoding', 'This file is not valid UTF-8. It was not opened to prevent encoding loss.'); }
}
