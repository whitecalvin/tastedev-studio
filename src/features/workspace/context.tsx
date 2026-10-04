"use client";
import type {NodeWorkflowContext} from './node-workflow';
import { WorkspaceLoading } from '@/components/ui/workspace-loading';
import { useI18n } from '@/i18n/react';
import { createContext, useCallback, useContext, useEffect, useReducer, useState, type Dispatch } from 'react';
import { initialState, readLayout, saveLayout, shortcuts, workspaceReducer, type Action, type WorkspaceState } from './state';
const Context = createContext<{ state: WorkspaceState; dispatch: Dispatch<Action>; nodeContext:NodeWorkflowContext|null; setNodeContext:(value:NodeWorkflowContext|null)=>void } | null>(null);
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error('Workspace provider required'); return value; }
export function WorkspaceProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const { t } = useI18n();

  const [state, dispatch] = useReducer(workspaceReducer, initialState);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState('');
  const [nodeContext,setNodeContextState]=useState<NodeWorkflowContext|null>(null);
  const setNodeContext=useCallback((value:NodeWorkflowContext|null)=>setNodeContextState(previous=>JSON.stringify(previous)===JSON.stringify(value)?previous:value),[]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try { dispatch({ type: 'hydrate', value: readLayout(window.localStorage, projectId) }); }
      catch (error) { setWarning(error instanceof SyntaxError ? 'Saved layout is invalid. Using a temporary layout; saved data is unchanged.' : error instanceof Error ? error.message : 'Layout storage is unavailable.'); }
      setReady(true);
    });
    return () => { active = false; };
  }, [projectId]);
  useEffect(() => {
    if (!ready || warning) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try { saveLayout(window.localStorage, projectId, state); }
      catch { setWarning('Layout changes are temporary because browser storage is unavailable.'); }
    });
    return () => { active = false; };
  }, [state, projectId, ready, warning]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || !event.ctrlKey || !event.altKey || event.shiftKey || event.metaKey || (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
      const shortcut = shortcuts.find(item => item.key === event.key.toLowerCase());
      if (shortcut) { event.preventDefault(); dispatch({ type: 'toggle', panel: shortcut.panel }); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  return <Context.Provider value={{ state, dispatch, nodeContext, setNodeContext }}>{ready ? <>{warning && <p className="ws-warning" role="status">{t(warning)}</p>}{children}</> : <WorkspaceLoading message="Loading workspace layout…"/>}</Context.Provider>;
}
