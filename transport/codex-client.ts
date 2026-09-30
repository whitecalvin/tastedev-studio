import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AIError} from '../src/features/ai/domain.ts';

type Packet={id?:number|string;method?:string;params?:Record<string,unknown>;result?:unknown;error?:unknown};
export type Launch=()=>ChildProcessWithoutNullStreams;
export const codexHome=()=>path.resolve(process.env.TASTEDEV_CODEX_HOME??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../../resources/runtime/tastedev-studio/codex'));
export function codexLaunch():ChildProcessWithoutNullStreams {
 const configured=process.env.TASTEDEV_CODEX_EXECUTABLE;
 const installed=path.join(process.env.APPDATA??'',`npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-${process.arch}/vendor/${process.arch==='arm64'?'aarch64':'x86_64'}-pc-windows-msvc/bin/codex.exe`);
 const executable=configured??(process.platform==='win32'&&existsSync(installed)?installed:'codex');
 // An isolated home prevents loading unrelated MCP servers, hooks, plugins and project rules.
 // Never pass an API key or a parent process credential to this ChatGPT-only adapter.
 const env:NodeJS.ProcessEnv={CODEX_HOME:codexHome(),NODE_ENV:'production'};
 for(const name of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','HOME','USERPROFILE','LOCALAPPDATA','APPDATA'])if(process.env[name])env[name]=process.env[name];
 const args=['app-server','--stdio','-c','forced_login_method="chatgpt"','-c','model_provider="openai"','-c','web_search="disabled"','-c','project_doc_max_bytes=0','-c','history.persistence="none"'];
 for(const feature of ['shell_tool','unified_exec','apps','plugins','hooks','multi_agent','computer_use','browser_use','in_app_browser'])args.push('--disable',feature);
 return spawn(executable,args,{cwd:codexHome(),env,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
}

/** One bounded stdio session. Raw server errors and credentials never leave this boundary. */
export class CodexClient {
 private child:ChildProcessWithoutNullStreams;
 private sequence=0;private buffer='';private received=0;private closed=false;
 private pending=new Map<number,{resolve:(value:unknown)=>void;reject:(error:AIError)=>void}>();
 private listeners=new Set<(packet:Packet)=>void>();
 private abort:()=>void;private signal:AbortSignal;
 private constructor(signal:AbortSignal,launch:Launch){
  this.signal=signal;this.child=launch();this.abort=()=>this.close(signal.reason instanceof AIError?signal.reason:new AIError('cancelled'));
  signal.addEventListener('abort',this.abort,{once:true});
  this.child.stderr.on('data',()=>{}); // Do not forward raw auth/server diagnostics.
  this.child.on('error',()=>this.close(new AIError('unavailable')));
  this.child.on('exit',()=>this.close(new AIError('unavailable')));
  this.child.stdin.on('error',()=>this.close(new AIError('unavailable')));
  this.child.stdout.setEncoding('utf8');
  this.child.stdout.on('data',(chunk:string)=>{
   if(this.closed)return;this.received+=Buffer.byteLength(chunk);this.buffer+=chunk;
   if(this.received>2*1024*1024||this.buffer.length>1024*1024){this.close(new AIError('malformed'));return;}
   let i:number;while((i=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,i);this.buffer=this.buffer.slice(i+1);if(!line.trim())continue;
    try{const p=JSON.parse(line) as Packet;
     if(p.method&&p.id!==undefined){this.write({id:p.id,error:{code:-32601,message:'Tool and approval requests are disabled in this client.'}});this.close(new AIError('tool-failure'));return;}
     if(typeof p.id==='number'){const waiter=this.pending.get(p.id);if(waiter){this.pending.delete(p.id);if(p.error)waiter.reject(new AIError('unavailable'));else waiter.resolve(p.result);}}
     else if(p.method)for(const listener of this.listeners)listener(p);
    }catch{this.close(new AIError('malformed'));return;}
   }
  });
 }
 static async connect(signal:AbortSignal,launch?:Launch){
  signal.throwIfAborted();if(!launch)await mkdir(codexHome(),{recursive:true});
  const client=new CodexClient(signal,launch??codexLaunch);
  try{await client.call('initialize',{clientInfo:{name:'tastedev_studio',title:'TASTEDEV Studio',version:'0.1.0'},capabilities:{experimentalApi:true}});client.write({method:'initialized'});return client;}catch(error){client.close();throw error;}
 }
 private write(packet:unknown){if(!this.closed)this.child.stdin.write(JSON.stringify(packet)+'\n');}
 call<T=unknown>(method:string,params:unknown):Promise<T>{
  if(this.closed||this.signal.aborted)return Promise.reject(new AIError('unavailable'));
  const id=++this.sequence;return new Promise<T>((resolve,reject)=>{this.pending.set(id,{resolve:value=>resolve(value as T),reject});this.write({id,method,params});});
 }
 onNotification(listener:(packet:Packet)=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 close(error=new AIError('cancelled')){if(this.closed)return;this.closed=true;this.signal.removeEventListener('abort',this.abort);for(const p of this.pending.values())p.reject(error);this.pending.clear();for(const l of this.listeners)l({method:'client/closed',params:{code:error.code}});this.listeners.clear();this.child.stdin.end();this.child.kill();}
}
