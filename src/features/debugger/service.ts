export type DebugAction='continue'|'pause'|'step-over'|'step-into'|'step-out'|'set-breakpoint'|'remove-breakpoint'|'variables';
export interface Frame {path:string;line:number;column:number;functionName:string;scopes:{type:string;objectId:string}[]}
export interface DebugEvent {sessionId:string;workspaceId:string;sequence:number;type:string;data:Record<string,unknown>}
export interface Breakpoint {path:string;line:number;breakpointId:string;verified?:boolean}
export interface DebugHost {supported:boolean;listen(fn:(event:DebugEvent)=>void):Promise<()=>void>;invoke(command:string,args:Record<string,unknown>):Promise<void>}
export interface DebugState {sessionId:string|null;workspaceId:string|null;status:'idle'|'starting'|'ready'|'running'|'paused'|'exited'|'stopped'|'failed';frames:Frame[];breakpoints:Breakpoint[];values:{name:string;value:unknown}[];output:string;error:string;exitCode:number|null}
const initial=():DebugState=>({sessionId:null,workspaceId:null,status:'idle',frames:[],breakpoints:[],values:[],output:'',error:'',exitCode:null});
export class DebugService {
 private state=initial();private listeners=new Set<()=>void>();private off:(()=>void)|undefined;private epoch=0;private sequence=0;
 readonly host:DebugHost;constructor(host:DebugHost){this.host=host;}
 snapshot=()=>this.state;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private update(patch:Partial<DebugState>){this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 active=()=>['starting','ready','running','paused'].includes(this.state.status);
 async start(workspaceId:string,path:string,content:string,dirty:boolean,options:{runtime?:'node'|'python';pythonPath?:string}={}){
  if(!this.host.supported)throw new Error('Debugging requires the desktop application.');if(this.active())throw new Error('Stop the current debug session first.');if(dirty)throw new Error('Save all edited files before debugging.');
  if(!(options.runtime==='python'?/\.py$/i:/\.(?:[cm]?[jt]s)$/i).test(path)||path.split(/[\\/]/).some(p=>p==='..'||p==='')||/^[\\/]|:/.test(path))throw new Error('Choose a Node or TypeScript file inside this project.');
  const epoch=++this.epoch,sessionId=crypto.randomUUID();this.off?.();this.off=undefined;this.sequence=0;this.state=initial();this.update({workspaceId,sessionId,status:'starting'});
  try{const off=await this.host.listen(event=>{if(epoch===this.epoch)this.receive(event);});if(epoch!==this.epoch){off();return;}this.off=off;
   const bytes=new TextEncoder().encode(content),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   if(epoch!==this.epoch)return;
   await this.host.invoke('debug_start',{request:{sessionId,workspaceId,path,expectedHash:hash,args:[],runtime:options.runtime??'node',pythonPath:options.runtime==='python'?options.pythonPath:null}});
  }catch(error){if(epoch===this.epoch){this.update({status:'failed',error:error instanceof Error?error.message:'Debug session could not start.'});this.off?.();this.off=undefined;}throw error;}
 }
 receive(event:DebugEvent){if(event.sessionId!==this.state.sessionId||event.workspaceId!==this.state.workspaceId||!Number.isSafeInteger(event.sequence)||event.sequence<=this.sequence)return;this.sequence=event.sequence;const data=event.data;
  if(event.type==='paused'){this.update({status:'paused',frames:(Array.isArray(data.frames)?data.frames:[]) as Frame[],values:[]});}
  else if(event.type==='resumed')this.update({status:'running',frames:[],values:[]});
  else if(['ready','exited','stopped','failed'].includes(event.type)){this.update({status:event.type as DebugState['status'],frames:[],values:[],exitCode:typeof data.exitCode==='number'?data.exitCode:null,error:typeof data.reason==='string'?data.reason:''});if(!this.active()){this.off?.();this.off=undefined;}}
  else if(event.type==='output')this.update({output:(this.state.output+String(data.text??'')).slice(-32768)});
  else if(event.type==='operation-error')this.update({error:String(data.reason??'Debug action failed.')});
  else if(event.type==='breakpoint')this.update({breakpoints:[...this.state.breakpoints.filter(b=>b.breakpointId!==data.breakpointId),data as unknown as Breakpoint]});
  else if(event.type==='breakpoint-removed')this.update({breakpoints:this.state.breakpoints.filter(b=>b.breakpointId!==data.breakpointId)});
  else if(event.type==='variables')this.update({values:(Array.isArray(data.values)?data.values:[]) as DebugState['values']});
 }
 async action(action:DebugAction,extra:{path?:string;line?:number;objectId?:string;breakpointId?:string;condition?:string;logMessage?:string}={}){if(!this.active())return;await this.host.invoke('debug_action',{request:{sessionId:this.state.sessionId,workspaceId:this.state.workspaceId,action,...extra}});}
 async stop(){const {sessionId,workspaceId}=this.state;++this.epoch;this.off?.();this.off=undefined;if(sessionId&&workspaceId)await this.host.invoke('debug_stop',{sessionId,workspaceId});this.update({status:'stopped',frames:[],values:[]});}
}
