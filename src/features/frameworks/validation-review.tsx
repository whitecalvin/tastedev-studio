'use client';
import {useEffect,useState} from 'react';
import {useI18n} from '@/i18n/react';
import {remoteCore} from '../core/remote-client';
import {immutableRunSource} from '../ai/run-source';
import {contentHash} from '../ai/fix-service';
import {GitDiffEditor} from '../git/diff-editor';
import {frameworkChanges} from './integration';
import type {FrameworkSession} from './session';
export function NativeValidationReview({session,disabled,approve}:{session:FrameworkSession;disabled:boolean;approve:()=>void}){
 const {t}=useI18n(),[diffs,setDiffs]=useState<{path:string;original:string;modified:string}[]|null>(null),[error,setError]=useState('');
 const identity=session.id+':'+session.effectiveSourceChecksum;
 useEffect(()=>{const abort=new AbortController();void(async()=>{const source=await immutableRunSource(session.scope.projectId,session.scope.runId,(path,max,signal)=>remoteCore.runSourceRequest(path,session.scope.projectId,max,signal),abort.signal);if(source.identity.checksum!==session.scope.sourceChecksum)throw Error('Native Source identity mismatch.');const changes=frameworkChanges(session);if(changes.some(c=>c.manualReview))throw Error('Binary changes require manual review before execution.');const result=[];for(const change of changes){const original=change.beforeHash===null?'':(await source.files.read(change.path)).content;if(change.beforeHash!==null&&await contentHash(original)!==change.beforeHash||change.afterHash!==(change.content===null?null:await contentHash(change.content)))throw Error('Native Diff checksum mismatch.');result.push({path:change.path,original,modified:change.content??''});}if(!abort.signal.aborted)setDiffs(result);})().catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Native Diff unavailable.');});return()=>abort.abort();
 // A request seals Source: polling the same identity must not reset its review.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[identity]);
 return <div><p>{t('Review native Diff before running Godot')}</p>{diffs?.map(diff=><details key={diff.path} open><summary>{diff.path}</summary><div className="ai-review-diff"><GitDiffEditor diff={{...diff,side:'working',binary:false}}/></div></details>)}{error&&<p role="alert">{error}</p>}<button className="fs-button" disabled={disabled||diffs===null||!!error} onClick={approve}>{t('Approve validation')}</button></div>;
}
