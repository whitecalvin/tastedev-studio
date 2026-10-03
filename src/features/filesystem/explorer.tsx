"use client";
import { useI18n } from '@/i18n/react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, FilePlus, FolderPlus, RefreshCw, Pencil, Trash2, Unplug } from 'lucide-react';
import {readExpandedFolders} from './expanded-folders';
import { useFiles } from '../editor/session';
import { useRuntime } from '../runtime/label';
import { fileMessage } from './file-service';
import { containsPath, parentPath } from './paths';
import type { FileEntry } from './contracts';

export function Explorer({ decoration }: { decoration?: (path: string) => { label: string; text: string } | null }) {
  const { t } = useI18n();

  const session = useFiles();
  const runtime = useRuntime();
  const { files, connection, revision, busy, ready, setError } = session;
  const [entries, setEntries] = useState<Record<string, FileEntry[]>>({});
  const [expanded, setExpanded] = useState<string[]>(['']);
  const expandedRef=useRef(expanded),generation=useRef(0);
  const [folderErrors,setFolderErrors]=useState<Record<string,string>>({});
  useEffect(()=>{expandedRef.current=expanded;},[expanded]);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const connected = connection?.permission === 'granted';
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!active) return;
      setEntries({}); setFolderErrors({}); expandedRef.current=['']; setSelected(null); setExpanded(['']);
    });
    return () => { active = false; };
  }, [connection?.id]);
  useEffect(() => {
    if (!connected) return;
    let active = true; const epoch=++generation.current;
    Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      try {
        const result = await readExpandedFolders(expandedRef.current,path=>files.list(path,showHidden),()=>active&&epoch===generation.current);
        if (active&&result) {setEntries(result.entries);setFolderErrors(result.errors);}
      } catch (error) { if (active) setError(fileMessage(error)); }
      finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [files, connection?.id, connected, revision, showHidden, setError]);
  const load = async (path: string) => { const epoch=generation.current,id=connection?.id;const children = await files.list(path, showHidden); if(epoch!==generation.current||files.connection?.id!==id)return false;setEntries(previous => ({ ...previous, [path]: children }));setFolderErrors(previous=>{const next={...previous};delete next[path];return next;});return true; };
  const toggle = async (entry: FileEntry) => {
    if (busy || loading) return;
    setSelected(entry);
    if (entry.kind === 'file') { await session.run('Opening file…', () => session.documents.open(entry.path)); return; }
    if (expanded.includes(entry.path)) { setExpanded(values => values.filter(path => path !== entry.path)); return; }
    await session.run('Reading folder…', async () => { if(await load(entry.path))setExpanded(values => values.includes(entry.path)?values:[...values, entry.path]); });
  };
  const refresh = async () => {
    await session.run('Refreshing Explorer…', async () => {
      const epoch=++generation.current,id=connection?.id;
      const result=await readExpandedFolders([...expanded, ...(selected?.kind==='directory'?[selected.path]:[])],path=>files.list(path,showHidden),()=>epoch===generation.current&&files.connection?.id===id);
      if(!result)return;
      setEntries(result.entries);setFolderErrors(result.errors);
      if (selected && !Object.values(result.entries).flat().some(e => e.path === selected.path)) setSelected(null);
    });
  };
  const create = async (kind: 'file' | 'directory') => {
    const parent = selected?.kind === 'directory' ? selected.path : selected ? parentPath(selected.path) : '';
    const name = await session.ask({ title: kind === 'file' ? 'New file' : 'New folder', message: `Create in ${parent || connection?.name || 'workspace root'}.`, initial: '', choices: [{ value: 'submit', label: 'Create' }, { value: 'cancel', label: 'Cancel' }] });
    if (name === null) return;
    await session.run('Creating entry…', async () => { const path = await files.create(parent, name, kind); await load(parent); setExpanded(values => values.includes(parent) ? values : [...values, parent]); setSelected({ path, name, kind }); if (kind === 'file') await session.documents.open(path); });
  };
  const rename = async () => {
    if (!selected?.path) return;
    const source = selected;
    const name = await session.ask({ title: 'Rename entry', message: 'Rename this entry in the connected workspace. Avoid external edits during this operation. Unsaved editor changes are preserved.', initial: source.name, choices: [{ value: 'submit', label: 'Rename' }, { value: 'cancel', label: 'Cancel' }] });
    if (name === null) return;
    await session.run('Renaming entry…', async () => {
      try { const target = await files.rename(source.path, name); session.documents.renamed(source.path, target); setExpanded(values => values.map(path => containsPath(source.path, path) ? target + path.slice(source.path.length) : path)); setSelected({ ...source, path: target, name }); setEntries({}); await load(''); }
      finally { session.refresh(); }
    });
  };
  const remove = async () => {
    if (!selected?.path) return;
    const source = selected, affected = session.editor.openEditors.filter(d => containsPath(source.path, d.path)), dirty = affected.filter(d => d.content !== d.savedContent);
    const result = await session.ask({ title: 'Delete permanently?', message: `Delete “${source.name}”${source.kind === 'directory' ? ' and all its contents' : ''} from disk? This cannot be undone in Studio. ${affected.length} open editor(s) will close; ${dirty.length} unsaved document(s) will be discarded.`, choices: [{ value: 'delete', label: 'Delete permanently', danger: true }, { value: 'cancel', label: 'Cancel' }] });
    if (result !== 'delete') return;
    await session.run('Deleting entry…', async () => { try { await files.delete(source.path); session.documents.removed(source.path); setExpanded(values => values.filter(path => !containsPath(source.path, path))); setSelected(null); await load(parentPath(source.path)); } finally { session.refresh(); } });
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>, entry: FileEntry) => {
    if (event.target !== event.currentTarget) return;
    const items = Array.from(event.currentTarget.closest('[role="tree"]')!.querySelectorAll<HTMLElement>('[role="treeitem"]')).filter(item => item.offsetParent !== null);
    const index = items.indexOf(event.currentTarget);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))); items[next]?.focus(); }
    if (event.key === 'Enter' || event.key === ' ' || (event.key === 'ArrowRight' && entry.kind === 'directory' && !expanded.includes(entry.path))) { event.preventDefault(); void toggle(entry); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); if (expanded.includes(entry.path) && entry.path) setExpanded(values => values.filter(path => path !== entry.path)); else items.find(item => item.dataset.path === parentPath(entry.path))?.focus(); }
  };
  const renderEntry = (entry: FileEntry, depth: number): React.ReactNode => <div key={entry.path} role="treeitem" aria-label={entry.name} aria-level={depth + 1} aria-expanded={entry.kind === 'directory' ? expanded.includes(entry.path) : undefined} aria-selected={selected?.path === entry.path} tabIndex={selected?.path === entry.path || (!selected && entry.path === '') ? 0 : -1} data-path={entry.path} onFocus={event => { if (event.target === event.currentTarget) setSelected(entry); }} onKeyDown={event => keyboard(event, entry)}>
    <div className="fs-tree-row" style={{ paddingLeft: 8 + depth * 14 }} title={entry.path || connection?.name} onClick={event => { event.stopPropagation(); event.currentTarget.parentElement?.focus(); if (!entry.path) { setSelected(entry); setExpanded(values => values.includes('') ? values.filter(p => p !== '') : ['', ...values]); } else void toggle(entry); }}>
      {entry.kind === 'directory' ? expanded.includes(entry.path) ? <ChevronDown size={12} /> : <ChevronRight size={12} /> : <span className="fs-tree-spacer" />}{entry.kind === 'directory' ? <Folder size={14} /> : <File size={14} />}<span>{entry.name}</span>{decoration?.(entry.path) && <small aria-label={`Git: ${decoration(entry.path)!.label}`}>{decoration(entry.path)!.text}</small>}
    </div>
    {entry.kind === 'directory' && expanded.includes(entry.path) && <div role="group">{(Object.hasOwn(entries, entry.path) ? entries[entry.path] : undefined)?.map(child => renderEntry(child, depth + 1))}{Object.hasOwn(entries, entry.path) && entries[entry.path].length === 0 && <p className="fs-empty-folder">{t("Empty folder")}</p>}{!Object.hasOwn(entries, entry.path) && (folderErrors[entry.path]?<div className="fs-folder-retry" style={{paddingLeft:22+depth*14}}><span title={folderErrors[entry.path]}>{t('Could not load folder.')}</span><button className="ws-text-button" disabled={!!busy||loading} onClick={() => void session.run('Reading folder…', async()=>{await load(entry.path);})}>{t('Retry')}</button></div>:<p className="fs-empty-folder" role="status">{t('Reading folder…')}</p>)}</div>}
  </div>;
  return <div className="fs-explorer">
    {!ready ? <p className="fs-empty" role="status">{t("Checking folder access…")}</p> : !connected ? <div className="fs-empty"><FolderOpen size={24} /><h3>{t("No workspace folder is connected.")}</h3><p>{connection?.permission === 'denied' ? t("Permission was denied. Request access or reconnect the folder.") : t("Choose a local folder to browse and edit its files.")}</p><button className="fs-button" disabled={!!busy} onClick={() => void session.connect()}>{connection ? t("Reconnect Folder") : t("Connect Folder")}</button>{connection && <button className="ws-text-button" disabled={!!busy} onClick={() => void session.requestAccess()}>{t("Request access")}</button>}<p className="fs-hint">{runtime === 'desktop' ? t("Select the project folder on your computer to reconnect.") : t("Requires File System Access API in desktop Chrome or Edge.")}</p></div> : <>
      <div className="fs-toolbar"><button aria-label={t("New file")} title={t("New file")} disabled={!!busy || loading} onClick={() => void create('file')}><FilePlus size={15} /></button><button aria-label={t("New folder")} title={t("New folder")} disabled={!!busy || loading} onClick={() => void create('directory')}><FolderPlus size={15} /></button><button aria-label={t("Rename selected entry")} title={t("Rename selected entry")} disabled={!selected?.path || !!busy} onClick={() => void rename()}><Pencil size={14} /></button><button aria-label={t("Delete selected entry")} title={t("Delete selected entry")} disabled={!selected?.path || !!busy} onClick={() => void remove()}><Trash2 size={14} /></button><button aria-label={t("Refresh Explorer")} title={t("Refresh expanded folders")} disabled={!!busy || loading} onClick={() => void refresh()}><RefreshCw size={14} /></button><button aria-label={t("Disconnect folder")} title={t("Disconnect folder")} disabled={!!busy} onClick={() => void session.disconnect()}><Unplug size={14} /></button></div>
      <label className="fs-hidden-toggle"><input type="checkbox" checked={showHidden} onChange={event => setShowHidden(event.target.checked)} />{t("Show ignored folders")}</label>
      {loading && <p className="fs-hint" role="status">{t("Reading folder…")}</p>}
      <div role="tree" aria-label={t("Workspace files")} aria-busy={loading || !!busy}>{renderEntry({ path: '', name: connection.name, kind: 'directory' }, 0)}</div>
      {!connection.persistent && <p className="fs-hint">{t("This connection is temporary. Reconnect after reloading.")}</p>}
    </>}
  </div>;
}


