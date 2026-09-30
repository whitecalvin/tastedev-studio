import type { CloneInput } from "../types/project.ts";

export type CapabilityResult<T> = { status: "available"; value: T } | { status: "unsupported"; message: string };

export type ProjectFileSystemProvider = Pick<import("../../filesystem/contracts.ts").FileSystemHost, "selectDirectory">;
export { WebFileSystemHost as WebProjectFileSystemProvider } from "../../filesystem/web-host.ts";
export interface GitCloneService {
  clone(input: CloneInput): Promise<CapabilityResult<{ workspacePath: string }>>;
}
export class WebGitCloneService implements GitCloneService {
  async clone(_input: CloneInput): Promise<CapabilityResult<{ workspacePath: string }>> {
    void _input;
    return { status: "unsupported", message: "Native Git integration will be available in the desktop runtime. No repository was cloned and no project was added." };
  }
}

export interface ProjectDetection {
  framework: string | null;
  runtime: string | null;
  packageManager: string | null;
  gitEnabled: boolean | null;
  projectType: string | null;
}
export interface ProjectDetector {
  detect(workspacePath: string): Promise<CapabilityResult<ProjectDetection>>;
}
export class WebProjectDetector implements ProjectDetector {
  async detect(_workspacePath: string): Promise<CapabilityResult<ProjectDetection>> {
    void _workspacePath;
    return { status: "unsupported", message: "Project detection needs filesystem access. Framework and runtime are not detected in this browser." };
  }
}

