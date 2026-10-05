/** Build outputs are executable/test inputs, separate from browser Evidence. */
export const BUILD_ARTIFACT_LIMIT=128*1024*1024;
export interface BuildArtifactDeclaration {outputs:{name:string;path:string;executable?:boolean}[];inputs:{fromTask:string;name:string;path:string;executable?:boolean}[]}
export function validateBuildArtifactDeclaration(value:unknown):BuildArtifactDeclaration {
 const d=value as BuildArtifactDeclaration;
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>!['inputs','outputs'].includes(k)))throw Error('Invalid artifact declaration.');
 const outputs=d.outputs??[],inputs=d.inputs??[];
 if(!Array.isArray(outputs)||!Array.isArray(inputs)||outputs.length>16||inputs.length>16||!outputs.length&&!inputs.length)throw Error('Declare 1–16 artifact outputs or inputs.');
 const named=(name:unknown)=>{if(typeof name!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name))throw Error('Invalid artifact declaration name.');return name;};
 const result:BuildArtifactDeclaration={outputs:outputs.map(o=>{if(!o||typeof o!=='object'||Object.keys(o).some(k=>!['name','path','executable'].includes(k)))throw Error('Invalid artifact output.');return{name:named(o.name),path:buildArtifactPath(o.path),...(o.executable!==undefined?{executable:o.executable}:{})};}),inputs:inputs.map(i=>{if(!i||typeof i!=='object'||Object.keys(i).some(k=>!['fromTask','name','path','executable'].includes(k)))throw Error('Invalid artifact input.');return{fromTask:named(i.fromTask),name:named(i.name),path:buildArtifactPath(i.path),...(i.executable!==undefined?{executable:i.executable}:{})};})};
 const entries=[...result.outputs,...result.inputs];if(entries.some(v=>v.executable!==undefined)&&entries.some(v=>typeof v.executable!=='boolean'))throw Error('Declare an executable boolean for every v2 artifact.');
 const paths=[...result.outputs,...result.inputs].map(v=>v.path.toLowerCase()),names=result.outputs.map(v=>v.name),sources=result.inputs.map(v=>v.fromTask+'/'+v.name);
 if(new Set(paths).size!==paths.length||new Set(names).size!==names.length||new Set(sources).size!==sources.length)throw Error('Duplicate artifact name, source or target path.');
 return result;
}
export interface BuildArtifact {
 version:1|2;executable?:boolean;id:string;projectId:string;executionId:string;graphRevision:number;
 producerActivationId:string;producerNodeId:string;producerRunId:string;producerStepId:string;
 snapshotId:string;sourceChecksum:string;name:string;path:string;size:number;checksum:string;
}
export interface ArtifactConsumption {projectId:string;executionId:string;graphRevision:number;snapshotId:string;sourceChecksum:string;producerActivationId:string;producerNodeId:string;name:string;path:string}
export type BuildArtifactOrigin=Pick<BuildArtifact,'projectId'|'executionId'|'graphRevision'|'producerActivationId'|'producerNodeId'|'producerRunId'|'producerStepId'|'snapshotId'|'sourceChecksum'>;
function identity(v:unknown):v is string{return typeof v==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(v);}
export function buildArtifactPath(value:unknown):string {
 if(typeof value!=='string'||value.length>240||!value||value.includes('\\')||value.startsWith('/')||value.split('/').some(p=>!p||p==='.'||p==='..'||/[\x00-\x20<>:"|?*]/.test(p)||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw Error('Invalid build artifact relative path.');
 // File selection is explicit; private configuration is never an output contract.
 if(value.split('/').some(p=>/^\.env(?:\.|$)|^\.git$|^\.ssh$|^\.aws$|credential|^id_(?:rsa|ed25519)(?:\.|$)|\.(?:pem|key|p12|pfx)$/i.test(p)))throw Error('Credential files are not build artifacts.');
 return value;
}
export function validateBuildArtifact(value:unknown):BuildArtifact {
 const a=value as BuildArtifact;
 if(!a||![1,2].includes(a.version)||(a.version===1?a.executable!==undefined:typeof a.executable!=='boolean')||!['id','projectId','executionId','producerActivationId','producerNodeId','producerRunId','producerStepId','snapshotId'].every(k=>identity(a[k as keyof BuildArtifact]))||!Number.isSafeInteger(a.graphRevision)||a.graphRevision<1||!identity(a.name)||!Number.isSafeInteger(a.size)||a.size<1||a.size>BUILD_ARTIFACT_LIMIT||!['checksum','sourceChecksum'].every(k=>typeof a[k as 'checksum']==='string'&&/^[a-f0-9]{64}$/.test(a[k as 'checksum'])))throw Error('Invalid build artifact identity or limits.');
 return {version:a.version,...(a.version===2?{executable:a.executable}:{}),id:a.id,projectId:a.projectId,executionId:a.executionId,graphRevision:a.graphRevision,producerActivationId:a.producerActivationId,producerNodeId:a.producerNodeId,producerRunId:a.producerRunId,producerStepId:a.producerStepId,snapshotId:a.snapshotId,sourceChecksum:a.sourceChecksum,name:a.name,path:buildArtifactPath(a.path),size:a.size,checksum:a.checksum};
}
export function consumeBuildArtifact(value:unknown,scope:ArtifactConsumption):{artifact:BuildArtifact;path:string} {
 const artifact=validateBuildArtifact(value);
 for(const key of ['projectId','executionId','graphRevision','snapshotId','sourceChecksum','producerActivationId','producerNodeId','name'] as const)if(artifact[key]!==scope[key])throw Error('Build artifact consumption scope mismatch.');
 return {artifact,path:buildArtifactPath(scope.path)};
}

export function artifactProtocolVersion(d:BuildArtifactDeclaration):1|2{return [...d.outputs,...d.inputs].some(v=>v.executable!==undefined)?2:1;}
