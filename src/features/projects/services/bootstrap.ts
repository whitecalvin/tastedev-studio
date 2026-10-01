import { detectRuntime } from '../../runtime/hosts.ts';
import { nativeBridge, nativeFileError } from '../../runtime/native-hosts.ts';
import { validateClone, validateNewProject } from '../utils/validation.ts';
import type { FolderConnection } from '../../filesystem/contracts.ts';
export type ProjectTemplate = 'empty' | 'node-smoke';
export function templateFiles(name: string, template: ProjectTemplate) {
  const project = validateNewProject({ name, description: '', workspacePath: '/' });
  if (template === 'empty') return [];
  if (template !== 'node-smoke') throw Error('Invalid project template.');
  return [
    { path: 'package.json', content: JSON.stringify({ name: 'studio-starter', private: true, scripts: { test: 'node --test tests/smoke.test.cjs' } }, null, 2) + '\n' },
    { path: 'src/calculator.cjs', content: "exports.add = (a, b) => a + b;\n" },
    { path: 'tests/smoke.test.cjs', content: "const test = require('node:test');\nconst assert = require('node:assert/strict');\nconst { add } = require('../src/calculator.cjs');\ntest('addition', () => assert.equal(add(2, 3), 5));\n" },
    { path: '.tastedev/project.yml', content: JSON.stringify({ version: 1, project: { name: project.name, type: 'node' }, requirements: { runtimes: { node: '>=24' } } }, null, 2) + '\n' },
    { path: '.tastedev/tasks.yml', content: JSON.stringify({ smoke: { command: 'node', args: ['--test', 'tests/smoke.test.cjs'], timeout: 30 } }, null, 2) + '\n' },
    { path: '.tastedev/tests.yml', content: JSON.stringify({ smoke: { task: 'smoke', type: 'unit' } }, null, 2) + '\n' },
    { path: 'README.md', content: '# ' + project.name + '\n\nRun `node --test tests/smoke.test.cjs` locally. In Studio, open Tests, connect Core and queue the smoke test using a saved workspace snapshot. No dependency installation is needed.\n' },
  ];
}
export async function prepareProject(input: { id: string; operation: 'create' | 'clone'; target: string; name: string; template: ProjectTemplate; repository?: string; branch?: string }): Promise<FolderConnection> {
  if (detectRuntime() !== 'desktop') throw Error('Project creation and Git Clone require the desktop app.');
  const valid = validateNewProject({ name: input.name, workspacePath: input.target, description: '' });
  if (input.operation === 'clone') validateClone({ repositoryUrl: input.repository ?? '', workspacePath: valid.workspacePath, branch: input.branch ?? '' });
  try {
    await nativeBridge.invoke('project_begin', { id: input.id });
    return await nativeBridge.invoke('project_prepare', { request: { id: input.id, operation: input.operation, target: valid.workspacePath, repository: input.repository ?? null, branch: input.branch ?? null, files: input.operation === 'create' ? templateFiles(valid.name, input.template) : [] } });
  } catch (error) { throw nativeFileError(error); }
}
export async function cancelProject(id: string) { await nativeBridge.invoke('project_cancel', { id }); }
