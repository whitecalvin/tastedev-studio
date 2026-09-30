"use client";
import { useEffect, useRef, useState } from 'react';
import type * as Monaco from 'monaco-editor';
import { useFiles } from './session';
let monacoPromise: Promise<typeof Monaco> | undefined;
export function loadMonaco() {
  monacoPromise ??= (async () => {
    const response = await fetch('/monaco/workers.json'); if (!response.ok) throw new Error('Editor worker assets are unavailable. Rebuild the application.');
    const paths: Record<string, string> = await response.json();
    (globalThis as typeof globalThis & { MonacoEnvironment?: Monaco.Environment }).MonacoEnvironment = { getWorker(_module, label) {
      const kind = label === 'typescript' || label === 'javascript' ? 'ts' : ['css', 'scss', 'less'].includes(label) ? 'css' : ['html', 'handlebars', 'razor'].includes(label) ? 'html' : label === 'json' ? 'json' : 'editor';
      return new Worker(paths[kind], { name: `studio-${kind}` });
    } };
    return import('monaco-editor');
  })().catch(error => { monacoPromise = undefined; throw error; });
  return monacoPromise;
}
export function MonacoEditor() {
  const { documents, editor: state, busy } = useFiles();
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const models = new Map<string, Monaco.editor.ITextModel>();
    const views = new Map<string, Monaco.editor.ICodeEditorViewState | null>();
    let unsubscribe: (() => void) | undefined, observer: MutationObserver | undefined;
    let change: Monaco.IDisposable | undefined, selection: Monaco.IDisposable | undefined;
    let active: string | null = null, syncing = false;
    loadMonaco().then(monaco => {
      if (!alive || !container.current) return;
      const widget = monaco.editor.create(container.current, { model: null, automaticLayout: true, fontSize: 13, fontFamily: 'Consolas, monospace', lineNumbers: 'on', minimap: { enabled: false }, wordWrap: 'off', tabSize: 2, scrollBeyondLastLine: false, bracketPairColorization: { enabled: true }, accessibilitySupport: 'auto', ariaLabel: 'File editor', fixedOverflowWidgets: true });
      instance.current = widget;
      const theme = () => monaco.editor.setTheme(document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs');
      theme(); observer = new MutationObserver(theme); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      const sync = () => {
        const state = documents.snapshot(); syncing = true;
        for (const doc of state.openEditors) {
          let model = models.get(doc.id);
          if (!model) { model = monaco.editor.createModel(doc.content, doc.language, monaco.Uri.parse(`studio://documents/${doc.id}/${encodeURIComponent(doc.name)}`)); models.set(doc.id, model); }
          else { if (model.getValue(undefined, true) !== doc.content) model.setValue(doc.content); if (model.getLanguageId() !== doc.language) monaco.editor.setModelLanguage(model, doc.language); }
        }
        if (active !== state.activeEditorId) {
          if (active) views.set(active, widget.saveViewState());
          active = state.activeEditorId; widget.setModel(active ? models.get(active)! : null);
          const view = active ? views.get(active) : null; if (view) widget.restoreViewState(view);
          if (active) widget.focus();
        }
        for (const [id, model] of models) if (!state.openEditors.some(doc => doc.id === id)) { model.dispose(); models.delete(id); views.delete(id); }
        if(documents.revealLine){widget.revealLineInCenter(documents.revealLine);widget.setPosition({lineNumber:documents.revealLine,column:1});documents.revealLine=undefined;}
        syncing = false;
      };
      change = widget.onDidChangeModelContent(() => { if (!syncing && active) documents.edit(active, widget.getModel()!.getValue(undefined, true)); });
      selection=widget.onDidChangeCursorSelection(event=>{documents.selection=active&&!event.selection.isEmpty()?{path:documents.get(active).path,text:widget.getModel()!.getValueInRange(event.selection),start:event.selection.startLineNumber}:undefined;});
      sync(); unsubscribe = documents.subscribe(sync);
    }).catch(error => { if (alive) setError(error instanceof Error ? error.message : 'The editor could not be loaded.'); });
    return () => { alive = false; unsubscribe?.(); observer?.disconnect(); change?.dispose(); selection?.dispose(); instance.current?.dispose(); instance.current = null; models.forEach(model => model.dispose()); };
  }, [documents]);
  useEffect(() => { instance.current?.updateOptions({ readOnly: !!busy }); }, [busy]);
  return <div className="fs-monaco-wrap" hidden={!state.activeEditorId}><div ref={container} className="fs-monaco" />{error && <p className="fs-editor-error" role="alert">{error}</p>}</div>;
}
