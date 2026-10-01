import type {GitSource,SnapshotSource} from '../src/features/core/test-plan.ts';
export function sourceInventory(input:unknown){
 if(input===undefined)return undefined;
 if(!Array.isArray(input)||input.length>256||input.some(value=>typeof value!=='string'||!/^[a-f0-9-]{36}:[a-f0-9]{64}$/.test(value))||new Set(input).size!==input.length)throw Error('Invalid source cache inventory.');
 return new Set<string>(input);
}
/** An Agent cache claim can only omit bytes of an already validated, same-project snapshot. */
export function transferSource(source:SnapshotSource,projectId:string,inventory?:Set<string>):SnapshotSource;
export function transferSource(source:GitSource,projectId:string,inventory?:Set<string>):GitSource;
export function transferSource(source:GitSource|SnapshotSource,projectId:string,inventory?:Set<string>):GitSource|SnapshotSource;
export function transferSource(source:GitSource|SnapshotSource,projectId:string,inventory?:Set<string>){
 if(source.provider!=='snapshot')return source;
 if(source.snapshot.projectId!==projectId)throw Error('Snapshot transfer project mismatch.');
 return {...source,snapshot:{...source.snapshot,files:source.snapshot.files.map(file=>inventory?.has(projectId+':'+file.checksum)?{path:file.path,checksum:file.checksum,content:'',cached:true}:{path:file.path,checksum:file.checksum,content:file.content})}};
}
