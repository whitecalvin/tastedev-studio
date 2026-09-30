import { LocalProjectRepository } from "./project-repository";
import { ProjectService } from "./project-service";
import { WebGitCloneService } from "./platform";

// Storage is resolved lazily after mount; module evaluation is SSR-safe.
let localQueue: Promise<unknown> = Promise.resolve();
async function exclusive<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("tastedev-project-metadata", operation);
  }
  const result = localQueue.then(operation, operation);
  localQueue = result.catch(() => undefined);
  return result;
}
export const projectService = new ProjectService(new LocalProjectRepository(() => window.localStorage), { exclusive });
export { browserFileHost as projectFileSystem } from "../../filesystem/browser";
export const gitClone = new WebGitCloneService();

