export const frameworkRepository='https://github.com/Donchitos/Claude-Code-Game-Studios.git';
export const frameworkCommit='05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418';
export const frameworkManifest='b1f58c40e2d5d01f1871af574849853f908301afc57242da0251881b6988a12f';
export const engines=['godot','unity','unreal'] as const;
export type GameEngine=typeof engines[number];
export interface TemplateBinding {framework:'claude-code-game-studios';repository:typeof frameworkRepository;commit:string;manifest:string;engine:GameEngine}
export interface InstructionRef {commit:string;path:string;sha256:string}
export interface FrameworkEntry {id:string;kind:'role'|'skill'|'rule'|'hook'|'workflow';path:string;sha256:string;frontmatter:Record<string,unknown>;raw:string}
export interface FrameworkCatalog {version:number;repository:string;commit:string;identity:string;entries:FrameworkEntry[];projectYaml:string;claudeMd:string;license:string}
export type ExecutionMode='claude-code'|'studio';
export type SupportState='native-ready'|'studio-ready'|'configuration-required'|'unsupported';
export function validateBinding(value:unknown):TemplateBinding {
 const b=value as TemplateBinding;
 if(!b||b.framework!=='claude-code-game-studios'||b.repository!==frameworkRepository||b.commit!==frameworkCommit||b.manifest!==frameworkManifest||!engines.includes(b.engine))throw Error('Invalid framework template identity.');
 return {framework:b.framework,repository:b.repository,commit:b.commit,manifest:b.manifest,engine:b.engine};
}
export function instructionRef(entry:FrameworkEntry,commit=frameworkCommit):InstructionRef{return{commit,path:entry.path,sha256:entry.sha256};}
export function validInstructionRef(value:unknown):value is InstructionRef {
 const r=value as InstructionRef;return !!r&&r.commit===frameworkCommit&&/^\.claude\/(agents|skills)\/[A-Za-z0-9_./-]+\.md$/.test(r.path)&&!r.path.split('/').includes('..')&&/^[a-f0-9]{64}$/.test(r.sha256);
}
export function support(entry:FrameworkEntry,mode:ExecutionMode,ready=false):{state:SupportState;reason:string}{
 if(!['role','skill'].includes(entry.kind))return{state:'unsupported',reason:'Reference definition only'};
 if(mode==='studio')return entry.kind==='role'?{state:'studio-ready',reason:'Read-only role context; original hooks and skill execution are not ported'}:{state:'unsupported',reason:'Original skill requires Claude Code'};
 const qualified=['role:godot-specialist','skill:start','skill:dev-story'].includes(entry.id);return{state:ready&&qualified?'native-ready':'configuration-required',reason:ready&&qualified?'Native execution verified with the guarded Godot Protocol; unrestricted original Shell stays blocked':ready?'Definition retained; individual native skill qualification is pending':'Claude Code authentication, runtime paths, approved isolation and engine verification required'};
}
