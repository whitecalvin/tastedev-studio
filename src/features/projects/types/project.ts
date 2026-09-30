export interface Project {
  id: string;
  name: string;
  description: string;
  workspacePath: string | null;
  browserFolder?: boolean;
  repositoryUrl: string | null;
  defaultBranch: string | null;
  framework: string | null;
  runtime: string | null;
  packageManager: string | null;
  projectType: string | null;
  gitEnabled: boolean | null;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
}

export interface NewProjectInput {
  name: string;
  workspacePath: string;
  description: string;
}

export interface CloneInput {
  repositoryUrl: string;
  workspacePath: string;
  branch: string;
}

export class ProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectError";
  }
}
