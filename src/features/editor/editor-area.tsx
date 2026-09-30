"use client";
import { useI18n, I18nText } from '@/i18n/react';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { FileCode2, Save, SaveAll, RotateCcw, X } from 'lucide-react';
import { useFiles } from './session';
const MonacoEditor = dynamic(() => import('./monaco-editor').then(module => module.MonacoEditor), { ssr: false, loading: () => <p className="fs-empty" role="status">{<I18nText text="Loading editor…" />}</p> });
export function EditorTabs() {
  const { t } = useI18n();

  const { editor, documents, close, busy } = useFiles();
  useEffect(() => {
    const tab = document.getElementById(`editor-tab-${editor.activeEditorId}`)?.parentElement;
    const strip = tab?.parentElement;
    if (!tab || !strip) return;
    const reveal = () => tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [editor.activeEditorId]);
  return <div className="fs-editor-tabs" role="tablist" aria-label={t("Open files")}>{editor.openEditors.length === 0 && <span className="fs-no-editors"><FileCode2 size={15} />{t("No open editors")}</span>}{editor.openEditors.map((doc, index) => <div key={doc.id} className={`fs-tab ${doc.id === editor.activeEditorId ? 'fs-tab-active' : ''}`}><button role="tab" id={`editor-tab-${doc.id}`} aria-selected={doc.id === editor.activeEditorId} aria-controls="editor-document-panel" title={doc.path} tabIndex={doc.id === editor.activeEditorId ? 0 : -1} onClick={() => documents.activate(doc.id)} onKeyDown={event => { const next = event.key === 'ArrowRight' ? (index + 1) % editor.openEditors.length : event.key === 'ArrowLeft' ? (index + editor.openEditors.length - 1) % editor.openEditors.length : event.key === 'Home' ? 0 : event.key === 'End' ? editor.openEditors.length - 1 : -1; if (next >= 0) { event.preventDefault(); const target = editor.openEditors[next]; documents.activate(target.id); document.getElementById(`editor-tab-${target.id}`)?.focus(); } }}><FileCode2 size={13} /><span>{doc.name}</span>{editor.dirtyEditors.includes(doc.id) && <span className="fs-dirty" aria-label={t("Unsaved changes")}>●</span>}</button><button className="fs-tab-close" aria-label={t("Close {name}",{name:doc.name})} disabled={!!busy} onClick={() => void close(doc.id)}><X size={12} /></button></div>)}</div>;
}
export function FileEditorArea() {
  const { t } = useI18n();

  const session = useFiles();
  const { editor, documents, connection, busy } = session;
  const active = editor.openEditors.find(d => d.id === editor.activeEditorId);
  const reload = async () => {
    if (!active) return;
    const dirty = editor.dirtyEditors.includes(active.id);
    if (dirty && await session.ask({ title: 'Reload from disk?', message: `Discard unsaved changes in “${active.name}” and load its current disk content?`, choices: [{ value: 'reload', label: 'Discard and reload', danger: true }, { value: 'cancel', label: 'Cancel' }] }) !== 'reload') return;
    await session.run('Reloading file…', () => documents.reload(active.id, dirty));
  };
  return <main id="main-content" className="ws-editor" aria-label={t("Editor area")}><EditorTabs /><div className="fs-editor-toolbar"><span title={active?.path}>{active?.path ?? t("Select a file in Explorer")}</span><button aria-label={t("Save file")} title={t("Save file (Ctrl+S)")} disabled={!active || !!busy || !editor.dirtyEditors.includes(active.id)} onClick={() => void session.save()}><Save size={14} /></button><button aria-label={t("Save all files")} title={t("Save all files")} disabled={!!busy || !editor.dirtyEditors.length} onClick={() => void session.run('Saving files…', session.saveAll)}><SaveAll size={14} /></button><button aria-label={t("Reload file from disk")} title={t("Reload file from disk")} disabled={!active || !!busy} onClick={() => void reload()}><RotateCcw size={14} /></button></div><div id="editor-document-panel" role="tabpanel" aria-labelledby={active ? `editor-tab-${active.id}` : undefined} aria-label={active ? undefined : t("No open file")} className="fs-document-panel">{!active && <div className="ws-editor-content"><div className="ws-welcome"><FileCode2 size={32} strokeWidth={1.3} /><h1>{connection?.name ?? t("Your workspace")}</h1><p>{connection?.permission === 'granted' ? t("Choose a file in Explorer to start editing.") : t("Connect a folder to browse and edit local files.")}</p><p className="ws-welcome-description">{t("UTF-8 text files up to 2 MiB. Changes are saved only when you choose Save.")}</p>{connection?.permission !== 'granted' && <button className="fs-button" disabled={!!busy} onClick={() => void session.connect()}>{t("Connect Folder")}</button>}</div></div>}{editor.openEditors.length > 0 && <MonacoEditor />}</div></main>;
}

