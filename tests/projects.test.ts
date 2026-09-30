import test from "node:test";
import assert from "node:assert/strict";
import { LocalProjectRepository, PROJECT_STORAGE_KEY, type MetadataStorage } from "../src/features/projects/services/project-repository.ts";
import { ProjectService } from "../src/features/projects/services/project-service.ts";
import { WebGitCloneService, WebProjectDetector, WebProjectFileSystemProvider } from "../src/features/projects/services/platform.ts";
import { normalizeWorkspacePath, validateClone, validateNewProject, workspaceKey } from "../src/features/projects/utils/validation.ts";

class MemoryStorage implements MetadataStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
function setup() {
  const storage = new MemoryStorage();
  const repository = new LocalProjectRepository(() => storage);
  let time = "2026-09-29T10:00:00.000Z";
  let id = 0;
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation, operation);
    queue = result.catch(() => undefined);
    return result;
  };
  const service = new ProjectService(repository, { id: () => `project-${++id}`, now: () => time, exclusive });
  return { storage, repository, service, tick: () => { time = "2026-09-30T10:00:00.000Z"; } };
}
const input = { name: "  My App  ", workspacePath: "C:\\Work\\MyApp\\", description: " Notes " };

test("new repository is empty without seeding or writing data", async () => {
  const { service, storage } = setup();
  assert.deepEqual(await service.list(), []);
  assert.equal(storage.data.size, 0);
});
test("required name and path, absolute paths and size limits are validated", () => {
  for (const value of [{ ...input, name: " " }, { ...input, workspacePath: "" }, { ...input, workspacePath: "relative/app" }, { ...input, name: "a".repeat(121) }, { ...input, description: "a".repeat(2001) }]) assert.throws(() => validateNewProject(value));
  assert.deepEqual(validateNewProject(input), { name: "My App", workspacePath: "C:/Work/MyApp", description: "Notes" });
});
test("path identity handles separators, roots, dot segments and OS case rules", () => {
  assert.equal(workspaceKey("C:\\Work\\x\\..\\App\\"), "c:/work/app");
  assert.equal(workspaceKey("c:/work/./app"), "c:/work/app");
  assert.equal(normalizeWorkspacePath("C:/"), "C:/");
  assert.equal(workspaceKey("/"), "/");
  assert.notEqual(workspaceKey("/App"), workspaceKey("/app"));
  assert.equal(workspaceKey("\\\\Server\\Share\\App"), "//server/share/app");
  for (const path of ["/../app", "C:/../app", "//server", "C:/work/bad.", "C:/work/bad?", "/bad\u0000path"]) assert.throws(() => normalizeWorkspacePath(path));
});
test("creation persists all domain fields and does not invent detected values", async () => {
  const { service, storage } = setup();
  const project = await service.create(input);
  assert.equal(project.name, "My App");
  assert.equal(project.description, "Notes");
  assert.equal(project.workspacePath, "C:/Work/MyApp");
  for (const field of ["framework", "runtime", "repositoryUrl", "defaultBranch", "gitEnabled", "packageManager", "projectType", "lastOpenedAt"] as const) assert.equal(project[field], null);
  assert.equal(project.createdAt, project.updatedAt);
  const reloaded = new ProjectService(new LocalProjectRepository(() => storage));
  assert.deepEqual(await reloaded.get(project.id), project);
  assert.equal(JSON.parse(storage.getItem(PROJECT_STORAGE_KEY)!).version, 1);
});
test("duplicate workspace paths rejected, same names at distinct paths allowed", async () => {
  const { service } = setup();
  await service.create(input);
  await assert.rejects(service.create({ ...input, workspacePath: "c:/work/./myapp" }), /already/);
  await service.create({ ...input, workspacePath: "/different" });
  assert.equal((await service.list()).length, 2);
});
test("repository independently rejects duplicates", async () => {
  const { service, repository } = setup();
  const project = await service.create(input);
  await assert.rejects(repository.save({ ...project, id: "another-id" }), /already/);
});
test("opening saves lastOpenedAt and sorts recent projects without duplicating", async () => {
  const { service, tick } = setup();
  const first = await service.create(input);
  await service.create({ ...input, workspacePath: "/other" });
  tick();
  const opened = await service.open(first.id);
  assert.equal(opened.lastOpenedAt, "2026-09-30T10:00:00.000Z");
  assert.equal(opened.createdAt, first.createdAt);
  assert.equal((await service.list())[0].id, first.id);
  assert.equal((await service.list()).length, 2);
});
test("unknown project cannot be opened or accidentally created", async () => {
  const { service } = setup();
  await assert.rejects(service.open("missing"), /not in this browser/);
  assert.deepEqual(await service.list(), []);
});
test("corrupt or unsupported metadata is never silently overwritten", async () => {
  const { service, storage } = setup();
  for (const raw of ["not-json", "null", '{"version":2,"projects":[]}', '{"version":1,"projects":[{}]}']) {
    storage.setItem(PROJECT_STORAGE_KEY, raw);
    await assert.rejects(service.list(), /has not been changed/);
    await assert.rejects(service.create(input), /has not been changed/);
    assert.equal(storage.getItem(PROJECT_STORAGE_KEY), raw);
  }
});
test("duplicate records in persisted metadata are rejected without rewriting", async () => {
  const { service, storage } = setup();
  const project = await service.create(input);
  const raw = JSON.stringify({ version: 1, projects: [project, { ...project, id: "other" }] });
  storage.setItem(PROJECT_STORAGE_KEY, raw);
  await assert.rejects(service.list(), /could not be read/);
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY), raw);
});
test("unavailable storage is reported as an actionable error", async () => {
  const repository = new LocalProjectRepository(() => { throw new Error("SecurityError"); });
  await assert.rejects(repository.list(), /Allow site storage/);
});
test("quota failure is propagated and existing data remains intact", async () => {
  const { service, storage } = setup();
  const project = await service.create(input);
  const before = storage.getItem(PROJECT_STORAGE_KEY);
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  await assert.rejects(service.open(project.id), /could not be saved/);
  assert.equal(storage.getItem(PROJECT_STORAGE_KEY), before);
});
test("serialized concurrent requests do not lose distinct projects or accept duplicates", async () => {
  const { service } = setup();
  const results = await Promise.allSettled([service.create(input), service.create(input), service.create({ ...input, workspacePath: "/other" })]);
  assert.deepEqual(results.map((result) => result.status), ["fulfilled", "rejected", "fulfilled"]);
  assert.equal((await service.list()).length, 2);
});
test("clone validates URL, destination and optional branch", () => {
  const valid = { repositoryUrl: "https://github.com/org/repo.git", workspacePath: "/work/repo", branch: "" };
  assert.deepEqual(validateClone(valid), valid);
  assert.equal(validateClone({ ...valid, repositoryUrl: "git@github.com:org/repo.git", branch: "feature/ui" }).branch, "feature/ui");
  for (const url of ["", "javascript:alert(1)", "https://token@github.com/org/repo", "https://github.com", "https://user:password@github.com/org/repo"]) assert.throws(() => validateClone({ ...valid, repositoryUrl: url }));
  for (const branch of ["bad branch", "..", "-option", "refs@{head}", "foo.lock"]) assert.throws(() => validateClone({ ...valid, branch }));
});
test("web filesystem, Git and detection report unsupported without side effects", async () => {
  await assert.rejects(new WebProjectFileSystemProvider().selectDirectory(), /unsupported/i);
  const clone = await new WebGitCloneService().clone({ repositoryUrl: "https://github.com/org/repo", workspacePath: "/app", branch: "" });
  assert.equal(clone.status, "unsupported");
  if (clone.status === "unsupported") assert.match(clone.message, /No repository was cloned/);
  assert.equal((await new WebProjectDetector().detect("/app")).status, "unsupported");
});

