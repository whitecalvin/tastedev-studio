import type {NativeInteraction,NativeFrameworkEvent} from './claude-framework-runner.ts';
import type {FrameworkSessions} from './framework-sessions.ts';
/** Structured SDK control bridge; it never parses log text into approvals or answers. */
export function frameworkInteraction(sessions:FrameworkSessions,projectId:string,sessionId:string):NativeInteraction{
 const current=()=>{const s=sessions.list(projectId).find(s=>s.id===sessionId);if(!s)throw Error('Framework session not found.');return s;};
 return {emit:async(event:NativeFrameworkEvent)=>{const s=current();sessions.event(projectId,sessionId,s.sequence+1,event.type,event.value,event.parentToolUseId);},request:async(kind,requestId,payload,signal)=>{
  signal.throwIfAborted();const pending=current().requests.find(q=>q.id===requestId);if(!pending||pending.kind!==kind)throw Error('Unregistered native control request.');
  return await new Promise<unknown>((resolve,reject)=>{let timer:ReturnType<typeof setTimeout>|undefined;const done=(value:unknown,error=false)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);if(error)reject(value);else resolve(value);},abort=()=>done(signal.reason??Error('Framework cancelled.'),true),check=()=>{try{const s=current(),r=s.requests.find(q=>q.id===requestId);if(signal.aborted){abort();return;}if(!r||s.status==='cancelled'||Date.parse(r.expiresAt)<=Date.now()){done(Error('Framework request expired or cancelled.'),true);return;}if(r.resolvedAt){done(r.response);return;}timer=setTimeout(check,100);}catch(e){done(e,true);}};signal.addEventListener('abort',abort,{once:true});check();});
 }};
}
