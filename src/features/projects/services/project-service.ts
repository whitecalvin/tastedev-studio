import { ProjectError, type NewProjectInput, type Project } from "../types/project.ts";
import { assertUniqueProject, validateNewProject } from "../utils/validation.ts";
import type { ProjectRepository } from "./project-repository.ts";

export interface ProjectServiceOptions {
  now?: () => string;
  id?: () => string;
  exclusive?: <T>(operation: () => Promise<T>) => Promise<T>;
}

export class ProjectService {
  private readonly repository: ProjectRepository;
  private readonly options: ProjectServiceOptions;
  constructor(repository: ProjectRepository, options: ProjectServiceOptions = {}) {
    this.repository = repository;
    this.options = options;
  }
  async list(): Promise<Project[]> {
    return (await this.repository.list()).sort((a, b) =>
      (b.lastOpenedAt ?? b.createdAt).localeCompare(a.lastOpenedAt ?? a.createdAt));
  }
  async get(id: string): Promise<Project | null> {
    return (await this.repository.list()).find((p) => p.id === id) ?? null;
  }
  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    return this.options.exclusive ? this.options.exclusive(operation) : operation();
  }
  async create(input: NewProjectInput): Promise<Project> {
    const valid = validateNewProject(input);
    return this.exclusive(async () => {
      assertUniqueProject(await this.repository.list(), valid);
      const now = this.options.now?.() ?? new Date().toISOString();
      const project: Project = {
        ...valid, id: this.options.id?.() ?? crypto.randomUUID(),
        repositoryUrl: null, defaultBranch: null, framework: null, runtime: null,
        packageManager: null, projectType: null, gitEnabled: null,
        createdAt: now, updatedAt: now, lastOpenedAt: null,
      };
      await this.repository.save(project);
      return project;
    });
  }
  async open(id: string): Promise<Project> {
    return this.exclusive(async () => {
      const project = await this.get(id);
      if (!project) throw new ProjectError("This project is not in this browser’s Recent Projects.");
      const now = this.options.now?.() ?? new Date().toISOString();
      const updated = { ...project, lastOpenedAt: now, updatedAt: now };
      await this.repository.save(updated);
      return updated;
    });
  }
  async attachWorkspace(id: string, workspacePath: string): Promise<void> {
    return this.exclusive(async () => {
      const project = await this.get(id); if (!project) throw new ProjectError('Project not found.');
      const valid = validateNewProject({ name: project.name, description: project.description, workspacePath });
      assertUniqueProject((await this.repository.list()).filter(item => item.id !== id), valid);
      await this.repository.save({ ...project, workspacePath: valid.workspacePath, browserFolder: false, updatedAt: this.options.now?.() ?? new Date().toISOString() });
    });
  }  async registerBrowserFolder(name: string, description = ''): Promise<Project> {
    return this.exclusive(async () => {
      const now = this.options.now?.() ?? new Date().toISOString();
      const project: Project = { id: this.options.id?.() ?? crypto.randomUUID(), name, description, workspacePath: null, browserFolder: true, repositoryUrl: null, defaultBranch: null, framework: null, runtime: null, packageManager: null, projectType: null, gitEnabled: null, createdAt: now, updatedAt: now, lastOpenedAt: null };
      await this.repository.save(project); return project;
    });
  }
}

