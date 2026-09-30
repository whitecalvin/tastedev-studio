import test from 'node:test';
import assert from 'node:assert/strict';
import { activityIds, bottomTabs, emptyEditors, initialState, layoutKey, readLayout, saveLayout, workspaceReducer } from '../src/features/workspace/state.ts';
class Storage { data = new Map<string, string>(); getItem(key: string) { return this.data.get(key) ?? null; } setItem(key: string, value: string) { this.data.set(key, value); } }
test('all activities switch independently and reopen the primary sidebar', () => {
  for (const value of activityIds) { const state = workspaceReducer({ ...initialState, primarySidebarVisible: false }, { type: 'activity', value }); assert.equal(state.activeActivity, value); assert.equal(state.primarySidebarVisible, true); assert.equal(state.activeBottomPanelTab, 'Terminal'); }
});
test('each panel toggles without changing other preferences', () => {
  for (const panel of ['primarySidebarVisible', 'secondaryPanelVisible', 'bottomPanelVisible'] as const) { const hidden = workspaceReducer(initialState, { type: 'toggle', panel }); assert.equal(hidden[panel], false); assert.deepEqual(workspaceReducer(hidden, { type: 'toggle', panel }), initialState); }
});
test('bottom tab selection opens its panel and retains activity', () => {
  for (const value of bottomTabs) { const state = workspaceReducer({ ...initialState, bottomPanelVisible: false }, { type: 'tab', value }); assert.equal(state.activeBottomPanelTab, value); assert.equal(state.bottomPanelVisible, true); assert.equal(state.activeActivity, 'explorer'); }
});
test('resize clamps panel dimensions to editor-preserving limits', () => {
  assert.equal(workspaceReducer(initialState, { type: 'resize', dimension: 'bottomHeight', value: 0 }).bottomHeight, 120);
  assert.equal(workspaceReducer(initialState, { type: 'resize', dimension: 'bottomHeight', value: 999 }).bottomHeight, 360);
  assert.equal(workspaceReducer(initialState, { type: 'resize', dimension: 'secondaryWidth', value: 0 }).secondaryWidth, 220);
  assert.equal(workspaceReducer(initialState, { type: 'resize', dimension: 'secondaryWidth', value: 999 }).secondaryWidth, 420);
});
test('layout round-trips per project with no editor or theme data', () => {
  const storage = new Storage(); const changed = workspaceReducer(initialState, { type: 'activity', value: 'search' });
  saveLayout(storage, 'one', changed); saveLayout(storage, 'two', initialState);
  assert.deepEqual(readLayout(storage, 'one'), changed); assert.deepEqual(readLayout(storage, 'two'), initialState); assert.deepEqual(readLayout(storage, 'new'), initialState);
  assert.equal(storage.data.size, 2); assert.deepEqual(emptyEditors, { openEditors: [], activeEditorId: null, dirtyEditors: [] });
});
test('invalid and future layouts fail without overwriting saved data', () => {
  const storage = new Storage();
  for (const raw of ['{', JSON.stringify({ version: 2, state: initialState }), JSON.stringify({ version: 1, state: { ...initialState, activeActivity: 'bad' } }), JSON.stringify({ version: 1, state: { ...initialState, bottomHeight: -1 } })]) {
    storage.setItem(layoutKey('one'), raw); assert.throws(() => readLayout(storage, 'one')); assert.equal(storage.getItem(layoutKey('one')), raw);
  }
});
test('unavailable layout storage and quota errors propagate for a visible fallback', () => {
  const storage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.throws(() => readLayout(storage, 'one'), /denied/); assert.throws(() => saveLayout(storage, 'one', initialState), /quota/);
});
