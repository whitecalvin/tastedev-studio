import fs from 'node:fs';import path from 'node:path';
import {SourceSnapshotStore} from './source-snapshot-store.ts';import {uuid} from '../src/features/ai/security.ts';
/** Only completed, verified snapshots belong to an offline backup. Upload journals
 * and temporary grants are deliberately not restored as executable authority. */
export async function snapshotBackupFiles(root:string){
 const store=new SourceSnapshotStore(root),files=new Set<string>(),snapshots=new Map<string,string>();let bytes=0,incomplete=0;
 const directory=path.join(root,'manifests');if(!fs.existsSync(directory))return{files:[],snapshots,bytes,incomplete};
 noSnapshotLinks(directory);
 for(const project of fs.readdirSync(directory,{withFileTypes:true})){
  uuid(project.name);if(!project.isDirectory())throw Error('Invalid Source backup directory.');const base=path.join(directory,project.name);noSnapshotLinks(base);
  for(const name of fs.readdirSync(base)){
   if(!name.endsWith('.json'))continue;uuid(name.slice(0,-5));const snapshotId=name.slice(0,-5),marker=path.join(base,name+'.complete');
   if(!fs.existsSync(marker)){incomplete++;continue;}
   noSnapshotLinks(marker);const checksum=fs.readFileSync(marker,'utf8');const manifest=await store.completed(project.name,snapshotId,checksum);
   snapshots.set(project.name+'/'+snapshotId,manifest.checksum);files.add(`manifests/${project.name}/${name}`);files.add(`manifests/${project.name}/${name}.complete`);
   for(const f of manifest.files){await store.blob(project.name,f.checksum,f.size!);const relative=`blobs/${project.name}/${f.checksum}`;if(!files.has(relative)){bytes+=f.size!;if(bytes>512*1024*1024)throw Error('Source backup capacity.');files.add(relative);}}
  }
 }
 return{files:[...files].sort(),snapshots,bytes,incomplete};
}
export function noSnapshotLinks(file:string){for(let cursor=path.resolve(file);;cursor=path.dirname(cursor)){if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())throw Error('Backup links are forbidden.');if(path.dirname(cursor)===cursor)break;}}
export function assertSnapshotReferences(jobs:{projectId:string;payload:{steps:{source?:unknown}[]}}[],snapshots:Map<string,string>){for(const job of jobs)for(const step of job.payload.steps){const source=step.source as {provider?:string;snapshot?:{schemaVersion?:number;projectId:string;snapshotId:string;checksum:string}}|undefined;if(source?.provider==='snapshot'&&source.snapshot?.schemaVersion===2){const s=source.snapshot;if(s.projectId!==job.projectId||snapshots.get(s.projectId+'/'+s.snapshotId)!==s.checksum)throw Error('Referenced Source snapshot is missing or corrupt.');}}}
