import runtimeBundle from '../resources/integrations/ccgs/05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418/runtime-bundle.json' with {type:'json'};
import {mkdir,writeFile,realpath,lstat} from 'node:fs/promises';
import path from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {verifyProjectSnapshot,snapshotBytes,type ProjectSnapshot} from '../src/features/ai/project-snapshot.ts';
import {bundleManifest,catalog} from '../src/features/frameworks/catalog.ts';
const hash=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
/** Only saved snapshot bytes enter the new isolation. Source HEAD is never substituted. */
export async function prepareFrameworkIsolation(snapshot:ProjectSnapshot,parent:string,dirtyEditors:readonly string[],engine:'godot'|'unity'|'unreal'){
 if(dirtyEditors.length)throw Error('Save or cancel dirty editors before creating framework isolation.');
 if(!['godot','unity','unreal'].includes(engine))throw Error('Invalid game engine.');
 await verifyProjectSnapshot(snapshot);
 const root=await realpath(parent);if(!(await lstat(root)).isDirectory())throw Error('Invalid isolation parent.');
 const workspaceId=randomUUID(),cwd=path.join(root,workspaceId),files=new Map<string,Uint8Array>();
 for(const f of snapshot.files){if(f.path==='.tastedev/framework-isolation.json')throw Error('Reserved isolation marker.');files.set(f.path,snapshotBytes(f));}
 const bundleFiles=bundleManifest.files.filter(f=>f.path.startsWith('.claude/')||['CLAUDE.md','project.yaml'].includes(f.path));
 for(const file of bundleFiles){const raw=runtimeBundle.files.find(f=>f.path===file.path);if(!raw||runtimeBundle.identity!==catalog.identity)throw Error('Pinned runtime bundle missing.');const content=Buffer.from(raw.content,'base64');if(hash(content)!==file.sha256)throw Error('Trusted framework bundle integrity mismatch.');const old=files.get(file.path);if(old&&hash(old)!==file.sha256)throw Error('UPDATE_CONFLICT: '+file.path);files.set(file.path,content);}
 if(files.has('.claude/settings.local.json')||files.has('.mcp.json'))throw Error('Review local execution configuration before isolation.');
 const configurationChecksum=hash(JSON.stringify({engine,manifest:catalog.identity,source:snapshot.checksum}));
 await mkdir(cwd,{recursive:false});
 // An interrupted preparation is retained for diagnosis, never advertised as runnable without its final marker.
 for(const [name,content]of files){const target=path.join(cwd,name);if(path.relative(cwd,target).startsWith('..')||path.isAbsolute(name))throw Error('Isolation path escape.');await mkdir(path.dirname(target),{recursive:true});await writeFile(target,content,{flag:'wx'});}
 const marker={version:1,projectId:snapshot.projectId,workspaceId,sourceChecksum:snapshot.checksum,manifest:catalog.identity,configurationChecksum,engine,baseRevision:snapshot.baseRevision,createdAt:new Date().toISOString(),files:snapshot.files.map(f=>({path:f.path,checksum:f.checksum}))};
 await mkdir(path.join(cwd,'.tastedev'),{recursive:true});await writeFile(path.join(cwd,'.tastedev/framework-isolation.json'),JSON.stringify(marker,null,2)+'\n',{flag:'wx'});
 return{cwd,workspaceId,sourceChecksum:snapshot.checksum,configurationChecksum,manifest:catalog.identity};
}
