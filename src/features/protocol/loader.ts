import type { FileSystemHost } from '../filesystem/contracts.ts';
import { protocolFiles, type ProtocolSources, type ProtocolState } from './domain.ts';
import { parseProtocol } from './parser.ts';

export interface ProtocolReader { exists(path: string): Promise<boolean>; read(path: string): Promise<string> }
export function workspaceReader(host: FileSystemHost, connectionId: string): ProtocolReader {
  return { exists: path => host.exists(connectionId, path), read: async path => (await host.readFile(connectionId, path)).content };
}
export async function loadProtocol(reader: ProtocolReader): Promise<ProtocolState> {
  const sources: ProtocolSources = {};
  let file = 'project.yml';
  try {
    if (!await reader.exists('.tastedev') || !await reader.exists('.tastedev/project.yml')) return { status: 'Not Configured', issues: [] };
    for (file of protocolFiles) if (await reader.exists(`.tastedev/${file}`)) sources[file as keyof ProtocolSources] = await reader.read(`.tastedev/${file}`);
    return parseProtocol(sources);
  } catch {
    return { status: 'Invalid', issues: [{ file: `.tastedev/${file}`, path: '$', message: 'Cannot read this Protocol file. Check folder access, file size and encoding, then reload.' }] };
  }
}
export async function initializeProtocol(host: FileSystemHost, connectionId: string) {
  const path = '.tastedev/project.yml';
  if (await host.exists(connectionId, '.tastedev')) {
    if (await host.exists(connectionId, path)) throw new Error('Protocol already exists. Reload or edit it; initialization never replaces it.');
  } else await host.createDirectory(connectionId, '.tastedev');
  await host.createFile(connectionId, path);
  // The host verifies expected content again before writing; a concurrent writer wins.
  await host.writeFile(connectionId, path, 'version: 1\nproject:\n  name: my-project\n  type: generic\n', '');
}
