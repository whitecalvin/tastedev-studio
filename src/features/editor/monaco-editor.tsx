"use client";
import { useEffect, useRef, useState } from 'react';
import type * as Monaco from 'monaco-editor';
import {useDebugService} from '../debugger/views';
import { useFiles } from './session';
import {useI18n} from '@/i18n/react';
import { loadLanguageWorkspace, uriWorkspacePath, workspaceUri } from './language-workspace';
import { boundIndexReader } from './workspace-index';
let monacoPromise: Promise<typeof Monaco> | undefined;
export const editorActions = { definition:'editor.action.revealDefinition', references:'editor.action.referenceSearch.trigger', format:'editor.action.formatDocument' } as const;
export function requestEditorAction(action: keyof typeof editorActions){window.dispatchEvent(new CustomEvent('tastestudio.editor.action',{detail:action}));}
export function loadMonaco() {
  monacoPromise ??= (async () => {
    const response = await fetch('/monaco/workers.json'); if (!response.ok) throw new Error('Editor worker assets are unavailable. Rebuild the application.');
    const paths: Record<string, string> = await response.json();
    (globalThis as typeof globalThis & { MonacoEnvironment?: Monaco.Environment }).MonacoEnvironment = { getWorker(_module, label) {
      const kind = label === 'typescript' || label === 'javascript' ? 'ts' : ['css', 'scss', 'less'].includes(label) ? 'css' : ['html', 'handlebars', 'razor'].includes(label) ? 'html' : label === 'json' ? 'json' : 'editor';
      return new Worker(paths[kind], { name: `studio-${kind}` });
    } };
    const monaco=await import('monaco-editor');
    if(paths['ts-module-support'])for(const setting of [monaco.typescript.typescriptDefaults,monaco.typescript.javascriptDefaults])setting.setWorkerOptions({customWorkerPath:new URL(paths['ts-module-support'],window.location.origin).href});
    return monaco;
  })().catch(error => { monacoPromise = undefined; throw error; });
  return monacoPromise;
}
export function MonacoEditor() {
  const debug=useDebugService();
  const { documents, editor: state, busy, files, connection, revision, setProblems } = useFiles();
  const {t}=useI18n();const ariaLabel=t('File editor');const label=useRef(ariaLabel);
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const protectedEditor = useRef(busy);
  const [error, setError] = useState('');
  useEffect(()=>{label.current=ariaLabel;instance.current?.updateOptions({ariaLabel});},[ariaLabel]);
  useEffect(() => {
    let alive = true;
    const models = new Map<string, Monaco.editor.ITextModel>();
    const views = new Map<string, Monaco.editor.ICodeEditorViewState | null>();
    const saved = new Map<string,string>();
    let unsubscribeDebug:(()=>void)|undefined;
    let unsubscribe: (() => void) | undefined, observer: MutationObserver | undefined;
    let change: Monaco.IDisposable | undefined, selection: Monaco.IDisposable | undefined;
    let opener: Monaco.IDisposable | undefined, markers: Monaco.IDisposable | undefined;
    const controller = new AbortController(), retained = new Set<Monaco.editor.ITextModel>();
    let languageCleanup: (()=>void) | undefined;
    let actionListener: ((event: Event)=>void) | undefined;
    let active: string | null = null, syncing = false;
    loadMonaco().then(monaco => {
      if (!alive || !container.current) return;
      const widget = monaco.editor.create(container.current, { model: null, readOnly:!!protectedEditor.current, automaticLayout: true, fontSize: 13, fontFamily: 'Consolas, monospace', lineNumbers: 'on', glyphMargin:true, minimap: { enabled: false }, wordWrap: 'off', tabSize: 2, scrollBeyondLastLine: false, bracketPairColorization: { enabled: true }, accessibilitySupport: 'auto', ariaLabel: label.current, fixedOverflowWidgets: true });
      instance.current = widget;
      const decorations=widget.createDecorationsCollection();
      actionListener=(event)=>{const action=(event as CustomEvent).detail as keyof typeof editorActions;if(!Object.hasOwn(editorActions,action)||widget.getOption(monaco.editor.EditorOption.readOnly))return;void widget.getAction(editorActions[action])?.run().catch(error=>{if(alive)setError(error instanceof Error?error.message:'Editor action failed.');});};
      window.addEventListener('tastestudio.editor.action',actionListener);
      const theme = () => monaco.editor.setTheme(document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs');
      theme(); observer = new MutationObserver(theme); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      const sync = () => {
        const state = documents.snapshot(); syncing = true;
        for (const doc of state.openEditors) {
          let model = models.get(doc.id);
          if (!model) { const uri = workspaceUri(monaco, connection?.id ?? 'disconnected', doc.path); model = monaco.editor.getModel(uri) ?? monaco.editor.createModel(doc.content, doc.language, uri); if(model.getValue(undefined,true)!==doc.content)model.setValue(doc.content); models.set(doc.id, model); }
          else { if (model.getValue(undefined, true) !== doc.content) model.setValue(doc.content); if (model.getLanguageId() !== doc.language) monaco.editor.setModelLanguage(model, doc.language); }
          saved.set(doc.id,doc.savedContent);
        }
        if (active !== state.activeEditorId) {
          if (active) views.set(active, widget.saveViewState());
          active = state.activeEditorId; widget.setModel(active ? models.get(active)! : null);
          const view = active ? views.get(active) : null; if (view) widget.restoreViewState(view);
          if (active) widget.focus();
        }
        for (const [id, model] of models) if (!state.openEditors.some(doc => doc.id === id)) { if (!retained.has(model)) model.dispose(); else if(saved.has(id)&&model.getValue(undefined,true)!==saved.get(id))model.setValue(saved.get(id)!); models.delete(id); views.delete(id); saved.delete(id); }
        if(documents.revealLine){widget.revealLineInCenter(documents.revealLine);widget.setPosition({lineNumber:documents.revealLine,column:1});documents.revealLine=undefined;}
        const doc=active?documents.get(active):null, debugState=debug?.snapshot();
        decorations.set(doc&&debugState?[...debugState.breakpoints.filter(point=>point.path===doc.path).map(point=>({range:new monaco.Range(point.line,1,point.line,1),options:{glyphMarginClassName:'studio-debug-breakpoint',glyphMarginHoverMessage:{value:'Breakpoint'}}})),...debugState.frames.slice(0,1).filter(frame=>frame.path===doc.path).map(frame=>({range:new monaco.Range(frame.line,1,frame.line,1),options:{isWholeLine:true,className:'studio-debug-paused'}}))]:[]);
        syncing = false;
      };
      change = widget.onDidChangeModelContent(() => { if (!syncing && active) documents.edit(active, widget.getModel()!.getValue(undefined, true)); });
      selection=widget.onDidChangeCursorSelection(event=>{documents.selection=active&&!event.selection.isEmpty()?{path:documents.get(active).path,text:widget.getModel()!.getValueInRange(event.selection),start:event.selection.startLineNumber}:undefined;});
      sync(); unsubscribe = documents.subscribe(sync); unsubscribeDebug=debug?.subscribe(sync);
      if (connection?.permission === 'granted') {
        const connectionId=connection.id;
        opener=monaco.editor.registerEditorOpener({async openCodeEditor(_source,uri,position){const path=uriWorkspacePath(uri,connectionId);if(!path||!alive||files.connection?.id!==connectionId)return false;await documents.open(path);if(!alive||files.connection?.id!==connectionId)return false;documents.reveal(position?('startLineNumber' in position?position.startLineNumber:position.lineNumber):1);return true;}});
        const updateProblems=()=>{if(!alive)return;setProblems(monaco.editor.getModelMarkers({}).flatMap(marker=>{const path=uriWorkspacePath(marker.resource,connectionId);return path?[{path,line:marker.startLineNumber,column:marker.startColumn,message:marker.message,severity:marker.severity}]:[];}).slice(0,200));};
        markers=monaco.editor.onDidChangeMarkers(updateProblems);
        void loadLanguageWorkspace(monaco,boundIndexReader(files,connectionId),connectionId,controller.signal,()=>documents.snapshot().openEditors.map(doc=>({path:doc.path,content:doc.content}))).then(language=>{
          if(!alive){language.dispose();return;}
          for(const file of language.result.files){const model=monaco.editor.getModel(workspaceUri(monaco,connectionId,file.path));if(model)retained.add(model);}
          languageCleanup=()=>{language.dispose();for(const model of retained)if(!model.isDisposed())model.dispose();};
          if(language.warnings.length)setError(language.warnings.join(' '));else if(language.result.limited)setError('Language indexing limit reached. Open additional files directly.');
          updateProblems();
        }).catch(error=>{if(alive&&!controller.signal.aborted)setError(error instanceof Error?error.message:'Language workspace could not load.');});
      }
    }).catch(error => { if (alive) setError(error instanceof Error ? error.message : 'The editor could not be loaded.'); });
    return () => { alive = false; controller.abort(); if(actionListener)window.removeEventListener('tastestudio.editor.action',actionListener); unsubscribe?.(); unsubscribeDebug?.(); observer?.disconnect(); change?.dispose(); selection?.dispose(); opener?.dispose(); markers?.dispose(); instance.current?.dispose(); instance.current = null; languageCleanup?.(); models.forEach(model => {if(!model.isDisposed())model.dispose();}); setProblems([]); };
  }, [debug, documents, files, connection?.id, connection?.permission, revision, setProblems]);
  useEffect(() => { protectedEditor.current=busy; instance.current?.updateOptions({ readOnly: !!busy }); }, [busy]);
  return <div className="fs-monaco-wrap" hidden={!state.activeEditorId}><div ref={container} className="fs-monaco" />{error && <p className="fs-editor-error" role="alert">{error}</p>}</div>;
}
