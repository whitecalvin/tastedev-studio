export type Permission = 'granted' | 'prompt' | 'denied' | 'unavailable';
export interface FolderConnection { id: string; name: string; permission: Permission; persistent: boolean; workspacePath?: string }
export interface FileEntry { name: string; path: string; kind: 'file' | 'directory' }
export interface FileSnapshot { content: string; size: number; modified: number }
export class FileError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'FileError'; this.code = code; }
}
export interface FileSystemHost {
  supported(): boolean;
  selectDirectory(): Promise<FolderConnection>;
  restore(projectId: string): Promise<FolderConnection | null>;
  bind(projectId: string, connectionId: string): Promise<FolderConnection>;
  sameDirectory(connectionId: string, projectId: string): Promise<boolean>;
  permission(connectionId: string, request?: boolean): Promise<Permission>;
  disconnect(projectId: string, connectionId: string): Promise<void>;
  readDirectory(connectionId: string, path: string): Promise<FileEntry[]>;
  readFile(connectionId: string, path: string): Promise<FileSnapshot>;
  writeFile(connectionId: string, path: string, content: string, expected: string): Promise<void>;
  createFile(connectionId: string, path: string): Promise<void>;
  createDirectory(connectionId: string, path: string): Promise<void>;
  rename(connectionId: string, path: string, destination: string): Promise<void>;
  delete(connectionId: string, path: string): Promise<void>;
  exists(connectionId: string, path: string): Promise<boolean>;
}

