import { normalizePath } from '../filesystem/paths.ts';
export interface RunConfiguration { id: string; name: string; command: string; args: string[]; cwd: string; env: Record<string, string>; type: 'terminal' | 'task' }
export type ConfigurationInput = Omit<RunConfiguration, 'id'>;
export function validateConfiguration(value: unknown): ConfigurationInput {
  if (!value || typeof value !== 'object') throw new Error('Invalid run configuration.');
  const v = value as Record<string, unknown>;
  const validText = (text: unknown, limit: number) => typeof text === 'string' && text.length <= limit && !/[\0\r\n]/.test(text);
  if (!validText(v.name, 100) || !(v.name as string).trim()) throw new Error('Enter a configuration name (up to 100 characters).');
  if (!validText(v.command, 1024) || !(v.command as string).trim()) throw new Error('Enter an executable. Arguments belong in the arguments field.');
  if (!Array.isArray(v.args) || v.args.length > 128 || !v.args.every(a => validText(a, 8192))) throw new Error('Arguments must be an array of up to 128 strings without line breaks or NUL.');
  if (typeof v.cwd !== 'string') throw new Error('Working directory must be relative to the workspace.');
  let cwd: string;
  try { cwd = normalizePath(v.cwd.trim()); } catch { throw new Error('Working directory must stay inside the workspace. Use a relative path such as src or .'); }
  if (v.type !== 'terminal' && v.type !== 'task') throw new Error('Select Terminal or Task output.');
  if (!v.env || typeof v.env !== 'object' || Array.isArray(v.env)) throw new Error('Environment must be a JSON object of string values.');
  const entries = Object.entries(v.env);
  if (entries.length > 128 || entries.some(([key, val]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || !validText(val, 8192))) throw new Error('Environment names must be identifiers and values must be strings without line breaks or NUL.');
  return { name: (v.name as string).trim(), command: (v.command as string).trim(), args: [...v.args], cwd, env: Object.fromEntries(entries) as Record<string, string>, type: v.type };
}
export interface ConfigurationStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface ConfigurationRepository { read(projectId: string): RunConfiguration[]; write(projectId: string, configurations: RunConfiguration[]): void }
export class BrowserConfigurationRepository implements ConfigurationRepository {
  private storage: () => ConfigurationStorage;
  constructor(storage: () => ConfigurationStorage) { this.storage = storage; }
  private key(id: string) { return `tastedev.studio.run.v1:${encodeURIComponent(id)}`; }
  read(projectId: string) {
    const raw = this.storage().getItem(this.key(projectId)); if (!raw) return [];
    try {
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object') throw new Error();
      const data = value as { version?: unknown; configurations?: unknown };
      if (data.version !== 1 || !Array.isArray(data.configurations) || data.configurations.length > 100) throw new Error();
      const ids = new Set<string>();
      return data.configurations.map((item: unknown) => {
        const config = validateConfiguration(item), id = (item as { id?: unknown }).id;
        if (typeof id !== 'string' || !id || id.length > 100 || ids.has(id)) throw new Error();
        ids.add(id); return { ...config, id };
      });
    } catch { throw new Error('Saved run configurations are invalid. Stored data has not been changed.'); }
  }
  write(projectId: string, configurations: RunConfiguration[]) {
    try { this.storage().setItem(this.key(projectId), JSON.stringify({ version: 1, configurations })); }
    catch { throw new Error('Run configurations could not be saved. Check browser storage access or available space.'); }
  }
}
export class RunConfigurationService {
  private repository: ConfigurationRepository;
  constructor(repository: ConfigurationRepository) { this.repository = repository; }
  list(projectId: string) { return this.repository.read(projectId); }
  save(projectId: string, input: unknown, id?: string) {
    const value = validateConfiguration(input), all = this.list(projectId);
    if (id && !all.some(c => c.id === id)) throw new Error('This configuration no longer exists. Reload the list.');
    if (!id && all.length >= 100) throw new Error('A project can hold up to 100 run configurations.');
    const next = { ...value, id: id ?? crypto.randomUUID() };
    this.repository.write(projectId, id ? all.map(c => c.id === id ? next : c) : [...all, next]); return next;
  }
  delete(projectId: string, id: string) { this.repository.write(projectId, this.list(projectId).filter(c => c.id !== id)); }
}
