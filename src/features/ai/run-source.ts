import {verifyProjectManifest,type ProjectSnapshot} from './project-snapshot.ts';
import {bytesHash,projectSnapshotLimits} from './snapshot-bytes.ts';
import {AIError,limits} from './domain.ts';
import {aiPath,allowedPath,uuid} from './security.ts';
import type {WorkspaceFileService} from '../filesystem/file-service.ts';
export interface RunSourceIdentity {runId:string;snapshotId:string;checksum:string}
export async function immutableRunSource(project:string,runId:string,request:(path:string,max:number,signal:AbortSignal)=>Promise<unknown>,signal:AbortSignal){
 uuid(project);uuid(runId);const base='/sources/run/'+runId+'/',manifest=await request(base+'manifest',projectSnapshotLimits.manifestBytes,signal) as ProjectSnapshot;await verifyProjectManifest(manifest);signal.throwIfAborted();if(manifest.projectId!==project||manifest.files.some(f=>f.content!==''))throw new AIError('permission');
 const pinned=structuredClone(manifest),cache=new Map<string,string>();
 const files:Pick<WorkspaceFileService,'list'|'read'>={
  list:async(dir:string)=>{signal.throwIfAborted();if(dir)aiPath(dir);const entries=new Map<string,{name:string;path:string;kind:'file'|'directory'}>();for(const f of pinned.files){if(!allowedPath(f.path)||dir&&!f.path.startsWith(dir+'/'))continue;const rest=dir?f.path.slice(dir.length+1):f.path,part=rest.split('/')[0],path=dir?dir+'/'+part:part;entries.set(path,{name:part,path,kind:rest.includes('/')?'directory':'file'});}return [...entries.values()];},
  read:async(path:string)=>{aiPath(path);signal.throwIfAborted();const f=pinned.files.find(f=>f.path===path);if(!f||f.encoding!=='utf8'||f.size!>limits.file)throw new AIError('tool-failure');let content=cache.get(path);if(content===undefined){const row=await request(base+f.checksum,limits.file*6+2048,signal) as {path:string;content:string;checksum:string};signal.throwIfAborted();if(row.checksum!==f.checksum||typeof row.content!=='string'||row.content.includes('\0')||new TextEncoder().encode(row.content).length!==f.size||await bytesHash(new TextEncoder().encode(row.content))!==f.checksum)throw new AIError('tool-failure');content=row.content;cache.set(path,content);}return{content,size:f.size!,modified:0};}
 };return {paths:pinned.files.filter(f=>allowedPath(f.path)&&f.encoding==='utf8'&&f.size!<=limits.file).map(f=>f.path),files,identity:{runId,snapshotId:pinned.snapshotId,checksum:pinned.checksum} satisfies RunSourceIdentity};
}
