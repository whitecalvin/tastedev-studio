import { FileError } from './contracts.ts';
export function normalizePath(input: string): string {
  if (input.length > 4096 || /^[\\/]/.test(input) || /[\u0000-\u001f<>:"|?*]/.test(input)) throw new FileError('path', 'Use a relative path inside the connected folder.');
  const parts = input.replaceAll('\\', '/').split('/').filter(part => part && part !== '.');
  if (parts.some(part => part === '..' || /[. ]$/.test(part))) throw new FileError('path', 'Parent traversal and trailing dots or spaces are not allowed.');
  return parts.join('/');
}
export function validateName(name: string): string {
  if (!name || name.length > 255 || name !== name.trim() || /[\\/]/.test(name) || normalizePath(name) !== name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) throw new FileError('name', 'Enter one valid file or folder name (no separators or reserved names).');
  return name;
}
export function childPath(parent: string, name: string) { return normalizePath([normalizePath(parent), validateName(name)].filter(Boolean).join('/')); }
export function parentPath(path: string) { return normalizePath(path).split('/').slice(0, -1).join('/'); }
export function containsPath(root: string, path: string) { return path === root || path.startsWith(root + '/'); }
export function nonRoot(path: string) { const result = normalizePath(path); if (!result) throw new FileError('root', 'The connected root cannot be renamed or deleted.'); return result; }
export const hiddenNames = new Set(['node_modules', '.next', '.git', 'dist', 'build']);
