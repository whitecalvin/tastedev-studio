'use client';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/react';
import { useFiles } from './session';
import { useWorkspace } from '../workspace/context';
import { boundIndexReader, indexWorkspace, searchIndex, type SearchHit } from './workspace-index';

export function SearchView() {
  const { t } = useI18n(); const { files, documents, connection, ready, run } = useFiles(); const {dispatch}=useWorkspace();
  const [query,setQuery]=useState(''),[caseSensitive,setCase]=useState(false),[hits,setHits]=useState<SearchHit[]>([]),[pending,setPending]=useState(false),[message,setMessage]=useState('');
  const controller=useRef<AbortController|null>(null);
  const resultConnection=useRef('');
  useEffect(()=>()=>{controller.current?.abort();},[connection?.id]);
  async function search() {
    controller.current?.abort(); const current=new AbortController();controller.current=current;setPending(true);setMessage('');setHits([]);
    try {
      if(!ready||connection?.permission!=='granted')throw Error('Connect the project folder first.');
      searchIndex([],query,caseSensitive);
      const identity=connection.id;
      const indexed=await indexWorkspace(boundIndexReader(files,identity),current.signal,documents.snapshot().openEditors.map(doc=>({path:doc.path,content:doc.content})));
      if(current.signal.aborted||files.connection?.id!==identity)return;
      const result=searchIndex(indexed.files,query,caseSensitive);resultConnection.current=identity;setHits(result.hits);
      setMessage(`${result.hits.length} ${t('matches')} · ${indexed.files.length} ${t('files searched')}${indexed.limited||result.limited?' · '+t('Search limit reached'):''}${indexed.skipped.length?' · '+indexed.skipped.length+' '+t('files skipped'):''}`);
    } catch(error) {if(!current.signal.aborted)setMessage(error instanceof Error?error.message:'Search failed.');}
    finally {if(controller.current===current)setPending(false);}
  }
  return <section className="protocol-view" aria-label={t('Search this workspace')}><h3>{t('Search this workspace')}</h3><form className="protocol-form" onSubmit={e=>{e.preventDefault();void search();}}><label>{t('Search phrase')}<input maxLength={256} value={query} onChange={e=>setQuery(e.target.value)}/></label><label><span><input type="checkbox" checked={caseSensitive} onChange={e=>setCase(e.target.checked)}/>{t('Match case')}</span></label><div className="protocol-form-actions"><button className="fs-button" disabled={pending||!query||connection?.permission!=='granted'}>{t('Search')}</button>{pending&&<button type="button" className="fs-button" onClick={()=>{controller.current?.abort();setPending(false);setMessage(t('Cancelled'));}}>{t('Cancel')}</button>}</div></form><p>{t('Search includes current edits. Dependencies, build output and credential files are excluded.')}</p>{message&&<p role="status">{message}</p>}<ul className="protocol-list">{hits.map((hit,index)=><li key={`${hit.path}:${hit.line}:${hit.column}:${index}`}><button className="ws-text-button" onClick={()=>void run('Opening search result…',async()=>{if(files.connection?.id!==resultConnection.current)throw Error('Workspace changed. Search again.');await documents.open(hit.path);documents.reveal(hit.line);dispatch({type:'activity',value:'explorer'});})}>{hit.path}:{hit.line}:{hit.column}</button><code>{hit.text}</code></li>)}</ul></section>;
}
