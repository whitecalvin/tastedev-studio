"use client";
import { useI18n, LanguageControl } from '@/i18n/react';
import { AIStateProvider, AISidebar, AIPanel, AIProposalArea, useAI } from '../ai/views';
import {ScheduleProvider,ScheduleSidebar,ScheduleDetail} from '../scheduler/views';
import { IssuesProvider, IssuesSidebar, IssueDetail } from '../issues/views';
import { RuntimeLabel } from '@/features/runtime/label';
import { UpdateButton } from '@/features/update/views';
import { AnnouncementsButton, AnnouncementSettings } from '@/features/announcements/views';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Files, Search, GitBranch, Play, FlaskConical, Bot, CircleDot, Sparkles, Settings, PanelLeft, PanelRight, PanelBottom, X, ArrowLeft, Boxes, ListOrdered, History } from 'lucide-react';
import { ThemeControl } from '@/components/ui/theme';
import { AppShell } from '@/components/ui/app-shell';
import { projectService } from '@/features/projects/services/browser-services';
import type { Project } from '@/features/projects/types/project';
import { WorkspaceProvider, useWorkspace } from './context';
import { FileSessionProvider, ConnectionStatus, FileFeedback, useFiles } from '../editor/session';
import { Explorer } from '../filesystem/explorer';
import { GitProvider, useGit } from '../git/context';
import { SourceControlView, GitEditorArea, GitStatus } from '../git/views';
import { gitDecoration, statusLetters } from '../git/service';
import { RunProvider } from '../process/context';
import { RunView, RunStatus, TerminalView, OutputView } from '../process/views';
import { CoreProvider } from '../core/context';
import { CoreSidebar, CoreDetail } from '../core/views';
import { ProtocolProvider, ProtocolStatus, ProtocolView } from '../protocol/views';
import { bottomTabs, shortcuts, type Activity, type Panel } from './state';

export const activities = [
  { id: 'explorer', label: 'Explorer', icon: Files }, { id: 'search', label: 'Search', icon: Search },
  { id: 'source-control', label: 'Source Control', icon: GitBranch }, { id: 'run', label: 'Run', icon: Play },
  { id: 'tests', label: 'Tests', icon: FlaskConical }, { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'queue', label: 'Queue', icon: ListOrdered }, { id: 'runs', label: 'Runs', icon: History },
  { id: 'issues', label: 'Issues', icon: CircleDot }, { id: 'ai', label: 'AI', icon: Sparkles },
  {id:'scheduler',label:'Scheduler',icon:History}, { id: 'settings', label: 'Settings', icon: Settings },
] satisfies { id: Activity; label: string; icon: typeof Files }[];

export function WorkspaceProject({ projectId }: { projectId: string }) {
  const { t } = useI18n();

  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    projectService.open(projectId).then(value => { if (active) { setProject(value); setError(''); } }, error => { if (active) setError(error instanceof Error ? error.message : 'This project could not be opened.'); });
    return () => { active = false; };
  }, [projectId, attempt]);
  if (error || !project) return <AppShell><Link href="/" className="back-link"><ArrowLeft size={16} />{t("All projects")}</Link>{error ? <section className="overview-empty"><h1>{t("Project unavailable")}</h1><p role="alert">{t(error || "")}</p><button className="button" onClick={() => setAttempt(n => n + 1)}>{t("Retry")}</button></section> : <p role="status">{t("Opening project…")}</p>}</AppShell>;
  return <WorkspaceProvider key={project.id} projectId={project.id}><FileSessionProvider projectId={project.id}><GitProvider projectId={project.id} workspacePath={project.workspacePath}><RunProvider projectId={project.id}><CoreProvider project={project}><WorkspaceShell project={project} /></CoreProvider></RunProvider></GitProvider></FileSessionProvider></WorkspaceProvider>;
}

function PanelToggle({ panel, label, children }: { panel: Panel; label: string; children: React.ReactNode }) {
 const { t } = useI18n();
  const { state, dispatch } = useWorkspace();
  const shortcut = shortcuts.find(item => item.panel === panel)!;
  return <button id={`toggle-${panel}`} className="ws-icon-button" title={`${label} (Ctrl+Alt+${shortcut.key.toUpperCase()})`} aria-label={t("Toggle {label}", {label})} aria-keyshortcuts={`Control+Alt+${shortcut.key.toUpperCase()}`} aria-expanded={state[panel]} aria-controls={panel} onClick={() => dispatch({ type: 'toggle', panel })}>{children}</button>;
}
function ClosePanel({ panel, label }: { panel: Panel; label: string }) {
 const { t } = useI18n();
  const { dispatch } = useWorkspace();
  return <button className="ws-icon-button" aria-label={t("Hide {label}", {label})} onClick={() => { document.getElementById(`toggle-${panel}`)?.focus(); dispatch({ type: 'toggle', panel }); }}><X size={15} /></button>;
}
export function TitleBar({ project }: { project: Project }) {
  const { t } = useI18n();

  const { state } = useWorkspace();
  return <header className="ws-titlebar"><Link href="/" className="ws-brand" title={t("Return to Project Manager")}><Boxes size={18} /><span>TASTESTUDIO</span></Link><span className="ws-divider" /><strong className="ws-project-name" title={project.name}>{project.name}</strong><span className="ws-breadcrumb">/ {t(activities.find(item => item.id === state.activeActivity)?.label ?? "")}</span><span className="ws-metadata"><ConnectionStatus /></span><div className="ws-title-actions"><AnnouncementsButton /><LanguageControl /><ThemeControl /><PanelToggle panel="primarySidebarVisible" label={t("Primary sidebar")}><PanelLeft size={17} /></PanelToggle><PanelToggle panel="bottomPanelVisible" label={t("Bottom panel")}><PanelBottom size={17} /></PanelToggle><PanelToggle panel="secondaryPanelVisible" label={t("Secondary panel")}><PanelRight size={17} /></PanelToggle><Link href="/" className="ws-manager-link"><ArrowLeft size={14} />{t("Projects")}</Link></div></header>;
}
export function ActivityBar() {
  const { t } = useI18n();

  const { state, dispatch } = useWorkspace();
  return <nav className="ws-activity" aria-label={t("Workspace activities")}>{activities.map(({ id, label, icon: Icon }) => <button key={id} className={`ws-activity-button ${id === 'settings' ? 'ws-settings-button' : ''}`} aria-label={t(label)} title={t(label)} aria-pressed={state.activeActivity === id} onClick={() => dispatch({ type: 'activity', value: id })}><Icon size={21} strokeWidth={1.6} /></button>)}</nav>;
}
function ViewMessage({ title, children }: { title: string; children: React.ReactNode }) { return <div className="ws-view-message"><h3>{title}</h3>{children}</div>; }

function SearchView() {
  const { t } = useI18n();
 return <ViewMessage title={t("Search this workspace")}><p>{t("File content search will be available after filesystem integration.")}</p><p>{t("No files have been indexed.")}</p></ViewMessage>; }

function SettingsView() {
  const { t } = useI18n();
 return <ViewMessage title={t("Appearance & layout")}><LanguageControl /><ThemeControl /><UpdateButton /><AnnouncementSettings /><p>{t("Theme is shared across the application. Layout is saved separately for each project in this browser.")}</p><dl className="ws-shortcuts">{shortcuts.map(item => <div key={item.key}><dt>{t(item.label)}</dt><dd><kbd>Ctrl + Alt + {item.key.toUpperCase()}</kbd></dd></div>)}</dl></ViewMessage>; }
export function PrimarySidebar() {
  const { t } = useI18n();

  const { state } = useWorkspace();
  const { state: git, service } = useGit();
  const views: Record<Activity, React.ReactNode> = { explorer: <Explorer decoration={path => { const kind = service.host.capabilities.git && git.fresh ? gitDecoration(git.files, path) : null; return kind ? { label: kind, text: statusLetters[kind] } : null; }} />, search: <SearchView />, 'source-control': <SourceControlView />, run: <><ProtocolView /><RunView /></>, tests: <ProtocolView tests />, agents: <CoreSidebar activity="agents" />, queue: <CoreSidebar activity="queue" />, runs: <CoreSidebar activity="runs" />, scheduler:<ScheduleSidebar />, issues: <IssuesSidebar />, ai: <AISidebar />, settings: <SettingsView /> };
  return <aside id="primarySidebarVisible" className="ws-primary" hidden={!state.primarySidebarVisible} aria-label={t("Primary sidebar")}><div className="ws-panel-heading"><h2>{t(activities.find(item => item.id === state.activeActivity)?.label ?? '')}</h2><ClosePanel panel="primarySidebarVisible" label={t("primary sidebar")} /></div><div className="ws-sidebar-body">{views[state.activeActivity]}</div></aside>;
}
function ResizeHandle({ dimension }: { dimension: 'bottomHeight' | 'secondaryWidth' }) {
  const { t } = useI18n();

  const { state, dispatch } = useWorkspace();
  const drag = useRef<{ start: number; size: number } | null>(null);
  const horizontal = dimension === 'bottomHeight';
  const minimum = horizontal ? 120 : 220, maximum = horizontal ? 360 : 420;
  return <div className={`ws-resizer ${horizontal ? 'ws-resizer-horizontal' : 'ws-resizer-vertical'}`} role="separator" tabIndex={0} aria-label={horizontal ? t("Resize bottom panel") : t("Resize secondary panel")} aria-orientation={horizontal ? 'horizontal' : 'vertical'} aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={state[dimension]} onKeyDown={event => {
    const changes: Record<string, number> = horizontal ? { ArrowUp: 20, ArrowDown: -20 } : { ArrowLeft: 20, ArrowRight: -20 };
    if (event.key === 'Home' || event.key === 'End' || event.key in changes) { event.preventDefault(); dispatch({ type: 'resize', dimension, value: event.key === 'Home' ? minimum : event.key === 'End' ? maximum : state[dimension] + changes[event.key] }); }
  }} onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { start: horizontal ? event.clientY : event.clientX, size: state[dimension] }; }} onPointerMove={event => { if (drag.current) dispatch({ type: 'resize', dimension, value: drag.current.size + drag.current.start - (horizontal ? event.clientY : event.clientX) }); }} onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onLostPointerCapture={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />;
}
export function SecondaryPanel() {
  const { t } = useI18n();
 const { state } = useWorkspace(); return <aside id="secondaryPanelVisible" className="ws-secondary" hidden={!state.secondaryPanelVisible} aria-label={t("Secondary panel")}><ResizeHandle dimension="secondaryWidth" /><div className="ws-panel-heading"><h2><Sparkles size={14} />AI</h2><ClosePanel panel="secondaryPanelVisible" label={t("secondary panel")} /></div><AIPanel /></aside>; }
const bottomMessages = { Terminal: 'Terminal sessions are not connected. Command execution arrives in STEP 4.', Output: 'No output provider is connected. Task output will appear here.', Problems: 'Diagnostics are not connected. No analysis has been run.', Tests: 'No test provider is connected. No tests have been run.', Agent: 'Agent integration is not connected. No agent sessions have started.', Logs: 'Workspace log collection is not connected.' };
export function BottomPanel() {
  const { t } = useI18n();

  const { state, dispatch } = useWorkspace();
  return <section id="bottomPanelVisible" className="ws-bottom" hidden={!state.bottomPanelVisible} aria-label={t("Bottom panel")}><ResizeHandle dimension="bottomHeight" /><div className="ws-bottom-heading"><div role="tablist" aria-label={t("Bottom panel tabs")}>{bottomTabs.map((tab, index) => <button key={tab} id={`ws-tab-${tab}`} role="tab" aria-selected={tab === state.activeBottomPanelTab} aria-controls={`ws-content-${tab}`} tabIndex={tab === state.activeBottomPanelTab ? 0 : -1} onClick={() => dispatch({ type: 'tab', value: tab })} onKeyDown={event => {
    const next = event.key === 'ArrowRight' ? (index + 1) % bottomTabs.length : event.key === 'ArrowLeft' ? (index + bottomTabs.length - 1) % bottomTabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? bottomTabs.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); dispatch({ type: 'tab', value: bottomTabs[next] }); document.getElementById(`ws-tab-${bottomTabs[next]}`)?.focus(); }
  }}>{t(tab)}</button>)}</div><ClosePanel panel="bottomPanelVisible" label={t("bottom panel")} /></div>{bottomTabs.map(tab => <div key={tab} role="tabpanel" id={`ws-content-${tab}`} aria-labelledby={`ws-tab-${tab}`} hidden={tab !== state.activeBottomPanelTab} tabIndex={0} className="ws-bottom-content">{tab === 'Terminal' ? <TerminalView /> : tab === 'Output' ? <OutputView /> : <p>{t(bottomMessages[tab])}</p>}</div>)}</section>;
}
export function StatusBar({ project }: { project: Project }) {
  const { t } = useI18n();
 const { connection, editor } = useFiles(); const active = editor.openEditors.find(d => d.id === editor.activeEditorId); return <footer className="ws-status"><span><RuntimeLabel /></span><span className="ws-status-path" title={connection?.workspacePath ?? project.workspacePath ?? undefined}>{connection?.name ?? project.workspacePath ?? t("No folder connected")}</span><span><ConnectionStatus /></span><span>{active?.language ?? t("No open file")}</span><span>{editor.dirtyEditors.length} {t("unsaved")}</span><ProtocolStatus /><RunStatus /><GitStatus /></footer>; }
export function WorkspaceShell({ project }: { project: Project }) { return <ProtocolProvider><AIStateProvider><IssuesProvider><ScheduleProvider><WorkspaceContent project={project} /></ScheduleProvider></IssuesProvider></AIStateProvider></ProtocolProvider>; }
function WorkspaceContent({ project }: { project: Project }) {
  const { t } = useI18n();
 const ai=useAI(); const { state } = useWorkspace(); const coreActive = ['agents','queue','runs'].includes(state.activeActivity),issuesActive=state.activeActivity==='issues',schedulerActive=state.activeActivity==='scheduler'; return <div className="ws-shell" style={{ '--ws-bottom-height': `${state.bottomHeight}px`, '--ws-secondary-width': `${state.secondaryWidth}px` } as CSSProperties}><a href="#main-content" className="skip-link">{t("Skip to editor")}</a><TitleBar project={project} /><FileFeedback /><div className="ws-main"><ActivityBar /><PrimarySidebar /><div className="ws-editor-host" hidden={coreActive||issuesActive||schedulerActive||!!ai.proposal}><GitEditorArea /></div>{!ai.proposal&&coreActive && <CoreDetail activity={state.activeActivity} />}{!ai.proposal&&issuesActive&&<IssueDetail />}{!ai.proposal&&schedulerActive&&<ScheduleDetail />}<AIProposalArea /><SecondaryPanel /></div><BottomPanel /><StatusBar project={project} /></div>; }





