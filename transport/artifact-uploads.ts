import {promises as fs,createReadStream} from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {artifactId,ARTIFACT_LIMIT,type LocalArtifactStore,type StoredArtifact} from './artifact-store.ts';
export const UPLOAD_CHUNK=1048576,UPLOAD_COUNT=16,UPLOAD_TTL=86400000;
interface Checkpoint {meta:StoredArtifact;offset:number;updatedAt:number}
/** Acknowledged prefix is fsynced before an atomic checkpoint. A crash tail is truncated on resume. */
export class ArtifactUploads {
 private root:string;private store:LocalArtifactStore;private busy=new Set<string>();private creating=false;
 constructor(root:string,store:LocalArtifactStore){this.root=path.resolve(root);this.store=store;}
 private async safe(file:string){for(let cursor=file;;cursor=path.dirname(cursor)){try{if((await fs.lstat(cursor)).isSymbolicLink())throw Error('Upload links forbidden.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}if(path.dirname(cursor)===cursor)break;}await fs.mkdir(this.root,{recursive:true});}
 private file(meta:StoredArtifact){artifactId(meta.runId);artifactId(meta.runStepId);artifactId(meta.id);return path.join(this.root,meta.runId+'-'+meta.id);}
 private identity(meta:StoredArtifact){return JSON.stringify([meta.id,meta.runId,meta.runStepId,meta.projectId,meta.type,meta.name,meta.size,meta.checksum,meta.mimeType]);}
 private async load(meta:StoredArtifact){const file=this.file(meta);await this.safe(file);let checkpoint:Checkpoint;try{const name=file+'.json';await this.safe(name);if((await fs.stat(name)).size>8192)throw Error('Upload checkpoint limit.');checkpoint=JSON.parse(await fs.readFile(name,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;}
  if(!Number.isSafeInteger(checkpoint.offset)||checkpoint.offset<0||checkpoint.offset>meta.size||!Number.isFinite(checkpoint.updatedAt)||this.identity(checkpoint.meta)!==this.identity(meta))throw Error('Upload identity conflict.');
  const size=(await fs.stat(file)).size;if(size<checkpoint.offset)throw Error('Upload acknowledged prefix missing.');return checkpoint;
 }
 private async persist(file:string,value:Checkpoint){const temp=file+'.'+randomUUID()+'.tmp';await this.safe(temp);const handle=await fs.open(temp,'wx',0o600);try{await handle.writeFile(JSON.stringify(value));await handle.sync();}finally{await handle.close();}try{await fs.rename(temp,file+'.json');}catch(error){await fs.unlink(temp).catch(()=>{});throw error;}}
 async progress(meta:StoredArtifact){const record=await this.load(meta);return record?.offset??0;}
 async append(meta:StoredArtifact,start:number,body:AsyncIterable<Uint8Array>,chunkChecksum?:string){
  const file=this.file(meta);if(this.busy.has(file))throw Error('Upload busy; retry.');this.busy.add(file);
  try{
   if(!Number.isSafeInteger(meta.size)||meta.size<1||meta.size>ARTIFACT_LIMIT||!Number.isSafeInteger(start)||start<0||start>meta.size||!/^[a-f0-9]{64}$/.test(meta.checksum))throw Error('Upload limits.');
   let record=await this.load(meta);if(!record){if(this.creating)throw Error('Upload creation busy; retry.');this.creating=true;try{await this.expire();const checkpoints=(await fs.readdir(this.root)).filter(name=>name.endsWith('.json'));if(checkpoints.length>=UPLOAD_COUNT)throw Error('Upload capacity.');if(start!==0)throw Error('Upload offset conflict.');try{const handle=await fs.open(file,'wx',0o600);await handle.close();}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;await fs.truncate(file,0);}record={meta,offset:0,updatedAt:Date.now()};await this.persist(file,record);}finally{this.creating=false;}}
   if((await fs.stat(file)).size>record.offset)await fs.truncate(file,record.offset);
   if(start!==record.offset)throw Error('Upload offset conflict.');
   const chunks:Buffer[]=[];let length=0;for await(const chunk of body){length+=chunk.length;if(length>UPLOAD_CHUNK||start+length>meta.size)throw Error('Upload chunk limit.');chunks.push(Buffer.from(chunk));}
   if(length===0&&start!==meta.size)throw Error('Empty upload chunk.');
   if(chunkChecksum!==undefined&&createHash('sha256').update(Buffer.concat(chunks)).digest('hex')!==chunkChecksum)throw Error('Upload chunk checksum mismatch.');
   const handle=await fs.open(file,'r+');try{const bytes=Buffer.concat(chunks);let written=0;while(written<bytes.length){const result=await handle.write(bytes,written,bytes.length-written,start+written);if(!result.bytesWritten)throw Error('Upload short write.');written+=result.bytesWritten;}await handle.sync();}finally{await handle.close();}
   record={...record,offset:start+length,updatedAt:Date.now()};await this.persist(file,record);
   if(record.offset===meta.size){const saved=await this.store.put(record.meta,createReadStream(file));return {offset:record.offset,meta:saved};}
   return {offset:record.offset};
  }finally{this.busy.delete(file);}
 }
 async finish(meta:StoredArtifact){const file=this.file(meta);await this.safe(file);await fs.unlink(file+'.json').catch(error=>{if(error.code!=='ENOENT')throw error;});await fs.unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error;});}
 async expire(){await this.safe(this.root);for(const name of await fs.readdir(this.root)){if(!/^[a-f0-9-]{73}\.json$/.test(name))continue;const file=path.join(this.root,name);await this.safe(file);if((await fs.stat(file)).size>8192)throw Error('Upload checkpoint limit.');const record=JSON.parse(await fs.readFile(file,'utf8')) as Checkpoint;if(!Number.isFinite(record.updatedAt)||this.file(record.meta)+'.json'!==file)throw Error('Upload checkpoint identity.');if(record.updatedAt<Date.now()-UPLOAD_TTL&&!this.busy.has(file.slice(0,-5))){await this.finish(record.meta);}}}
}
