'use client';
import {useEffect,useRef,useState} from 'react';
import {useI18n} from '@/i18n/react';
import {useCore} from '../core/context';
import {useUpdateProtection} from '../update/views';
import {IssueError} from '../issues/domain';
import {repository} from '../issues/security';
import type {PullDraft,PullChecks} from './pull-requests';
import type {CollaborationService,CollaborationOverview} from './collaboration';
export function PullRequestView({service,overview,base,remote}:{service:CollaborationService;overview:CollaborationOverview|null;base:string;remote:string}){
 const core=useCore(),{t}=useI18n(),connected=core.remote&&core.connection.connected;
 const[title,setTitle]=useState(''),[body,setBody]=useState(''),[drafts,setDrafts]=useState<PullDraft[]>([]),[selected,setSelected]=useState(''),[checks,setChecks]=useState<PullChecks|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);useUpdateProtection(()=>lock.current);
 const draft=drafts.find(row=>row.id===selected);
 useEffect(()=>{let alive=true;if(connected)void core.connection.issueRequest<PullDraft[]>({action:'pr-list'},core.project.id).then(rows=>{if(alive)setDrafts(rows);},()=>{if(alive)setError('Pull request operation failed. Inspect state before retrying.');});return()=>{alive=false;};},[connected,core.connection,core.project.id]);
 const perform=async(action:string)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');setChecks(null);try{
  let request:Record<string,unknown>={action,id:selected};
  if(action==='pr-build'){
   if(!overview?.branch||!overview.head)throw Error('Refresh Git before preparing a pull request.');
   if(!await service.compare(remote,base,overview.branch))throw Error('Refresh Git before preparing a pull request.');
   const url=new URL(service.snapshot().compareURL),repo=url.pathname.split('/').slice(1,3).join('/');
   if(repository(core.project.repositoryUrl)!==repository(repo))throw Error('Project repository does not match the selected Git remote.');
   request={action,prFields:{title,body,base,head:overview.branch,sha:overview.head}};
  }
  const value=await core.connection.issueRequest<PullDraft|{draft:PullDraft;checks:PullChecks}>(request,core.project.id),row='draft'in value?value.draft:value;
  setDrafts(old=>[row,...old.filter(item=>item.id!==row.id)]);setSelected(row.id);if('checks'in value)setChecks(value.checks);
 }catch(fault){setError(fault instanceof IssueError?fault.code==='stale'?'Refresh Git before preparing a pull request.':fault.message:fault instanceof Error?fault.message:'Pull request operation failed. Inspect state before retrying.');const rows=await core.connection.issueRequest<PullDraft[]>({action:'pr-list'},core.project.id).catch(()=>null);if(rows)setDrafts(rows);}finally{lock.current=false;setBusy(false);}};
 return <section aria-label={t('Pull requests')}><h3>{t('Pull requests')}</h3><p>{t('GitHub credentials stay on Core. Review the exact repository, branches, revision and masked body before creating.')}</p>{!connected&&<p>{t('Connect to Core to manage pull requests.')}</p>}<label>{t('Title')}<input value={title} disabled={busy||!connected} maxLength={200} onChange={event=>setTitle(event.target.value)}/></label><label>{t('Body / Review')}<textarea value={body} disabled={busy||!connected} maxLength={40000} rows={5} onChange={event=>setBody(event.target.value)}/></label><button className="fs-button" disabled={busy||!connected||!title.trim()||!base||!remote} onClick={()=>void perform('pr-build')}>{t('Review pull request')}</button><ul>{drafts.map(row=><li key={row.id}><button className="fs-button" disabled={busy} onClick={()=>{setSelected(row.id);setChecks(null);}}>{row.title} · {row.status}</button></li>)}</ul>{draft&&<details open><summary>{draft.title}</summary><p>{draft.repository} · {draft.head} → {draft.base}</p><code>{draft.sha}</code><pre className="git-conflict-source">{draft.body}</pre><p>{draft.status}</p>{draft.status==='reviewing'&&<><button className="fs-button" disabled={busy||!connected} onClick={()=>void perform('pr-approve-create')}>{t('Approve and create pull request')}</button><button className="fs-button" disabled={busy} onClick={()=>void perform('pr-cancel')}>{t('Cancel')}</button></>}{draft.status==='uncertain'&&<button className="fs-button" disabled={busy} onClick={()=>void perform('pr-reconcile')}>{t('Reconcile Uncertain Create')}</button>}{draft.pull&&<><p><a href={draft.pull.url} target="_blank" rel="noopener noreferrer">#{draft.pull.number}</a> · {draft.pull.state} · <code>{draft.pull.sha}</code></p>{draft.pull.sha!==draft.sha&&<p role="status">{t('Pull request source changed after review. Inspect the current revision.')}</p>}<button className="fs-button" disabled={busy||!connected} onClick={()=>void perform('pr-status')}>{t('Refresh pull request and CI')}</button></>}</details>}{checks&&<><p>{t('CI checks')} · {checks.state} · <code>{checks.sha}</code></p><ul>{checks.checks.map((check,index)=><li key={index}>{check.name} · {check.status} · {check.conclusion??'—'}</li>)}</ul>{checks.truncated&&<p>{t('Showing the first 100 results.')}</p>}</>}{error&&<p role="alert">{t(error)}</p>}</section>;
}
