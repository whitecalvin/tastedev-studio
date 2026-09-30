import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Artifact } from '../src/features/core/domain.ts';
export const ARTIFACT_LIMIT=32*1024*1024, RUN_LIMIT=128*1024*1024, STORE_LIMIT=1024*1024*1024, COUNT_LIMIT=40;
export const artifactMime={screenshot:'image/png',trace:'application/zip','test-report':'application/json','browser-console':'application/json','page-errors':'application/json','network-log':'application/json'} as const;
export type StoredArtifact=Artifact & {runStepId:string;mimeType:string;checksum:string;projectId:string};
export interface ArtifactStore { put(meta:StoredArtifact,bytes:AsyncIterable<Uint8Array>):Promise<StoredArtifact>; get(runId:string,id:string):Promise<{meta:StoredArtifact;bytes:Buffer}>; delete(runId:string,id:string):Promise<void> }
export function artifactId(value:string){if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value))throw new Error('Invalid artifact identity.');return value;}
export class LocalArtifactStore implements ArtifactStore {
  private root:string; private busy=false;
  constructor(root:string){this.root=path.resolve(root);}
  private async safe(dir:string){
    const relative=path.relative(this.root,dir);if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Artifact path escape.');
    // Reject links in every existing ancestor, including the configured root.
    let cursor=dir;while(true){try{if((await fs.lstat(cursor)).isSymbolicLink())throw new Error('Artifact links are forbidden.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;}
    await fs.mkdir(dir,{recursive:true});
  }
  private location(run:string,id:string){return path.join(this.root,artifactId(run),artifactId(id));}
  async put(meta:StoredArtifact,bytes:AsyncIterable<Uint8Array>){
    artifactId(meta.runStepId);const file=this.location(meta.runId,meta.id);
    if(!Object.hasOwn(artifactMime,meta.type)||artifactMime[meta.type as keyof typeof artifactMime]!==meta.mimeType||!Number.isSafeInteger(meta.size)||meta.size<1||meta.size>ARTIFACT_LIMIT||!/^[a-f0-9]{64}$/.test(meta.checksum)||!/^[A-Za-z0-9_.-]{1,120}$/.test(meta.name))throw new Error('Invalid artifact metadata or size limit.');
    if(this.busy)throw new Error('Artifact store busy; retry.');this.busy=true;let temp:string|undefined;
    try{
      await this.safe(path.dirname(file));
      try{const existing=await this.get(meta.runId,meta.id);if(existing.meta.checksum!==meta.checksum||existing.meta.size!==meta.size||existing.meta.runStepId!==meta.runStepId||existing.meta.projectId!==meta.projectId||existing.meta.type!==meta.type)throw new Error('Artifact ID collision.');let received=0;const duplicateHash=createHash('sha256');for await(const chunk of bytes){received+=chunk.length;if(received>meta.size)throw new Error('Artifact size mismatch.');duplicateHash.update(chunk);}if(received!==meta.size||duplicateHash.digest('hex')!==meta.checksum)throw new Error('Artifact checksum or size mismatch.');return existing.meta;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
      let runSize=0,total=0,count=0;
      for(const dir of await fs.readdir(this.root,{withFileTypes:true})){if(!dir.isDirectory())continue;artifactId(dir.name);await this.safe(path.join(this.root,dir.name));for(const entry of await fs.readdir(path.join(this.root,dir.name))){if(!entry.endsWith('.json'))continue;const old=JSON.parse(await fs.readFile(path.join(this.root,dir.name,entry),'utf8')) as StoredArtifact;total+=old.size;if(dir.name===meta.runId){runSize+=old.size;count++;}}}
      if(count>=COUNT_LIMIT||runSize+meta.size>RUN_LIMIT||total+meta.size>STORE_LIMIT)throw new Error('Artifact retention limit reached; delete old evidence.');
      temp=`${file}.${randomUUID()}.partial`;const handle=await fs.open(temp,'wx');const hash=createHash('sha256');let size=0;
      try{for await(const chunk of bytes){size+=chunk.length;if(size>meta.size||size>ARTIFACT_LIMIT)throw new Error('Artifact size mismatch.');hash.update(chunk);await handle.writeFile(chunk);}if(size!==meta.size||hash.digest('hex')!==meta.checksum)throw new Error('Artifact checksum or size mismatch.');await handle.sync();}finally{await handle.close();}
      const saved={...meta,location:`/artifacts/${meta.runId}/${meta.id}`};
      await fs.rename(temp,file);temp=undefined;
      try{await fs.writeFile(`${file}.json`,JSON.stringify(saved),{flag:'wx'});}catch(e){await fs.unlink(file);throw e;}
      return saved;
    }finally{if(temp)await fs.unlink(temp).catch(()=>{});this.busy=false;}
  }
  async get(run:string,id:string){const file=this.location(run,id);await this.safe(path.dirname(file));for(const p of [file,`${file}.json`])if((await fs.lstat(p)).isSymbolicLink())throw new Error('Artifact link forbidden.');const meta=JSON.parse(await fs.readFile(`${file}.json`,'utf8')) as StoredArtifact;const bytes=await fs.readFile(file);if(bytes.length!==meta.size||createHash('sha256').update(bytes).digest('hex')!==meta.checksum)throw new Error('Stored artifact integrity failure.');return {meta,bytes};}
  async delete(run:string,id:string){const file=this.location(run,id);await this.get(run,id);await fs.unlink(`${file}.json`);await fs.unlink(file);}
}
