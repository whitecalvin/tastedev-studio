'use client';
import {createContext,useContext,useEffect,useState,useSyncExternalStore} from 'react';
import {nativeBridge} from '../runtime/native-hosts';
import {detectRuntime} from '../runtime/hosts';
import {useFiles} from '../editor/session';
import {useUpdateProtection} from '../update/views';
import {useI18n} from '@/i18n/react';
import {DebugService,type DebugEvent,type Frame} from './service';
const Context=createContext<DebugService|null>(null);
export function DebugProvider({children}:{children:React.ReactNode}){
 const [service]=useState(()=>new DebugService({supported:detectRuntime()==='desktop',invoke:(command,args)=>nativeBridge.invoke(command,args),async listen(fn){const api=await import('@tauri-apps/api/event');return api.listen<DebugEvent>('studio-debug',event=>fn(event.payload));}}));
 const {connection}=useFiles();useUpdateProtection(service.active);
 useEffect(()=>()=>{void service.stop().catch(()=>{});},[service,connection?.id]);
 return <Context.Provider value={service}>{children}</Context.Provider>;
}
export function useDebugService(){return useContext(Context);}
export function DebugView(){const service=useContext(Context)!;const state=useSyncExternalStore(service.subscribe,service.snapshot,service.snapshot);const files=useFiles(),{t}=useI18n();const [line,setLine]=useState('1'),[error,setError]=useState('');const active=files.editor.openEditors.find(d=>d.id===files.editor.activeEditorId);
 const run=async(fn:()=>Promise<unknown>)=>{setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Debug action failed.');}};
 const reveal=async(frame:Frame)=>{await files.documents.open(frame.path);files.documents.reveal(frame.line);};
 useEffect(()=>{const frame=state.frames[0];if(frame)void files.documents.open(frame.path).then(()=>files.documents.reveal(frame.line)).catch(()=>{});},[state.frames,files.documents]);
 return <section className="studio-debug" aria-label={t('Debugger')}><h3>{t('Debugger')}</h3><p>{t('Debug saved Node and TypeScript files locally.')}</p><p role="status">{t(state.status)}{state.exitCode!==null?` (${state.exitCode})`:''}</p><div className="studio-debug-actions"><button className="fs-button" disabled={!active||!files.connection||!!files.busy||service.active()||!service.host.supported} onClick={()=>void run(async()=>{const workspace=files.connection!.id,path=active!.path;if(files.editor.dirtyEditors.length)throw new Error('Save all edited files before debugging.');const snapshot=await files.files.read(path);if(files.files.connection?.id!==workspace)throw new Error('Workspace connection changed.');await service.start(workspace,path,snapshot.content,files.documents.snapshot().dirtyEditors.length>0);})}>{t('Start debugging')}</button><button className="fs-button" disabled={!service.active()} onClick={()=>void run(()=>service.stop())}>{t('Stop')}</button>{(['continue','pause','step-over','step-into','step-out'] as const).map(action=><button className="fs-button" key={action} disabled={!service.active()||(['step-over','step-into','step-out'].includes(action)&&state.status!=='paused')} onClick={()=>void run(()=>service.action(action))}>{t(action)}</button>)}</div>
 <label>{t('Breakpoint line')}<input type="number" min="1" max="100000" value={line} onChange={event=>setLine(event.target.value)}/></label><button className="fs-button" disabled={!active||!service.active()||!Number.isInteger(Number(line))||Number(line)<1||Number(line)>100000} onClick={()=>void run(()=>service.action('set-breakpoint',{path:active!.path,line:Number(line)}))}>{t('Add breakpoint')}</button><ul>{state.breakpoints.map(point=><li key={point.breakpointId}>{point.path}:{point.line}<button className="fs-button" disabled={!service.active()} onClick={()=>void run(()=>service.action('remove-breakpoint',{breakpointId:point.breakpointId}))}>{t('Remove')}</button></li>)}</ul>
 <h4>{t('Call stack')}</h4><ul>{state.frames.map((frame,index)=><li key={index}><button className="fs-button" onClick={()=>void run(()=>reveal(frame))}>{frame.functionName||'(anonymous)'} — {frame.path}:{frame.line}</button>{frame.scopes.map(scope=><button className="fs-button" key={scope.objectId} onClick={()=>void run(()=>service.action('variables',{objectId:scope.objectId}))}>{t('Variables')} ({scope.type})</button>)}</li>)}</ul><dl>{state.values.map((value,index)=><div key={index}><dt>{value.name}</dt><dd>{JSON.stringify(value.value)}</dd></div>)}</dl><details open><summary>{t('Debug console')}</summary><pre className="studio-debug-output">{state.output}</pre></details>{(error||state.error)&&<p role="alert">{t(error||state.error)}</p>}{!service.host.supported&&<p>{t('Debugging requires the desktop application.')}</p>}</section>;
}
