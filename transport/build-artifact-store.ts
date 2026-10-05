import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {validateBuildArtifact,type BuildArtifact} from '../src/features/orchestration/build-artifact.ts';

export const BUILD_STORE_LIMIT=1024*1024*1024,BUILD_STORE_COUNT=2000;
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export class BuildArtifactStore {
 private readonly root:string;private busy=false;
 constructor(root:string){this.root=path.resolve(root);}
 private async safe(dir:string){
  const relative=path.relative(this.root,dir);if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Build artifact storage escape.');
  let cursor=dir;for(;;){try{if((await fs.lstat(cursor)).isSymbolicLink())throw Error('Build artifact links forbidden.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;}
  await fs.mkdir(dir,{recursive:true});
 }
 private file(a:BuildArtifact){return path.join(this.root,a.projectId,a.id);}
 async get(projectId:string,id:string):Promise<{artifact:BuildArtifact;bytes:Buffer}> {
  if(!/^[A-Za-z0-9_-]{1,120}$/.test(projectId)||!/^[A-Za-z0-9_-]{1,120}$/.test(id))throw Error('Invalid build artifact identity.');
  const file=path.join(this.root,projectId,id);await this.safe(path.dirname(file));
  for(const p of [file,file+'.json']){const stat=await fs.lstat(p);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw Error('Build artifact regular file required.');}
  const metaStat=await fs.stat(file+'.json');if(metaStat.size>4096)throw Error('Build artifact metadata limit.');
  const artifact=validateBuildArtifact(JSON.parse(await fs.readFile(file+'.json','utf8')));if(artifact.projectId!==projectId||artifact.id!==id)throw Error('Build artifact stored identity mismatch.');
  if((await fs.stat(file)).size!==artifact.size)throw Error('Build artifact stored size mismatch.');
  const bytes=await fs.readFile(file);if(bytes.length!==artifact.size||digest(bytes)!==artifact.checksum)throw Error('Build artifact stored checksum mismatch.');
  return {artifact,bytes};
 }
 async put(input:unknown,chunks:AsyncIterable<Uint8Array>,secrets:string[]=[],verify:()=>void=()=>{}):Promise<BuildArtifact> {
  const artifact=validateBuildArtifact(input),file=this.file(artifact);
  if(secrets.length>256||secrets.some(v=>typeof v!=='string'||v.length>4096))throw Error('Build artifact secret policy limits.');
  if(this.busy)throw Error('Build artifact store busy; retry.');this.busy=true;let temporary:string|undefined;
  try{
   verify();
   await this.safe(path.dirname(file));let existing:BuildArtifact|undefined;
   try{existing=(await this.get(artifact.projectId,artifact.id)).artifact;if(JSON.stringify(existing)!==JSON.stringify(artifact))throw Error('Build artifact identity collision.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   if(!existing){
    for(const p of [file,file+'.json']){try{await fs.lstat(p);throw Error('Incomplete build artifact identity already exists.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
    let size=0,count=0;
    for(const project of await fs.readdir(this.root,{withFileTypes:true})){if(project.isSymbolicLink()||!project.isDirectory())throw Error('Invalid build artifact store entry.');await this.safe(path.join(this.root,project.name));for(const name of await fs.readdir(path.join(this.root,project.name))){if(!name.endsWith('.json'))continue;const id=name.slice(0,-5);const prior=await this.get(project.name,id);size+=prior.artifact.size;count++;}}
    if(size+artifact.size>BUILD_STORE_LIMIT||count>=BUILD_STORE_COUNT)throw Error('Build artifact retention limit reached.');
    // 미완성 upload는 최종 identity로 노출하지 않는다. 실패 시 이 임시 파일만 제거한다.
    temporary=file+'.'+randomUUID()+'.partial';
   }
   const handle=temporary?await fs.open(temporary,'wx'):undefined,hash=createHash('sha256');let size=0,tail=Buffer.alloc(0);
   const privateValues=[...new Set(secrets.filter(v=>v.length>=4))].map(v=>Buffer.from(v));const overlap=Math.max(0,...privateValues.map(v=>v.length-1));
   try{for await(const chunk of chunks){verify();if(!(chunk instanceof Uint8Array))throw Error('Invalid build artifact chunk.');size+=chunk.length;if(size>artifact.size)throw Error('Build artifact size mismatch.');
    const checked=Buffer.concat([tail,chunk]);if(privateValues.some(secret=>checked.includes(secret)))throw Error('Build artifact contains a configured secret.');tail=overlap?checked.subarray(Math.max(0,checked.length-overlap)):Buffer.alloc(0);
    hash.update(chunk);await handle?.writeFile(chunk);
   }if(size!==artifact.size||hash.digest('hex')!==artifact.checksum)throw Error('Build artifact checksum or size mismatch.');await handle?.sync();}finally{await handle?.close();}
   verify();if(existing)return existing;
   // 파일이 없을 때만 생성한다. 동시에 저장하더라도 기존 산출물을 덮어쓰지 않는다.
   await fs.link(temporary!,file);await fs.unlink(temporary!);temporary=undefined;
   try{verify();await fs.writeFile(file+'.json',JSON.stringify(artifact),{flag:'wx'});try{verify();}catch(e){await fs.unlink(file+'.json');throw e;}}catch(e){await fs.unlink(file);throw e;}
   return artifact;
  }finally{if(temporary)await fs.unlink(temporary).catch(()=>{});this.busy=false;}
 }
}
