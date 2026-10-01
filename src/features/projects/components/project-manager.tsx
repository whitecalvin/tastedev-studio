"use client";
import { useI18n } from '@/i18n/react';
import { RuntimeNote } from '@/features/runtime/label';
import { projectHref } from '@/features/runtime/hosts';


import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@heroui/react";
import { ArrowDownToLine, ArrowUpRight, Clock3, FolderOpen, FolderPlus, GitBranch, Plus, Search, X } from "lucide-react";
import { useProjects } from "../hooks/use-projects";
import { projectService } from "../services/browser-services";
import { browserFileHost } from "@/features/filesystem/browser";
import { fileMessage, openFolderProject } from "@/features/filesystem/file-service";
import { ProjectForm } from "./project-form";

export function ProjectManager() {
  const { t, locale, feedback } = useI18n();

  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const { projects, loading, error, refresh } = useProjects();
  const [form, setForm] = useState<"new" | "clone" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const visible = projects.filter((p) => `${p.name} ${p.workspacePath}`.toLowerCase().includes(query.toLowerCase()));
  const open = async () => {
    if (opening) return;
    setNotice('Waiting for folder selection…');
    setOpening(true);
    try { const project = await openFolderProject(browserFileHost, projectService, (name) => setNotice(`Folder received: ${name}. Connecting workspace…`)); setNotice(`Opening ${project.name}…`); router.push(projectHref(project.id)); }
    catch (error) { setNotice(fileMessage(error)); }
    finally { setOpening(false); }
  };
  return <>
    <div className="page-heading"><div><h1>{t("Projects")}</h1><p>{t("Your starting point. Pick up where you left off.")}</p></div><Button onPress={() => setForm("new")}><Plus size={17} aria-hidden="true" />{t("New Project")}</Button></div>
    {notice && <div className="message dismissible" role="status"><span>{feedback(notice || "")}</span><Button variant="ghost" isIconOnly aria-label={t("Dismiss notification")} onPress={() => setNotice(null)}><X size={16} /></Button></div>}
    <div className="manager-grid">
      <section className="recent-section" aria-labelledby="recent-heading">
        <div className="section-heading"><h2 id="recent-heading">{t("Recent Projects")} <span className="count">{projects.length}</span></h2>
          {projects.length > 0 && <label className="studio-search-field"><Search size={16} aria-hidden="true" /><span className="sr-only">{t("Search projects")}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Find a project…")} /></label>}
        </div>
        {loading ? <div className="empty-state" role="status">{t("Loading your projects…")}</div> : error ? <div className="empty-state"><h3>{t("Projects couldn’t be loaded")}</h3><p role="alert">{t(error || "")}</p><Button variant="secondary" onPress={() => void refresh()}>{t("Retry")}</Button></div> : projects.length === 0 ? <div className="empty-state">
          <div className="empty-icon"><FolderOpen size={36} strokeWidth={1.4} aria-hidden="true" /></div><h3>{t("No projects yet")}</h3><p>{t("Create a new project, open an existing project,")}<br className="desktop-break" /> {t("or clone a Git repository to get started.")}</p>
          <Button variant="secondary" onPress={() => setForm("new")}><Plus size={16} aria-hidden="true" />{t("New Project")}</Button>
          <span className="empty-footnote">{t("A workspace starts with a project.")}</span>
        </div> : visible.length === 0 ? <div className="empty-state"><Search size={28} aria-hidden="true" /><h3>{t("No matching projects")}</h3><p>{t("Try a different name or workspace path.")}</p><Button variant="secondary" onPress={() => setQuery("")}>{t("Clear search")}</Button></div> : <ul className="project-list">
          {visible.map((project) => <li key={project.id}><Link className="project-row" href={projectHref(project.id)}>
            <div className="project-icon"><FolderOpen size={22} aria-hidden="true" /></div><div className="project-details"><h3>{project.name}</h3><p className="path">{project.workspacePath ?? t("Browser folder · absolute path unavailable")}</p><div className="project-meta">
              {project.framework && <span>{project.framework}</span>}{project.defaultBranch && <span><GitBranch size={13} aria-hidden="true" />{project.defaultBranch}</span>}{project.repositoryUrl && <span className="repository">{project.repositoryUrl}</span>}
              <span><Clock3 size={13} aria-hidden="true" />{project.lastOpenedAt ? t("Opened {date}", {date:new Date(project.lastOpenedAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}) : t("Not opened yet")}</span>
            </div></div><ArrowUpRight size={18} className="row-arrow" aria-hidden="true" />
          </Link></li>)}
        </ul>}
      </section>
      <aside className="start-panel" aria-labelledby="start-heading"><h2 id="start-heading">{t("Start a project")}</h2>
        <button className="start-action" onClick={() => setForm("new")}><FolderPlus size={20} aria-hidden="true" /><span><strong>{t("New Project")}</strong><small>{t("Register a workspace")}</small></span><Plus size={16} aria-hidden="true" /></button>
        <button className="start-action" disabled={opening} onClick={() => void open()}><FolderOpen size={20} aria-hidden="true" /><span><strong>{opening ? t("Opening folder…") : t("Open Project")}</strong><small>{t("Connect a local folder")}</small></span><ArrowUpRight size={16} aria-hidden="true" /></button>
        <button className="start-action" onClick={() => setForm("clone")}><ArrowDownToLine size={20} aria-hidden="true" /><span><strong>{t("Clone Repository")}</strong><small>{t("Start from a Git repository")}</small></span><ArrowUpRight size={16} aria-hidden="true" /></button>
        <RuntimeNote />
      </aside>
    </div>
    {form && <ProjectForm mode={form} onClose={() => setForm(null)} onCreated={async () => { await refresh(); setNotice(t('Project ready. Open it from Recent Projects.')); }} />}
  </>;
}


