import { ProjectError, type CloneInput, type NewProjectInput, type Project } from "../types/project.ts";

// Lexical identity only: a browser cannot resolve symlinks or volume case rules.
export function normalizeWorkspacePath(input: string): string {
  const value = input.trim().replaceAll("\\", "/");
  const drive = /^[a-z]:\//i.test(value);
  const unc = value.startsWith("//");
  if (!value.startsWith("/") && !drive) {
    throw new ProjectError("Enter an absolute workspace path, such as C:\\Projects\\app or /home/user/app.");
  }
  if (/[\u0000-\u001f<>"|?*]/.test(value) || (drive ? value.slice(2) : value).includes(":")) {
    throw new ProjectError("The workspace path contains unsupported characters.");
  }
  const segments = value.split("/").filter(Boolean);
  if (unc && segments.length < 2) throw new ProjectError("A network path needs both a server and a share.");
  const prefix = drive ? segments.shift()! : unc ? `//${segments.shift()}/${segments.shift()}` : "";
  const parts: string[] = [];
  for (const segment of segments) {
    if (segment === ".") continue;
    if (segment === "..") {
      if (!parts.length) throw new ProjectError("The workspace path cannot go above its root.");
      parts.pop();
    } else {
      if ((drive || unc) && /[. ]$/.test(segment)) throw new ProjectError("Windows folder names cannot end with a dot or space.");
      parts.push(segment);
    }
  }
  if (drive && !parts.length) return `${prefix}/`;
  return `${prefix}/${parts.join("/")}`.replace(/\/$/, "") || "/";
}

export function workspaceKey(path: string): string {
  const normalized = normalizeWorkspacePath(path);
  return /^[a-z]:/i.test(normalized) || normalized.startsWith("//") ? normalized.toLowerCase() : normalized;
}

export function validateNewProject(input: NewProjectInput): NewProjectInput {
  const name = input.name.trim();
  if (!name) throw new ProjectError("Project name is required.");
  if (name.length > 120) throw new ProjectError("Project name must be 120 characters or fewer.");
  if (!input.workspacePath.trim()) throw new ProjectError("Workspace path is required.");
  if (input.workspacePath.length > 4096) throw new ProjectError("Workspace path is too long.");
  if (input.description.length > 2000) throw new ProjectError("Description must be 2,000 characters or fewer.");
  return { name, workspacePath: normalizeWorkspacePath(input.workspacePath), description: input.description.trim() };
}

export function assertUniqueProject(projects: Project[], input: NewProjectInput): void {
  if (projects.some((p) => p.workspacePath && workspaceKey(p.workspacePath) === workspaceKey(input.workspacePath))) {
    throw new ProjectError("This workspace is already in Recent Projects. Open the existing project instead.");
  }
}

export function validateClone(input: CloneInput): CloneInput {
  const repositoryUrl = input.repositoryUrl.trim();
  let valid = false;
  try {
    const url = new URL(repositoryUrl);
    valid = ["https:", "ssh:"].includes(url.protocol) && !!url.hostname && url.pathname.length > 1 && !url.password && !(url.protocol === "https:" && url.username);
  } catch {
    valid = /^[\w.-]+@[\w.-]+:[\w./-]+$/.test(repositoryUrl);
  }
  if (!valid) throw new ProjectError("Enter an HTTPS or SSH repository URL without embedded passwords or tokens.");
  const workspacePath = normalizeWorkspacePath(input.workspacePath);
  const branch = input.branch.trim();
  if (branch && (branch.startsWith("-") || /[\s~^:?*\[\\]/.test(branch) || branch.includes("..") || branch.includes("@{") || branch.endsWith("/") || branch.endsWith(".") || branch.endsWith(".lock"))) {
    throw new ProjectError("Enter a valid Git branch name or leave it empty.");
  }
  return { repositoryUrl, workspacePath, branch };
}
