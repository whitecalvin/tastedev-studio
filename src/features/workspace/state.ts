export const activityIds = ['explorer', 'search', 'source-control', 'run', 'tests', 'agents', 'queue', 'runs', 'issues', 'ai', 'scheduler', 'settings'] as const;
export type Activity = typeof activityIds[number];
export const bottomTabs = ['Terminal', 'Output', 'Problems', 'Tests', 'Agent', 'Logs'] as const;
export type BottomTab = typeof bottomTabs[number];
export type Editor = import("../editor/documents.ts").EditorDocument;
export type EditorState = import("../editor/documents.ts").DocumentState;
export const emptyEditors: EditorState = { openEditors: [], activeEditorId: null, dirtyEditors: [] };
export interface WorkspaceState {
  activeActivity: Activity; primarySidebarVisible: boolean; secondaryPanelVisible: boolean;
  bottomPanelVisible: boolean; activeBottomPanelTab: BottomTab; bottomHeight: number; secondaryWidth: number;
}
export const initialState: WorkspaceState = { activeActivity: 'explorer', primarySidebarVisible: true, secondaryPanelVisible: true, bottomPanelVisible: true, activeBottomPanelTab: 'Terminal', bottomHeight: 180, secondaryWidth: 280 };
export type Panel = 'primarySidebarVisible' | 'secondaryPanelVisible' | 'bottomPanelVisible';
export type Action = { type: 'activity'; value: Activity } | { type: 'toggle'; panel: Panel } | { type: 'tab'; value: BottomTab } | { type: 'resize'; dimension: 'bottomHeight' | 'secondaryWidth'; value: number } | { type: 'hydrate'; value: WorkspaceState };
export function workspaceReducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'activity': return { ...state, activeActivity: action.value, primarySidebarVisible: true };
    case 'toggle': return { ...state, [action.panel]: !state[action.panel] };
    case 'tab': return { ...state, activeBottomPanelTab: action.value, bottomPanelVisible: true };
    case 'resize': return { ...state, [action.dimension]: Math.round(Math.max(action.dimension === 'bottomHeight' ? 120 : 220, Math.min(action.dimension === 'bottomHeight' ? 360 : 420, action.value))) };
    case 'hydrate': return action.value;
  }
}
export interface LayoutStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const layoutKey = (id: string) => `tastedev.studio.workspace.v1:${encodeURIComponent(id)}`;
export function readLayout(storage: LayoutStorage, id: string): WorkspaceState {
  const raw = storage.getItem(layoutKey(id));
  if (!raw) return { ...initialState };
  const parsed = JSON.parse(raw);
  const s = parsed.state;
  if (parsed.version !== 1 || !s || !activityIds.includes(s.activeActivity) || !bottomTabs.includes(s.activeBottomPanelTab) ||
      !['primarySidebarVisible', 'secondaryPanelVisible', 'bottomPanelVisible'].every(k => typeof s[k] === 'boolean') ||
      !Number.isFinite(s.bottomHeight) || s.bottomHeight < 120 || s.bottomHeight > 360 || !Number.isFinite(s.secondaryWidth) || s.secondaryWidth < 220 || s.secondaryWidth > 420) throw new Error('Saved layout could not be read. Using a temporary layout; the saved data is unchanged.');
  return { activeActivity: s.activeActivity, primarySidebarVisible: s.primarySidebarVisible, secondaryPanelVisible: s.secondaryPanelVisible, bottomPanelVisible: s.bottomPanelVisible, activeBottomPanelTab: s.activeBottomPanelTab, bottomHeight: s.bottomHeight, secondaryWidth: s.secondaryWidth };
}
export function saveLayout(storage: LayoutStorage, id: string, state: WorkspaceState) { storage.setItem(layoutKey(id), JSON.stringify({ version: 1, state })); }
export const shortcuts: { key: string; panel: Panel; label: string }[] = [
  { key: 'b', panel: 'primarySidebarVisible', label: 'Primary sidebar' },
  { key: 'j', panel: 'bottomPanelVisible', label: 'Bottom panel' },
  { key: 'a', panel: 'secondaryPanelVisible', label: 'Secondary panel' },
];

