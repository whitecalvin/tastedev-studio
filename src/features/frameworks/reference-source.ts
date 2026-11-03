import data from '../../../resources/integrations/ccgs/05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418/reference-source.json' with {type:'json'};
import {bytesHash} from '../ai/snapshot-bytes.ts';
import type {WorkspaceFileService} from '../filesystem/file-service.ts';
import type {FileEntry} from '../filesystem/contracts.ts';
export const referenceSourceIdentity='d3228cdfb07019a9dc638612ffdb61f1c1c0f377351d2066f19ceb26251e575a';
type ReferenceSource=typeof data;
export async function verifiedReferenceFiles(value:ReferenceSource=data){
 if(value.version!==1||value.commit!=='05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418'||value.identity!==referenceSourceIdentity||value.license!=='MIT'||value.files.length!==46||new Set(value.files.map(f=>f.path)).size!==46)throw Error('Framework reference identity mismatch.');
 const records=value.files.map(({path,sha256,bytes})=>({path,sha256,bytes}));
 if(await bytesHash(new TextEncoder().encode(JSON.stringify(records)))!==referenceSourceIdentity)throw Error('Framework reference manifest changed.');
 return Promise.all(value.files.map(async file=>{if(!/^docs\/engine-reference\/(?:README\.md|(?:godot|unity|unreal)\/[A-Za-z0-9_./-]+\.md)$/.test(file.path)||file.path.split('/').includes('..'))throw Error('Unsafe framework reference path.');const bytes=Uint8Array.from(atob(file.content),c=>c.charCodeAt(0));if(bytes.length!==file.bytes||await bytesHash(bytes)!==file.sha256)throw Error('Framework reference checksum mismatch.');return{path:file.path,bytes,content:new TextDecoder('utf-8',{fatal:true}).decode(bytes),sha256:file.sha256};}));
}
/** Missing public references enter the reviewed snapshot, not the user's disk.
 * Existing project copies retain their exact bytes, including deliberate edits. */
export async function withReferenceSource(files:Pick<WorkspaceFileService,'list'|'read'|'readBytes'>){
 const raw=await verifiedReferenceFiles(),transformations:{path:string;sourceChecksum:string;snapshotChecksum:string;reason:string}[]=[];
 const references=await Promise.all(raw.map(async file=>{
  const content=file.content.replace(/https?:\/\/[^\s"'<>`\\]+/g,original=>{try{const url=new URL(original);if(url.username||url.password||[...url.searchParams.keys()].some(k=>/authorization|password|token|secret|api[_-]?key|credential|signature|^sig$/i.test(k)))return original;if(!url.search&&!url.hash)return original;url.search='';url.hash='';return url.href;}catch{return original;}});
  if(content===file.content)return file;
  const inspected='> TASTESTUDIO snapshot reference copy. Original: https://github.com/Donchitos/Claude-Code-Game-Studios/blob/'+data.commit+'/'+file.path+'\n> Original SHA-256: '+file.sha256+'. Public URL query/fragment components are omitted in this snapshot copy to retain the unchanged Source secret policy. The exact upstream bytes remain in the pinned reference-source package.\n\n'+content;
  const bytes=new TextEncoder().encode(inspected),sha256=await bytesHash(bytes);transformations.push({path:file.path,sourceChecksum:file.sha256,snapshotChecksum:sha256,reason:'Derived public reference inspection copy; ordinary snapshot secret checks remain enabled.'});return{...file,bytes,content:inspected,sha256};
 }));
 const virtualDirectories=new Set<string>(),virtualFiles=new Map<string,(typeof references)[number]>();
 const source={
  list:async(dir='',hidden=true)=>{
   const entries:FileEntry[]=virtualDirectories.has(dir)?[]:[...await files.list(dir,hidden)];
   for(const reference of references){if(dir&&!reference.path.startsWith(dir+'/'))continue;const tail=dir?reference.path.slice(dir.length+1):reference.path,part=tail.split('/')[0],name=dir?dir+'/'+part:part,kind=tail.includes('/')?'directory':'file';const existing=entries.find(e=>e.path===name);if(existing){if(existing.kind!==kind)throw Error('Framework reference conflicts with project path: '+name);continue;}entries.push({path:name,name:part,kind});if(kind==='directory')virtualDirectories.add(name);else virtualFiles.set(name,reference);}
   return entries;
  },
  read:async(name:string)=>{const file=virtualFiles.get(name);return file?{content:file.content,size:file.bytes.length,modified:0}:files.read(name);},
  readBytes:async(name:string)=>virtualFiles.get(name)?.bytes??files.readBytes(name),
 };
 return{source,provenance:()=>({commit:data.commit,manifest:referenceSourceIdentity,added:[...virtualFiles.keys()],transformations:transformations.filter(f=>virtualFiles.has(f.path)),policy:'Missing pinned public reference data is added to the snapshot only. Existing project files are preserved; normal secret exclusions still apply. Exact upstream bytes and inspection-copy checksums are distinct.'})};
}
