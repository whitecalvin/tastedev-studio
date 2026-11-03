'use client';
import {useRef,useState} from 'react';
import {useCore} from '../core/context';
import {useFiles} from '../editor/session';
import {useI18n} from '@/i18n/react';
import {frameworkTurnCompleted,type FrameworkSession} from './session';
import {NativeValidationReview} from './validation-review';
export function FrameworkValidationRetry({session}:{session:FrameworkSession}){
 const core=useCore(),files=useFiles(),{t}=useI18n(),[busy,setBusy]=useState(false),[error,setError]=useState(''),nonce=useRef<string|null>(null),lock=useRef(false);
 const original=core.snapshot.runs.find(r=>r.id===session.scope.runId),job=core.snapshot.jobs.find(j=>j.id===original?.jobId),latest=session.validationAttempts?.at(-1),retryJob=core.snapshot.jobs.find(j=>j.id===latest?.jobId),retryRun=core.snapshot.runs.find(r=>r.jobId===retryJob?.id),active=retryJob&&['queued','assigned','running'].includes(retryJob.status),remaining=2-(session.validationAttempts?.length??0),plan=job?.payload.steps.find(s=>s.executable==='internal-framework-godot');
 if(!frameworkTurnCompleted(session)||!session.effectiveSourceChecksum||!original||!['failed','cancelled','timeout'].includes(original.status))return null;
 async function approve(){if(lock.current)return;lock.current=true;setBusy(true);setError('');const generation=core.connection.generation;
  try{if(!job||!plan||!core.connection.connected)throw Error('Original validation plan unavailable.');
   const requestId=latest&&!latest.jobId?latest.requestId:nonce.current??crypto.randomUUID();nonce.current=requestId;
   const answer=await files.ask({title:t('Approve validation'),message:JSON.stringify({sessionId:session.id,nativeSessionId:session.nativeSessionId,sourceChecksum:session.effectiveSourceChecksum,agentId:session.scope.agentId,validation:{testName:job.payload.testPlan?.testName,args:plan.args,timeoutMs:plan.timeoutMs},modelReplay:false,maximumAttempts:3,attempt:latest&&!latest.jobId?latest.attempt:(session.validationAttempts?.length??0)+2},null,2),choices:[{value:'approve',label:t('Approve Retest')},{value:'cancel',label:t('Cancel')}]});
   if(answer!=='approve')return;if(generation!==core.connection.generation)throw Error('Core connection changed. Review again.');
   await core.connection.frameworkRequest('retry-validation',{sessionId:session.id,nativeSessionId:session.nativeSessionId,workspaceId:session.scope.workspaceId,configurationChecksum:session.scope.configurationChecksum,sourceChecksum:session.effectiveSourceChecksum,requestId});nonce.current=null;
  }catch(e){setError(e instanceof Error?e.message:'Validation retry unavailable.');}finally{lock.current=false;setBusy(false);}
 }
 return <details><summary>{t('Retest')} · {t('Validation Plan')}</summary><p>{retryRun?.status==='passed'?t('passed'):t('Actual Agent test required before original integration')}</p><p><code title={session.effectiveSourceChecksum}>{session.effectiveSourceChecksum.slice(0,12)}</code> · <code title={session.scope.agentId}>{session.scope.agentId.slice(0,12)}</code></p>{plan&&<p style={{overflowWrap:'anywhere'}}><strong>{job?.payload.testPlan?.testName}</strong> · <code>{plan.args.join(' ')}</code></p>}{session.validationAttempts?.map(a=><p key={a.requestId}>{t('Attempt')} {a.attempt}/3 · <code title={a.runId??a.jobId}>{(a.runId??a.jobId??'—').slice(0,12)}</code> · {t(core.snapshot.runs.find(r=>r.id===a.runId)?.status??'prepared')}</p>)}{retryRun?.status!=='passed'&&<NativeValidationReview session={session} disabled={busy||!core.connection.connected||!!active||remaining<=0&&!!latest?.jobId} approve={()=>void approve()}/ >}{error&&<p role="alert">{error}</p>}</details>;
}
