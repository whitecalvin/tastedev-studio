import { DatabaseSync, backup } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import { InMemoryCoreRepository } from '../src/features/core/repository.ts';
import type { CoreSnapshot } from '../src/features/core/domain.ts';

export const STORAGE_VERSION = 1;
export class StorageError extends Error {constructor(){super('Core storage write failed; no success was committed.');this.name='StorageError';}}
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
    let begun=false;
    try {
      this.db.exec('BEGIN IMMEDIATE');begun=true;
      const statement = this.db.prepare('INSERT INTO units(name,payload) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload');
      for (const [name, payload] of encoded) statement.run(name, payload);
      this.db.exec('COMMIT');
    } catch {if(begun)try{this.db.exec('ROLLBACK');}catch{/* SQLite FULL may already roll back. */}throw new StorageError();}
  }
  async backup(target: string) {
    if (!path.isAbsolute(target) || fs.existsSync(target)) throw new Error('Backup requires a new absolute path.');
    await backup(this.db, target);
  }
  close() { this.db.close(); this.key.fill(0); }
}

const keyHeader=Buffer.from('TASTESTUDIO_DPAPI_V1\n');
/** Windows keys are protected by the current user's DPAPI, Unix keys by mode 0600. */
function protectWindowsKey(bytes:Buffer,operation:'Protect'|'Unprotect'){
 const script="$ErrorActionPreference='Stop'; [void][Reflection.Assembly]::LoadWithPartialName('System.Security'); $data=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $result=[Security.Cryptography.ProtectedData]::"+operation+"($data,[Text.Encoding]::UTF8.GetBytes('tastestudio-core-key-v1'),[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result))";
 try{return Buffer.from(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{input:bytes.toString('base64'),encoding:'utf8',stdio:['pipe','pipe','pipe'],windowsHide:true}),'base64');}catch{throw new Error('Core storage key could not be protected or recovered for this Windows user.');}
}
export function storageKey(filename:string){
 const keyPath=filename+'.key';if(fs.existsSync(filename)&&!fs.existsSync(keyPath))throw new Error('Existing Core database key is missing; restore the matching key.');
 if(fs.existsSync(keyPath)){if(fs.lstatSync(keyPath).isSymbolicLink())throw new Error('Core storage key links are not allowed.');const data=fs.readFileSync(keyPath);
  if(data.subarray(0,keyHeader.length).equals(keyHeader)){if(process.platform!=='win32')throw new Error('Windows storage key requires the original Windows user.');const key=protectWindowsKey(data.subarray(keyHeader.length),'Unprotect');if(key.length!==32)throw new Error('Invalid Core storage key.');return key;}
  if(data.length!==32)throw new Error('Invalid Core storage key.');
  if(process.platform==='win32'){const wrapped=Buffer.concat([keyHeader,protectWindowsKey(data,'Protect')]);const temporary=keyPath+'.migrate-'+randomBytes(6).toString('hex');fs.writeFileSync(temporary,wrapped,{flag:'wx',mode:0o600});fs.renameSync(temporary,keyPath);}else fs.chmodSync(keyPath,0o600);return data;
 }
 fs.mkdirSync(path.dirname(filename),{recursive:true});const key=randomBytes(32),data=process.platform==='win32'?Buffer.concat([keyHeader,protectWindowsKey(key,'Protect')]):key;fs.writeFileSync(keyPath,data,{flag:'wx',mode:0o600});return key;
}

export class SqliteCoreRepository extends InMemoryCoreRepository {
  constructor(store: CoreStore) {
    const record = store.get<{state: CoreSnapshot; revision: number}>('core');
    if (record && (!Number.isSafeInteger(record.revision) || !['agents','jobs','runs','steps','artifacts','events'].every(k => Array.isArray(record.state[k as keyof CoreSnapshot])))) throw new Error('Invalid stored Core state.');
    if(record)validateReferences(record.state);
    super(record?.state, (state, revision) => {validateReferences(state);store.put('core', {state, revision});}, record?.revision);
  }
}
function validateReferences(state:CoreSnapshot){
  for(const rows of Object.values(state)){const ids=rows.map((r:{id:string})=>r.id);if(ids.some((id:string)=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)throw new Error('Core storage contains duplicate or invalid identities.');}
  const jobs=new Map(state.jobs.map(j=>[j.id,j])),runs=new Map(state.runs.map(r=>[r.id,r])),steps=new Map(state.steps.map(s=>[s.id,s]));
  for(const run of state.runs){if(jobs.get(run.jobId)?.projectId!==run.projectId||(['pending','running'].includes(run.status)&&!state.agents.some(a=>a.id===run.agentId)))throw new Error('Core storage has an invalid Run reference.');}
  for(const step of state.steps){const run=runs.get(step.runId);if(!run||!Number.isInteger(step.order)||step.order<0||!jobs.get(run.jobId)?.payload.steps[step.order])throw new Error('Core storage has an invalid Step reference.');}
  for(const a of state.artifacts)if(!runs.has(a.runId)||(a.runStepId&&steps.get(a.runStepId)?.runId!==a.runId))throw new Error('Core storage has an invalid Evidence reference.');
  const identities=state.jobs.filter(j=>j.idempotencyKey).map(j=>j.projectId+':'+j.idempotencyKey);if(new Set(identities).size!==identities.length)throw new Error('Core storage has duplicate dispatch identities.');
}
