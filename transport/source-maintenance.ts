import {graphSourceReferences} from './graph-source-references.ts';
import fs from 'node:fs';import path from 'node:path';
import {SourceSnapshotStore} from './source-snapshot-store.ts';
import {noSnapshotLinks,snapshotBackupFiles,assertSnapshotReferences} from './snapshot-backup.ts';
import {CoreStore,SqliteCoreRepository,storageKey} from './storage.ts';
import {uuid} from '../src/features/ai/security.ts';
import type {Job} from '../src/features/core/domain.ts';

/** Caller must hold the exclusive Core database connection for the whole operation.
 * Preserve every history/job reference, incomplete upload and recent snapshot.
 * No backup path is accepted; backups live outside this owned source root. */
export async function maintainSources(root:string,jobs:Pick<Job,'projectId'|'payload'>[],cutoff:number,apply=false){
 if(!path.isAbsolute(root)||!Number.isFinite(cutoff)||cutoff>Date.now())throw Error('Invalid Source retention cutoff.');
 noSnapshotLinks(root);
 const store=new SourceSnapshotStore(root),backup=await snapshotBackupFiles(root);
 assertSnapshotReferences(jobs,backup.snapshots);
 const referenced=new Set<string>();for(const job of jobs)for(const step of job.payload.steps){const s=step.source;if(s?.provider==='snapshot'&&s.snapshot.schemaVersion===2)referenced.add(s.snapshot.projectId+'/'+s.snapshot.snapshotId);}
 const candidates:{file:string;marker:string;key:string}[]=[],retainedBlobs=new Set<string>();let snapshots=0,incomplete=0,retained=0;
 const manifests=path.join(root,'manifests');
 if(fs.existsSync(manifests))for(const project of fs.readdirSync(manifests,{withFileTypes:true})){
  uuid(project.name);if(!project.isDirectory())throw Error('Invalid Source project directory.');const directory=path.join(manifests,project.name);noSnapshotLinks(directory);
  for(const name of fs.readdirSync(directory)){
   if(name.endsWith('.json.complete'))continue;
   if(!name.endsWith('.json'))throw Error('Unknown Source manifest entry.');uuid(name.slice(0,-5));
   const file=path.join(directory,name),marker=file+'.complete',snapshot=await store.manifest(project.name,name.slice(0,-5)),key=project.name+'/'+snapshot.snapshotId;
   noSnapshotLinks(file);noSnapshotLinks(marker);const stat=fs.statSync(file);if(!stat.isFile())throw Error('Invalid Source manifest file.');snapshots++;
   const complete=fs.existsSync(marker);if(!complete)incomplete++;
   if(complete&&!referenced.has(key)&&stat.mtimeMs<cutoff)candidates.push({file,marker,key});
   else{retained++;for(const f of snapshot.files)retainedBlobs.add(project.name+'/'+f.checksum);}
  }
 }
 const orphanBlobs:{file:string;size:number}[]=[],blobs=path.join(root,'blobs');let bytes=0,blobCount=0;
 if(fs.existsSync(blobs)){noSnapshotLinks(blobs);for(const project of fs.readdirSync(blobs,{withFileTypes:true})){
  uuid(project.name);if(!project.isDirectory())throw Error('Invalid Source blob directory.');const directory=path.join(blobs,project.name);noSnapshotLinks(directory);
  for(const name of fs.readdirSync(directory)){
   if(!/^[a-f0-9]{64}$/.test(name))throw Error('Unknown Source blob entry.');const file=path.join(directory,name);noSnapshotLinks(file);const stat=fs.statSync(file);if(!stat.isFile())throw Error('Invalid Source blob file.');bytes+=stat.size;blobCount++;
   if(!retainedBlobs.has(project.name+'/'+name)&&stat.mtimeMs<cutoff)orphanBlobs.push({file,size:stat.size});
  }
 }}
 // All identities, references and completed checksums were validated before deletion.
 // Interrupted deletion is safe: a remaining manifest protects its bytes on retry.
 if(apply){for(const candidate of candidates){fs.unlinkSync(candidate.marker);fs.unlinkSync(candidate.file);}for(const blob of orphanBlobs)fs.unlinkSync(blob.file);}
 return{mode:apply?'APPLIED':'PREVIEW',snapshots,retained,incomplete,referenced:referenced.size,blobCount,bytes,reclaimableSnapshots:candidates.length,reclaimableBlobs:orphanBlobs.length,reclaimableBytes:orphanBlobs.reduce((n,f)=>n+f.size,0),cutoff:new Date(cutoff).toISOString()};
}
export async function offlineSourceMaintenance(database:string,artifactRoot:string,cutoff:number,apply=false){
 noSnapshotLinks(database);if(!fs.existsSync(database))throw Error('Existing Core database required.');
 const key=storageKey(database,true);let store:CoreStore|undefined;
 try{store=new CoreStore(database,key);const jobs=new SqliteCoreRepository(store).read().jobs;return await maintainSources(artifactRoot+'-sources',[...jobs,...graphSourceReferences(store)],cutoff,apply);}
 finally{store?.close();key.fill(0);}
}
