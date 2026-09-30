import { ProjectError, type Project } from "../types/project.ts";
import { workspaceKey } from "../utils/validation.ts";

export interface ProjectRepository {
  list(): Promise<Project[]>;
  save(project: Project): Promise<void>;
}

export interface MetadataStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PROJECT_STORAGE_KEY = "tastedev.studio.projects.v1";
const nullableFields = ["repositoryUrl", "defaultBranch", "framework", "runtime", "packageManager", "projectType"] as const;
const isDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === "string" && !!p.id && typeof p.name === "string" && !!p.name.trim()
    && typeof p.description === "string" && ((typeof p.workspacePath === "string" && !!p.workspacePath) || (p.workspacePath === null && p.browserFolder === true))
    && nullableFields.every((field) => p[field] === null || typeof p[field] === "string")
    && (p.gitEnabled === null || typeof p.gitEnabled === "boolean")
    && isDate(p.createdAt) && isDate(p.updatedAt) && (p.lastOpenedAt === null || isDate(p.lastOpenedAt));
}

export class LocalProjectRepository implements ProjectRepository {
  private readonly storage: () => MetadataStorage;
  constructor(storage: () => MetadataStorage) { this.storage = storage; }

  async list(): Promise<Project[]> {
    let raw: string | null;
    try { raw = this.storage().getItem(PROJECT_STORAGE_KEY); }
    catch { throw new ProjectError("Browser storage is unavailable. Allow site storage, then retry."); }
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !("version" in parsed) || parsed.version !== 1 || !("projects" in parsed) || !Array.isArray(parsed.projects) || !parsed.projects.every(isProject)) throw new Error();
      const projects = parsed.projects as Project[];
      const paths = projects.filter(p => p.workspacePath !== null).map((p) => workspaceKey(p.workspacePath!));
      if (new Set(paths).size !== paths.length || new Set(projects.map((p) => p.id)).size !== projects.length) throw new Error();
      return projects;
    } catch {
      throw new ProjectError("Saved project data could not be read. Your data has not been changed. Restore valid site data, then retry.");
    }
  }

  async save(project: Project): Promise<void> {
    if (!isProject(project)) throw new ProjectError("Invalid project metadata cannot be saved.");
    const projects = await this.list();
    if (project.workspacePath && projects.some((p) => p.id !== project.id && p.workspacePath && workspaceKey(p.workspacePath) === workspaceKey(project.workspacePath!))) {
      throw new ProjectError("This workspace is already in Recent Projects.");
    }
    const index = projects.findIndex((p) => p.id === project.id);
    if (index < 0) projects.push(project); else projects[index] = project;
    try { this.storage().setItem(PROJECT_STORAGE_KEY, JSON.stringify({ version: 1, projects })); }
    catch { throw new ProjectError("Projects could not be saved. Browser storage may be full or blocked. Free space or allow site storage, then retry."); }
  }
}
