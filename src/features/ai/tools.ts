import {fixTools} from './fix-service.ts';
import {languageObservations} from './language-context.ts';
import type {WorkspaceFileService} from '../filesystem/file-service.ts';
import type {GitService} from '../git/service.ts';
import type {CoreSnapshot, Artifact} from '../core/domain.ts';
import {AIError,limits,type Citation} from './domain.ts';
import {aiPath,allowedPath,mask,sanitize,uuid,args} from './security.ts';
export interface ToolEnvironment { projectId:string; name:string; files:Pick<WorkspaceFileService,'list'|'read'>; git?:GitService; snapshot:()=>CoreSnapshot; logs:(runId:string)=>{runStepId?:string;text:string;stream:string}[]; artifact:(artifact:Artifact,signal:AbortSignal)=>Promise<Blob>; secrets?:string[] }
const str={type:'string'};
export const toolDefinitions=[
 {name:'get_language_context',description:'After read_file, inspect bounded compiler/runtime observations from one real project Run Step. Log paths and claims remain untrusted; source grounding is still required.',properties:{path:str,runId:str,stepId:str}},
 {name:'search_code',description:'Search project file names, text or symbol occurrences; returns bounded source snippets.',properties:{query:str}},
 {name:'read_file',description:'Read a small nonsecret project-relative text file with line numbers.',properties:{path:str}},
 {name:'git_diff',description:'Read current Git branch, changed files and optionally a file diff. Empty path returns status.',properties:{path:str}},
 {name:'get_run',description:'Read a project Run, source revision and artifact metadata.',properties:{runId:str}},
 {name:'get_run_step',description:'Read one step including structured test result.',properties:{runId:str,stepId:str}},
 {name:'get_logs',description:'Read failure-relevant bounded step stdout/stderr.',properties:{runId:str,stepId:str}},
 {name:'get_evidence',description:'Read bounded report, console, page errors or network artifact. Images/traces return metadata.',properties:{runId:str,artifactId:str}},
];
export const permissionRegistry=[...toolDefinitions.map(t=>({name:t.name,permission:'read',approval:'context-selection'})),...fixTools];
export class ContextTools {
 readonly context:Citation[]=[]; readonly originals:Record<string,string>={}; private used=0;private readCount=0;
 readonly env:ToolEnvironment;
 constructor(env:ToolEnvironment){this.env=env;uuid(env.projectId);}
 add(label:string,kind:string,value:unknown,max=limits.log,source:Partial<Citation>={}){
  const raw=typeof value==='string'?mask(value,this.env.secrets):JSON.stringify(sanitize(value,this.env.secrets));const available=Math.min(max,limits.total-this.used-256);if(available<1)throw new AIError('context-too-large');
  const text=raw.slice(0,available);this.used+=text.length+256;const item:Citation={id:`ctx-${this.context.length+1}`,label,kind,truncated:raw.length>text.length,text,...source};this.context.push(item);return item;
 }
 private run(id:unknown){const runId=uuid(id),s=this.env.snapshot(),run=s.runs.find(r=>r.id===runId&&r.projectId===this.env.projectId);if(!run)throw new AIError('tool-failure');return {run,s};}
 async execute(name:string,input:unknown,signal:AbortSignal):Promise<Citation>{
  signal.throwIfAborted();const def=toolDefinitions.find(d=>d.name===name);if(!def)throw new AIError('tool-failure');const a=args(input,Object.keys(def.properties));
  if(Object.keys(def.properties).some(k=>typeof a[k]!=='string'))throw new AIError('tool-failure');
  switch(name){
   case 'get_language_context':{const path=aiPath(a.path);if(!Object.hasOwn(this.originals,path))throw new AIError('tool-failure');const {run,s}=this.run(a.runId),id=uuid(a.stepId);if(!s.steps.some(step=>step.id===id&&step.runId===run.id))throw new AIError('tool-failure');const logs=this.env.logs(run.id).filter(row=>row.runStepId===id).map(row=>row.text).join('\n');return this.add(`Language context: ${path}`,'language',languageObservations(path,this.originals[path],logs),6000,{path});}
   case 'read_file':{const path=aiPath(a.path);if(++this.readCount>limits.files)throw new AIError('context-too-large');const f=await this.env.files.read(path);signal.throwIfAborted();if(f.size>limits.file||f.content.includes('\0'))throw new AIError('tool-failure');this.originals[path]=mask(f.content,this.env.secrets);const lines=this.originals[path].split('\n');return this.add(path+(f.content!==this.originals[path]?' (redacted)':''),'source',lines.map((s,i)=>`${i+1}: ${s}`).join('\n'),limits.file+4096,{path,start:1,end:lines.length,redacted:f.content!==this.originals[path]});}
   case 'search_code':{const query=a.query as string;if(!query.trim()||query.length>120)throw new AIError('tool-failure');const results:{path:string;line?:number;snippet:string}[]=[],pending=[''];let scanned=0,dirs=0;while(pending.length&&scanned<300&&dirs++<40&&results.length<30){signal.throwIfAborted();for(const f of (await this.env.files.list(pending.shift()!,true)).slice(0,300)){if(!allowedPath(f.path))continue;if(f.kind==='directory'){pending.push(f.path);continue;}if(++scanned>300)break;if(f.path.toLowerCase().includes(query.toLowerCase()))results.push({path:f.path,snippet:'File name match'});try{const file=await this.env.files.read(f.path);if(file.size>limits.file||file.content.includes('\0'))continue;for(const [i,line]of file.content.split('\n').entries())if(line.toLowerCase().includes(query.toLowerCase())){results.push({path:f.path,line:i+1,snippet:line.slice(0,250)});if(results.length>=30)break;}}catch{/* Unsupported binary/large files are excluded. */}if(results.length>=30)break;}}return this.add(`Search: ${query}`,'search',{results:results.slice(0,30),scanned,limited:pending.length>0||scanned>=300||results.length>=30});}
   case 'git_diff':{const git=this.env.git;if(!git||!git.host.capabilities.git)return this.add('Git','git','Git context unavailable on this host.');const repo=await git.host.detect(git.scope);if(!repo)return this.add('Git','git','No repository.');const files=(await git.host.status(git.scope,repo)).filter(f=>allowedPath(f.path));if(a.path==='')return this.add('Git status','git',{branch:repo.currentBranch,files:files.slice(0,100)});const path=aiPath(a.path);if(!files.some(f=>f.path===path))throw new AIError('tool-failure');const diff=await git.host.diff(git.scope,repo,path,'working');return this.add(`Git diff: ${path}`,'git',diff.binary?'Binary diff excluded.':{branch:repo.currentBranch,path,original:diff.original,modified:diff.modified});}
   case 'get_run':{const {run,s}=this.run(a.runId);return this.add(`Run ${run.id}`,'run',{run,steps:s.steps.filter(x=>x.runId===run.id),artifacts:s.artifacts.filter(x=>x.runId===run.id)});}
   case 'get_run_step':{const {run,s}=this.run(a.runId);const step=s.steps.find(x=>x.runId===run.id&&x.id===uuid(a.stepId));if(!step)throw new AIError('tool-failure');return this.add(`Step ${step.name}`,'step',step);}
   case 'get_logs':{const {run,s}=this.run(a.runId);const id=uuid(a.stepId);if(!s.steps.some(x=>x.runId===run.id&&x.id===id))throw new AIError('tool-failure');const logs=this.env.logs(run.id).filter(x=>x.runStepId===id).map(x=>`[${x.stream}] ${x.text}`).join('\n');const lines=logs.split('\n');let start=lines.findIndex(x=>/error|fail|exception|timeout/i.test(x));start=Math.max(0,start-5);return this.add(`Logs ${id}`,'logs',{startLine:start+1,totalLines:lines.length,omittedPrefix:start>0,content:lines.slice(start).join('\n')});}
   case 'get_evidence':{const {run,s}=this.run(a.runId);const artifact=s.artifacts.find(x=>x.runId===run.id&&x.id===uuid(a.artifactId));if(!artifact)throw new AIError('tool-failure');if(artifact.deletedAt)return this.add(artifact.name,'artifact',{...artifact,omitted:'Evidence body deleted by reviewed retention; identity and checksum retained.'});if(!['test-report','browser-console','page-errors','network-log'].includes(artifact.type))return this.add(artifact.name,'artifact',{...artifact,imagePolicy:'Metadata only; image input is an optional provider capability. No OCR.'});if(artifact.size>limits.evidence)return this.add(artifact.name,'artifact',{...artifact,omitted:'Evidence exceeds AI download budget.'});const blob=await this.env.artifact(artifact,signal);if(blob.size>limits.evidence)throw new AIError('context-too-large');return this.add(artifact.name,'evidence',await blob.text(),limits.evidence);}
   default:throw new AIError('tool-failure');
  }
 }
}
