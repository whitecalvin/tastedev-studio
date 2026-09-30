import { DatabaseSync, backup } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import { InMemoryCoreRepository } from '../src/features/core/repository.ts';
import type { CoreSnapshot } from '../src/features/core/domain.ts';

export const STORAGE_VERSION = 1;
/** Server-only encrypted units of work. Provider credentials are never store inputs.
 * FULL SQLite transactions are the authority; callers publish only after put succeeds.
 * One Core writer holds an exclusive lock for the lifetime of this connection. */
export class CoreStore {
  readonly db: DatabaseSync;
  private key: Buffer;
  constructor(filename: string, key: Uint8Array) {
    if (key.length !== 32) throw new Error('Core storage requires a 32-byte key.');
    this.key = Buffer.from(key);
    if (filename !== ':memory:') {
      if (!path.isAbsolute(filename)) throw new Error('Core storage path must be absolute.');
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      if (fs.existsSync(filename) && fs.lstatSync(filename).isSymbolicLink()) throw new Error('Core storage links are not allowed.');
    }
    this.db = new DatabaseSync(filename, { timeout: 1000 });
    try {
      this.db.exec('PRAGMA locking_mode=EXCLUSIVE; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
      if (this.db.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok') throw new Error('Core storage integrity check failed.');
      const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version);
      if (version > STORAGE_VERSION) throw new Error('Core storage schema is newer than this runtime.');
      this.db.exec('BEGIN EXCLUSIVE');
      try {
        if (version < 1) this.db.exec('CREATE TABLE units (name TEXT PRIMARY KEY, payload BLOB NOT NULL); CREATE TABLE migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL); INSERT INTO migrations VALUES (1, CURRENT_TIMESTAMP); PRAGMA user_version=1;');
        this.db.exec('COMMIT');
      } catch (e) { this.db.exec('ROLLBACK'); throw e; }
      // Validate the key before any mutation of an existing database.
      for (const row of this.db.prepare('SELECT payload FROM units').all()) this.decode(row.payload as Uint8Array);
    } catch (e) { this.db.close(); this.key.fill(0); throw e; }
  }
  private encode(value: unknown) {
    const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    cipher.setAAD(Buffer.from('tastestudio-core-unit-v1'));
    return Buffer.concat([nonce, cipher.update(JSON.stringify(value), 'utf8'), cipher.final(), cipher.getAuthTag()]);
  }
  private decode(payload: Uint8Array): unknown {
    const bytes = Buffer.from(payload);
    if (bytes.length < 28) throw new Error('Core storage payload is corrupt.');
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12));
      decipher.setAAD(Buffer.from('tastestudio-core-unit-v1')); decipher.setAuthTag(bytes.subarray(-16));
      return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8'));
    } catch { throw new Error('Core storage key or payload integrity is invalid.'); }
  }
  get<T>(name: string): T | undefined {
    const row = this.db.prepare('SELECT payload FROM units WHERE name=?').get(name);
    return row ? this.decode(row.payload as Uint8Array) as T : undefined;
  }
  put(name: string, value: unknown) { this.putMany([[name, value]]); }
  names(prefix:string){return this.db.prepare('SELECT name FROM units WHERE substr(name,1,?)=? ORDER BY name').all(prefix.length,prefix).map(r=>String(r.name));}
  putMany(values: [string, unknown][]) {
    const encoded = values.map(([name, value]) => [name, this.encode(value)] as const);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const statement = this.db.prepare('INSERT INTO units(name,payload) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload');
      for (const [name, payload] of encoded) statement.run(name, payload);
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  async backup(target: string) {
    if (!path.isAbsolute(target) || fs.existsSync(target)) throw new Error('Backup requires a new absolute path.');
    await backup(this.db, target);
  }
  close() { this.db.close(); this.key.fill(0); }
}

export function storageKey(filename: string) {
  const keyPath = filename + '.key';
  if (fs.existsSync(filename) && !fs.existsSync(keyPath)) throw new Error('Existing Core database key is missing; restore the matching key.');
  if (fs.existsSync(keyPath)) {
    if (fs.lstatSync(keyPath).isSymbolicLink()) throw new Error('Core storage key links are not allowed.');
    protectKey(keyPath);const key = fs.readFileSync(keyPath); if (key.length !== 32) throw new Error('Invalid Core storage key.'); return key;
  }
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const key = randomBytes(32); fs.writeFileSync(keyPath, key, { flag: 'wx', mode: 0o600 });protectKey(keyPath); return key;
}
/** Restrict the storage key, not project credential files. Never print its bytes. */
function protectKey(filename:string){
  if(process.platform!=='win32'){fs.chmodSync(filename,0o600);return;}
  const encoded=Buffer.from(filename,'utf16le').toString('base64');
  const script="$ErrorActionPreference='Stop'; $keyFile=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('"+encoded+"')); $acl=New-Object System.Security.AccessControl.FileSecurity; $acl.SetAccessRuleProtection($true,$false); $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User; $acl.SetOwner($owner); $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($owner,'FullControl','Allow'))); $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier('S-1-5-18')),'FullControl','Allow'))); Set-Acl -LiteralPath $keyFile -AclObject $acl";
  try{execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{stdio:'pipe',windowsHide:true});}catch{throw new Error('Core storage key permissions could not be secured.');}
}

export class SqliteCoreRepository extends InMemoryCoreRepository {
  constructor(store: CoreStore) {
    const record = store.get<{state: CoreSnapshot; revision: number}>('core');
    if (record && (!Number.isSafeInteger(record.revision) || !['agents','jobs','runs','steps','artifacts','events'].every(k => Array.isArray(record.state[k as keyof CoreSnapshot])))) throw new Error('Invalid stored Core state.');
    super(record?.state, (state, revision) => store.put('core', {state, revision}), record?.revision);
  }
}
