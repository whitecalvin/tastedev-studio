import { DatabaseSync, backup } from 'node:sqlite';
import { createCipheriv, createDecipheriv, randomBytes, createHmac, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import { InMemoryCoreRepository } from '../src/features/core/repository.ts';
import {historyQuery} from '../src/features/core/history-query.ts';
import type { CoreSnapshot } from '../src/features/core/domain.ts';

export const STORAGE_VERSION = 2;
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
      for (const row of this.db.prepare('SELECT payload FROM units').iterate()) this.decode(row.payload as Uint8Array);
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
  putMany(values: [string, unknown][], projection?: () => void, removed: string[] = []) {
    const encoded = values.map(([name, value]) => [name, this.encode(value)] as const);
    let begun=false;
    try {
      this.db.exec('BEGIN IMMEDIATE');begun=true;
      const statement = this.db.prepare('INSERT INTO units(name,payload) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload');
      for (const [name, payload] of encoded) statement.run(name, payload);
      const remove=this.db.prepare('DELETE FROM units WHERE name=?');for(const name of removed)remove.run(name);
      projection?.();
      this.db.exec('COMMIT');
    } catch {if(begun)try{this.db.exec('ROLLBACK');}catch{/* SQLite FULL may already roll back. */}throw new StorageError();}
  }
  /** Derived, rebuildable projection. Names remain encrypted; equality keys use HMAC. */
  historyKey(value: string) { return createHmac('sha256',this.key).update('run-history-v1:'+value).digest('hex'); }
  prepareRunHistory() {
    this.db.exec('CREATE TABLE IF NOT EXISTS run_history (id TEXT PRIMARY KEY, project TEXT NOT NULL, status TEXT NOT NULL, created TEXT NOT NULL, payload BLOB NOT NULL); CREATE INDEX IF NOT EXISTS run_history_page ON run_history(project,created DESC,id DESC); CREATE INDEX IF NOT EXISTS run_history_status ON run_history(project,status,created DESC,id DESC); CREATE TABLE IF NOT EXISTS run_history_terms (run_id TEXT NOT NULL REFERENCES run_history(id) ON DELETE CASCADE, term TEXT NOT NULL, PRIMARY KEY(term,run_id)); CREATE INDEX IF NOT EXISTS run_history_terms_run ON run_history_terms(run_id);');
  }
  saveRunHistory(before: Map<string,RunHistoryRow>, state: CoreSnapshot) {
    const after=historyRows(state);
    const save=this.db.prepare('INSERT INTO run_history VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET project=excluded.project,status=excluded.status,created=excluded.created,payload=excluded.payload');
    const remove=this.db.prepare('DELETE FROM run_history WHERE id=?');
    for(const id of before.keys())if(!after.has(id))remove.run(id);
    const deleteTerms=this.db.prepare('DELETE FROM run_history_terms WHERE run_id=?'),term=this.db.prepare('INSERT INTO run_history_terms VALUES (?,?)');
    for(const [id,value] of after)if(JSON.stringify(before.get(id))!==JSON.stringify(value)){
      save.run(id,this.historyKey(value.projectId),this.historyKey(value.status),value.createdAt,this.encode(value));deleteTerms.run(id);
      for(const token of grams(value.name+' '+id))term.run(id,this.historyKey('search:'+token));
    }
    return after;
  }
  pageRuns(projectId: string,input: unknown) {
    const q=historyQuery(input),params: (string|number)[]=[this.historyKey(projectId)],where=['project=?'];
    if(q.status){where.push('status=?');params.push(this.historyKey(q.status));}
    if(q.from){where.push('julianday(created)>=julianday(?)');params.push(q.from);}
    if(q.to){where.push('julianday(created)<=julianday(?)');params.push(q.to);}
    const tokens=grams(q.search);if(tokens.size){const marks=[...tokens].map(()=>'?').join(',');where.push('id IN (SELECT run_id FROM run_history_terms WHERE term IN ('+marks+') GROUP BY run_id HAVING count(*)=?)');params.push(...[...tokens].map(token=>this.historyKey('search:'+token)),tokens.size);}
    const after=q.after?JSON.parse(q.after) as [string,string]:null;
    if(!q.search){
      const total=Number(this.db.prepare('SELECT count(*) AS n FROM run_history WHERE '+where.join(' AND ')).get(...params)?.n??0);
      if(after){where.push('(created<? OR (created=? AND id<?))');params.push(after[0],after[0],after[1]);}
      const rows=this.db.prepare('SELECT payload FROM run_history WHERE '+where.join(' AND ')+' ORDER BY created DESC,id DESC LIMIT ?').all(...params,q.limit+1);
      const values=rows.map(row=>this.decode(row.payload as Uint8Array) as RunHistoryRow);
      if(values.some(value=>value.projectId!==projectId))throw Error('Run history projection boundary mismatch.');
      const items=values.slice(0,q.limit),last=items.at(-1);
      return {items,total,next:values.length>q.limit&&last?JSON.stringify([last.createdAt,last.id]):null};
    }
    // Search streams only matching project/status/date metadata; it never clones Core state.
    const rows=this.db.prepare('SELECT payload FROM run_history WHERE '+where.join(' AND ')+' ORDER BY created DESC,id DESC').iterate(...params);
    const items: RunHistoryRow[]=[],search=q.search.toLowerCase();let total=0,hasNext=false;
    for(const row of rows){const value=this.decode(row.payload as Uint8Array) as RunHistoryRow;
      if(value.projectId!==projectId)throw Error('Run history projection boundary mismatch.');
      if(search&&!(''+value.name+' '+value.id).toLowerCase().includes(search))continue;
      total++;if(after&&(value.createdAt>after[0]||value.createdAt===after[0]&&value.id>=after[1]))continue;
      if(items.length<q.limit)items.push(value);else hasNext=true;
    }
    const last=items.at(-1);return {items,total,next:hasNext&&last?JSON.stringify([last.createdAt,last.id]):null};
  }
  async backup(target: string) {
    if (!path.isAbsolute(target) || fs.existsSync(target)) throw new Error('Backup requires a new absolute path.');
    await backup(this.db, target);
  }
  close() { this.db.close(); this.key.fill(0); }
}

function durableKeyFile(filename:string,data:Buffer){const fd=fs.openSync(filename,'wx',0o600);try{fs.writeFileSync(fd,data);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
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
  if(process.platform==='win32'){const wrapped=Buffer.concat([keyHeader,protectWindowsKey(data,'Protect')]);const temporary=keyPath+'.migrate-'+randomBytes(6).toString('hex');durableKeyFile(temporary,wrapped);fs.renameSync(temporary,keyPath);}else fs.chmodSync(keyPath,0o600);return data;
 }
 fs.mkdirSync(path.dirname(filename),{recursive:true});const key=randomBytes(32),data=process.platform==='win32'?Buffer.concat([keyHeader,protectWindowsKey(key,'Protect')]):key;durableKeyFile(keyPath,data);return key;
}

const coreKinds=['agents','jobs','runs','steps','artifacts','events'] as const;
interface CoreManifest {revision:number;ids:Record<keyof CoreSnapshot,string[]>}
function entityUnits(state:CoreSnapshot){const values=new Map<string,string>();for(const kind of coreKinds)for(const row of state[kind])values.set('core-row:'+kind+':'+row.id,JSON.stringify(row));return values;}
function digests(values:Map<string,string>){return new Map([...values].map(([name,value])=>[name,createHash('sha256').update(value).digest('hex')]));}
function manifest(state:CoreSnapshot,revision:number):CoreManifest {const ids={} as CoreManifest['ids'];for(const kind of coreKinds)ids[kind]=state[kind].map(row=>row.id);return {revision,ids};}
function loadCore(store:CoreStore){
 const saved=store.get<CoreManifest>('core-manifest-v1');if(!saved)return store.get<{state:CoreSnapshot;revision:number}>('core');
 if(!Number.isSafeInteger(saved.revision)||!saved.ids||coreKinds.some(k=>!Array.isArray(saved.ids[k])||saved.ids[k].some(id=>typeof id!=='string'||!id)||new Set(saved.ids[k]).size!==saved.ids[k].length))throw Error('Invalid stored Core manifest.');
 const state={} as CoreSnapshot;for(const kind of coreKinds)Object.assign(state,{[kind]:saved.ids[kind].map(id=>{const row=store.get<{id:string}>('core-row:'+kind+':'+id);if(!row||row.id!==id)throw Error('Missing stored Core entity.');return row;})});
 return {state,revision:saved.revision};
}
export class SqliteCoreRepository extends InMemoryCoreRepository {
  constructor(store: CoreStore) {
    const record = loadCore(store);
    if (record && (!Number.isSafeInteger(record.revision) || !coreKinds.every(k => Array.isArray(record.state[k])))) throw new Error('Invalid stored Core state.');
    if(record)validateReferences(record.state);
    store.prepareRunHistory();
    let previous=digests(entityUnits(record?.state??{agents:[],jobs:[],runs:[],steps:[],artifacts:[],events:[]})),previousHistory=historyRows(record?.state);
    // Migrate the encrypted monolith and rebuild derived indexes in one transaction.
    const legacy=record&&!store.get('core-manifest-v1');
    if(legacy||store.get<number>('run-history-revision')!==(record?.revision??0)||store.get<number>('run-history-index-format')!==2||Number(store.db.prepare('PRAGMA user_version').get()?.user_version)<2){
      const units: [string,unknown][]=[['run-history-revision',record?.revision??0],['run-history-index-format',2]];
      if(legacy){for(const [name,value] of entityUnits(record.state))units.push([name,JSON.parse(value)]);units.push(['core-manifest-v1',manifest(record.state,record.revision)]);}
      store.putMany(units,()=>{store.db.exec('DELETE FROM run_history');store.saveRunHistory(new Map(),record?.state??{agents:[],jobs:[],runs:[],steps:[],artifacts:[],events:[]});store.db.exec('INSERT OR IGNORE INTO migrations VALUES (2, CURRENT_TIMESTAMP); PRAGMA user_version=2;');},legacy?['core']:[]);
    }
    super(record?.state, (state, revision) => {
      validateReferences(state);
      const next=entityUnits(state),nextDigests=digests(next),values: [string,unknown][]=[['core-manifest-v1',manifest(state,revision)],['run-history-revision',revision]],removed=[...previous.keys()].filter(name=>!next.has(name));
      for(const [name,value] of next)if(previous.get(name)!==nextDigests.get(name))values.push([name,JSON.parse(value)]);
      let nextHistory=previousHistory;
      store.putMany(values,()=>{nextHistory=store.saveRunHistory(previousHistory,state);},removed);
      previous=nextDigests;previousHistory=nextHistory;
    }, record?.revision);
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

interface RunHistoryRow {id:string;projectId:string;createdAt:string;status:string;name:string;agentId:string;finishedAt:string|null}
function historyRows(state?:CoreSnapshot){const jobs=new Map(state?.jobs.map(j=>[j.id,j])??[]);return new Map(state?.runs.map(r=>[r.id,{id:r.id,projectId:r.projectId,createdAt:r.createdAt,status:r.status,name:jobs.get(r.jobId)?.name??r.id,agentId:r.agentId,finishedAt:r.finishedAt}])??[]);}

function grams(value:string){const text=value.toLowerCase(),result=new Set<string>();for(let i=0;i<=text.length-3;i++)result.add(text.slice(i,i+3));return result;}
