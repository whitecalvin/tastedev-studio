import {validateBinding,type TemplateBinding} from '../../frameworks/domain.ts';
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
        packageManager: null, projectType: valid.projectKind ?? null, gitEnabled: null,
        createdAt: now, updatedAt: now, lastOpenedAt: null,
      };
      await this.repository.save(project);
      return project;
    });
  }
  async bindTemplate(id:string,binding:TemplateBinding):Promise<Project>{
    const valid=validateBinding(binding);
    return this.exclusive(async()=>{const project=await this.get(id);if(!project)throw new ProjectError('Project not found.');const next={...project,templateBinding:valid,updatedAt:this.options.now?.()??new Date().toISOString()};await this.repository.save(next);return next;});
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
  async registerTaskWorkspace(parent:Project,task:{taskId:string;projectId:string;baseRevision:string;state:string;path?:string}):Promise<Project>{
    if(task.projectId!==parent.id||task.state!=='ready'||!task.path||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(task.taskId)||!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(task.baseRevision))throw new ProjectError('Invalid task workspace registration.');
    const workspacePath=task.path;
    return this.exclusive(async()=>{
      const projects=await this.repository.list(),existing=projects.find(p=>p.taskWorkspace?.parentProjectId===parent.id&&p.taskWorkspace.taskId===task.taskId);
      if(existing){if(existing.workspacePath!==task.path||existing.taskWorkspace!.baseRevision!==task.baseRevision)throw new ProjectError('Task workspace identity changed. Existing project was preserved.');return existing;}
      const valid=validateNewProject({name:parent.name+' · '+task.taskId.slice(0,8),description:'Isolated task workspace',workspacePath,initialTeam:'role-team'});assertUniqueProject(projects,valid);
      const now=this.options.now?.()??new Date().toISOString(),project:Project={...valid,id:this.options.id?.()??crypto.randomUUID(),repositoryUrl:null,defaultBranch:null,framework:parent.framework,runtime:parent.runtime,packageManager:parent.packageManager,projectType:parent.projectType,gitEnabled:true,createdAt:now,updatedAt:now,lastOpenedAt:null,taskWorkspace:{parentProjectId:parent.id,taskId:task.taskId,baseRevision:task.baseRevision}};
      await this.repository.save(project);return project;
    });
  }
  async setRepository(id: string, repositoryUrl: string, defaultBranch: string | null) {
    return this.exclusive(async () => {
      const project = await this.get(id); if (!project || !project.workspacePath) throw new ProjectError('Project not found.');
      const { validateClone } = await import('../utils/validation.ts');
      validateClone({ repositoryUrl, workspacePath: project.workspacePath, branch: defaultBranch ?? '' });
      await this.repository.save({ ...project, repositoryUrl, defaultBranch, gitEnabled: true });
    });
  }
  async attachWorkspace(id: string, workspacePath: string): Promise<void> {
    return this.exclusive(async () => {
      const project = await this.get(id); if (!project) throw new ProjectError('Project not found.');
      const valid = validateNewProject({ name: project.name, description: project.description, workspacePath });
      assertUniqueProject((await this.repository.list()).filter(item => item.id !== id), valid);
      await this.repository.save({ ...project, workspacePath: valid.workspacePath, browserFolder: false, updatedAt: this.options.now?.() ?? new Date().toISOString() });
    });
  }  async registerBrowserFolder(name: string, description = '', setup?: Pick<NewProjectInput, 'projectKind' | 'initialRoles' | 'initialTeam' | 'templateBinding'>): Promise<Project> {
    return this.exclusive(async () => {
      const now = this.options.now?.() ?? new Date().toISOString();
      const project: Project = { id: this.options.id?.() ?? crypto.randomUUID(), name, description, workspacePath: null, browserFolder: true, repositoryUrl: null, defaultBranch: null, framework: null, runtime: null, packageManager: null, projectType: null, gitEnabled: null, createdAt: now, updatedAt: now, lastOpenedAt: null };
      if (setup) { const valid = validateNewProject({name, description, workspacePath:'/', ...setup}); project.projectType=valid.projectKind??null; project.initialRoles=valid.initialRoles; project.initialTeam=valid.initialTeam; project.templateBinding=valid.templateBinding; }
      await this.repository.save(project); return project;
    });
  }
}

