"use client";
import { useI18n } from '@/i18n/react';

import { useState } from "react";
import { Button } from "@heroui/react";
import { Dialog } from "@/components/ui/dialog";
import { projectService, projectFileSystem } from "../services/browser-services";
import { assertUniqueProject, validateClone, validateNewProject } from "../utils/validation";
import type { FolderConnection } from '@/features/filesystem/contracts';
import { fileMessage } from '@/features/filesystem/file-service';
import { prepareProject, cancelProject, type ProjectTemplate } from '../services/bootstrap';
import { nativeBridge } from '@/features/runtime/native-hosts';
import { detectRuntime } from '@/features/runtime/hosts';

export function ProjectForm({ mode, onClose, onCreated }: { mode: "new" | "clone"; onClose: () => void; onCreated: (name: string) => Promise<void> }) {
  const { t } = useI18n();

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [workspacePath, setWorkspacePath] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<FolderConnection | null>(null);
  const [creation, setCreation] = useState<'register' | 'create'>('register');
  const [template, setTemplate] = useState<ProjectTemplate>('node-smoke');
  const [operation, setOperation] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<{node: string | null; git: string | null} | null>(null);
  const chooseFolder = async () => {
    if (busy) return;
    setError(null); setBusy(true);
    try {
      const folder = await projectFileSystem.selectDirectory();
      if (creation === 'create' || mode === 'clone') {
        if (!folder.workspacePath) throw Error('Project creation and Git Clone require the desktop app.');
        setSelectedFolder(null); setWorkspacePath(folder.workspacePath.replace(/[\\/]$/, '') + (mode === 'clone' ? '/cloned-project' : '/new-project'));
      } else { setSelectedFolder(folder); setWorkspacePath(folder.workspacePath ?? folder.name); }
    } catch (error) { setError(fileMessage(error)); }
    finally { setBusy(false); }
  };
  return <Dialog title={mode === "new" ? t("New Project") : t("Clone Repository")} onClose={() => { if (!busy) onClose(); }}>
    <p className="dialog-description">{t(mode === 'clone' ? 'Clone into a new folder. Existing folders are never replaced. HTTPS repositories only.' : creation === 'create' ? 'Create a new folder and the selected template. Existing folders are never replaced.' : 'Register a project in this browser. This saves metadata; it does not create folders or source files.')}</p>
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      const data = new FormData(event.currentTarget);
      const value = (key: string) => String(data.get(key) ?? "");
      setError(null); setNotice(null); setBusy(true);
      try {
        if (mode === 'clone' || creation === 'create') {
          const repository = value('repositoryUrl');
          if (mode === 'clone') validateClone({ repositoryUrl: repository, workspacePath: value('workspacePath'), branch: value('branch') });
          const name = mode === 'clone' ? repository.split('/').filter(Boolean).pop()!.replace(/\.git$/, '') : value('name');
          const input = validateNewProject({ name, workspacePath: value('workspacePath'), description: value('description') });
          // Check metadata before creating any source files.
          const existing = await projectService.list();
          assertUniqueProject(existing, input);
          const id = crypto.randomUUID(); setOperation(id);
          const folder = await prepareProject({ id, operation: mode === 'clone' ? 'clone' : 'create', target: input.workspacePath, name: input.name, template, repository, branch: value('branch') });
          const project = await projectService.create({ ...input, workspacePath: folder.workspacePath! });
          if (mode === 'clone') await projectService.setRepository(project.id, repository, value('branch') || null);
          await projectFileSystem.bind(project.id, folder.id);
          await onCreated(project.name); onClose();
        } else if (mode === "new") {
          const input = { name: value("name"), workspacePath: value("workspacePath"), description: value("description") };
          if (selectedFolder) for (const existing of await projectService.list()) {
            if (await projectFileSystem.sameDirectory(selectedFolder.id, existing.id)) throw Error('This workspace is already in Recent Projects. Open the existing project instead.');
          }
          const valid = validateNewProject({ ...input, workspacePath: selectedFolder && !selectedFolder.workspacePath ? '/' : input.workspacePath });
          const project = selectedFolder && !selectedFolder.workspacePath
            ? await projectService.registerBrowserFolder(valid.name, valid.description)
            : await projectService.create(input);
          if (selectedFolder) await projectFileSystem.bind(project.id, selectedFolder.id);
          await onCreated(project.name);
          onClose();
        }
      } catch (error) { setError(error instanceof Error ? error.message : "The project could not be saved. Please retry."); }
      finally { setBusy(false); setOperation(null); }
    }}>
      <div className="form-fields">
        {mode === 'new' && <label>{t('Project setup')}<select disabled={busy} value={creation} onChange={event => { setCreation(event.target.value as 'register' | 'create'); setSelectedFolder(null); setWorkspacePath(''); }}><option value="register">{t('Register existing folder')}</option><option value="create">{t('Create new folder')}</option></select></label>}
        {mode === 'new' && creation === 'create' && <label>{t('Template')}<select value={template} disabled={busy} onChange={event => setTemplate(event.target.value as ProjectTemplate)}><option value="node-smoke">{t('Node starter with smoke test')}</option><option value="empty">{t('Empty folder')}</option></select></label>}
        {mode === "new" ? <label>{t("Project name")} <span className="required-note">{t("Required")}</span><input name="name" required maxLength={120} autoComplete="off" placeholder={t("My project")} /></label> : <label>{t("Repository URL")} <span className="required-note">{t("Required")}</span><input name="repositoryUrl" required autoComplete="off" placeholder="https://github.com/owner/repository.git" /></label>}
        <div><label htmlFor="new-project-path">{mode === "new" ? t("Workspace path") : t("Target workspace")} <span className="required-note">{t("Required")}</span></label><div className="project-folder-input"><input id="new-project-path" name="workspacePath" required maxLength={4096} autoComplete="off" spellCheck={false} placeholder="C:\Projects\my-project" aria-describedby="path-help" value={workspacePath} disabled={busy} onChange={event => { setWorkspacePath(event.target.value); setSelectedFolder(null); }} /><Button type="button" variant="secondary" isDisabled={busy} onPress={() => void chooseFolder()}>{t(mode === 'clone' || creation === 'create' ? 'Choose parent folder' : 'Choose folder')}</Button></div><small id="path-help">{t(selectedFolder && !selectedFolder.workspacePath ? 'Browser folder · absolute path unavailable' : 'Use an absolute Windows, macOS, or Linux path. Folder existence is not checked in the browser.')}</small></div>
        {mode === "new" ? <label>{t("Description")} <span className="optional-note">{t("Optional")}</span><textarea name="description" rows={3} maxLength={2000} placeholder={t("What are you working on?")} /></label> : <label>{t("Branch")} <span className="optional-note">{t("Optional")}</span><input name="branch" autoComplete="off" placeholder={t("Use repository default")} /></label>}
      </div>
      {(creation === 'create' || mode === 'clone') && <div className="message"><Button type="button" variant="ghost" isDisabled={busy} onPress={async () => { setError(null); if (detectRuntime() !== 'desktop') { setNotice('Project creation and Git Clone require the desktop app.'); return; } setBusy(true); try { setEnvironment(await nativeBridge.invoke('project_environment')); } catch (error) { setError(fileMessage(error)); } finally { setBusy(false); } }}>{t('Check local tools')}</Button>{environment && <p>Node: {environment.node ?? t('Unavailable')} · Git: {environment.git ?? t('Unavailable')}</p>}{creation === 'create' && template === 'node-smoke' && <p>{t('Next: open the project, connect Core and an Agent, then run the smoke test in Tests.')}</p>}</div>}
      {error && <p className="message error" role="alert">{t(error || "")}</p>}
      {notice && <p className="message" role="status">{t(notice || "")}</p>}
      <div className="dialog-actions"><Button type="button" variant="ghost" isDisabled={busy && !operation} onPress={() => { if (operation) void cancelProject(operation).catch(error => setError(fileMessage(error))); else onClose(); }}>{t("Cancel")}</Button><Button type="submit" isPending={busy} isDisabled={busy}>{mode === "new" ? t("Create Project") : t("Clone Repository")}</Button></div>
    </form>
  </Dialog>;
}
