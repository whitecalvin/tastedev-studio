import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {CoreStore,SqliteCoreRepository,storageKey} from './storage.ts';import {LocalArtifactStore} from './artifact-store.ts';
interface Manifest {version:1;createdAt:string;schema:1;files:{path:string;size:number;sha256:string}[];artifactCount:number}
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function noLinks(file:string){let current=path.resolve(file);while(true){if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Backup links are forbidden.');const parent=path.dirname(current);if(parent===current)break;current=parent;}}
function newDirectory(target:string){if(!path.isAbsolute(target)||fs.existsSync(target))throw Error('A new absolute backup/restore directory is required.');noLinks(target);fs.mkdirSync(target,{recursive:true,mode:0o700});}
export async function backupCore(database:string,artifactRoot:string,target:string){
 if(!fs.existsSync(database))throw Error('Core database does not exist.');noLinks(database);const key=storageKey(database),store=new CoreStore(database,key);
 try{const snapshot=new SqliteCoreRepository(store).read();newDirectory(target);const db=path.join(target,'core.sqlite');await store.backup(db);fs.copyFileSync(database+'.key',db+'.key',fs.constants.COPYFILE_EXCL);fs.chmodSync(db+'.key',0o600);const artifacts=new LocalArtifactStore(artifactRoot),names=['core.sqlite','core.sqlite.key'];let artifactCount=0;
  for(const a of snapshot.artifacts){if(a.deletedAt||!a.location.startsWith('/artifacts/'))continue;const value=await artifacts.get(a.runId,a.id);if(value.meta.size!==a.size||value.meta.checksum!==a.checksum)throw Error('Evidence reference does not match stored body.');const dir=path.join(target,'artifacts',a.runId);fs.mkdirSync(dir,{recursive:true});const body=`artifacts/${a.runId}/${a.id}`,meta=body+'.json';fs.writeFileSync(path.join(target,body),value.bytes,{flag:'wx'});fs.writeFileSync(path.join(target,meta),JSON.stringify(value.meta),{flag:'wx'});names.push(body,meta);artifactCount++;}
  const manifest:Manifest={version:1,schema:1,createdAt:new Date().toISOString(),artifactCount,files:names.map(name=>{const b=fs.readFileSync(path.join(target,name));return{path:name,size:b.length,sha256:hash(b)};})};fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});return manifest;
 }finally{store.close();key.fill(0);}
}
export async function restoreCore(bundle:string,target:string){
 noLinks(bundle);const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'manifest.json'),'utf8')) as Manifest;
 if(manifest.version!==1||manifest.schema!==1||!Array.isArray(manifest.files)||manifest.files.length<2||manifest.files.length>100000||new Set(manifest.files.map(f=>f.path)).size!==manifest.files.length||!manifest.files.some(f=>f.path==='core.sqlite')||!manifest.files.some(f=>f.path==='core.sqlite.key'))throw Error('Invalid backup manifest.');
 const allowed=/^(core\.sqlite(?:\.key)?|artifacts\/[0-9a-f-]{36}\/[0-9a-f-]{36}(?:\.json)?)$/i;
 for(const f of manifest.files){if(!allowed.test(f.path)||path.isAbsolute(f.path)||f.path.includes('..'))throw Error('Backup path traversal blocked.');const file=path.join(bundle,f.path);noLinks(file);const b=fs.readFileSync(file);if(b.length!==f.size||hash(b)!==f.sha256)throw Error('Backup checksum mismatch.');}
 // Verify DB and encryption key before creating any restore output.
 const originalDb=path.join(bundle,'core.sqlite'),originalKey=storageKey(originalDb),check=new CoreStore(originalDb,originalKey);try{new SqliteCoreRepository(check);}finally{check.close();originalKey.fill(0);}
 newDirectory(target);for(const f of manifest.files){const file=path.join(target,f.path);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.copyFileSync(path.join(bundle,f.path),file,fs.constants.COPYFILE_EXCL);if(f.path.endsWith('.key'))fs.chmodSync(file,0o600);}
 const database=path.join(target,'core.sqlite'),key=storageKey(database),restored=new CoreStore(database,key);try{const snapshot=new SqliteCoreRepository(restored).read(),artifacts=new LocalArtifactStore(path.join(target,'artifacts'));for(const a of snapshot.artifacts){if(a.deletedAt||!a.location.startsWith('/artifacts/'))continue;const v=await artifacts.get(a.runId,a.id);if(v.meta.checksum!==a.checksum||v.meta.size!==a.size)throw Error('Restored Evidence mismatch.');}}finally{restored.close();key.fill(0);}
 return{database,artifactRoot:path.join(target,'artifacts'),artifactCount:manifest.artifactCount};
}
