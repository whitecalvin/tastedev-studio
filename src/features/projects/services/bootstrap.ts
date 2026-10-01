import { detectRuntime } from '../../runtime/hosts.ts';
import { nativeBridge, nativeFileError } from '../../runtime/native-hosts.ts';
import { validateClone, validateNewProject } from '../utils/validation.ts';
import type { FolderConnection } from '../../filesystem/contracts.ts';
export type ProjectTemplate = 'empty' | 'node-smoke' | 'typescript-smoke' | 'python-smoke' | 'rust-smoke';
export function templateFiles(name: string, template: ProjectTemplate) {
  const project = validateNewProject({ name, description: '', workspacePath: '/' });
  if (template === 'empty') return [];
  if (template !== 'node-smoke') return languageTemplate(project.name, template);
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

function languageTemplate(name: string, template: ProjectTemplate) {
  const json=(value: unknown)=>JSON.stringify(value,null,2)+'\n';
  let type: string, runtimes: Record<string,string>, command: string, args: string[], files: {path:string;content:string}[];
  if(template==='typescript-smoke') { type='typescript';runtimes={node:'>=24'};command='node';args=['--test','tests/smoke.test.ts'];files=[{path:'package.json',content:json({name:'studio-starter',private:true,type:'module',scripts:{test:'node --test tests/smoke.test.ts'}})},{path:'tsconfig.json',content:json({compilerOptions:{target:'ESNext',module:'NodeNext',moduleResolution:'NodeNext',strict:true,noEmit:true,allowImportingTsExtensions:true},include:['src','tests']})},{path:'src/calculator.ts',content:'export function add(a: number, b: number): number { return a + b; }\n'},{path:'tests/smoke.test.ts',content:"import { add } from '../src/calculator.ts';\nif (add(2, 3) !== 5) throw new Error('Addition failed');\n"}]; }
  else if(template==='python-smoke') { type='python';runtimes={python:'>=3.10'};command='python';args=['-m','unittest','discover','-s','tests'];files=[{path:'calculator.py',content:'def add(a, b):\n    return a + b\n'},{path:'tests/test_calculator.py',content:'import unittest\nfrom calculator import add\n\nclass CalculatorTests(unittest.TestCase):\n    def test_add(self):\n        self.assertEqual(add(2, 3), 5)\n'}]; }
  else if(template==='rust-smoke') { type='rust';runtimes={rust:'>=1.85'};command='cargo';args=['test','--offline'];files=[{path:'Cargo.toml',content:'[package]\nname = "studio_starter"\nversion = "0.1.0"\nedition = "2024"\n\n[dependencies]\n'},{path:'src/lib.rs',content:'pub fn add(a: i32, b: i32) -> i32 { a + b }\n\n#[cfg(test)]\nmod tests {\n    use super::*;\n    #[test]\n    fn addition() { assert_eq!(add(2, 3), 5); }\n}\n'}]; }
  else throw Error('Invalid project template.');
  return [...files,{path:'.tastedev/project.yml',content:json({version:1,project:{name,type},requirements:{runtimes}})},{path:'.tastedev/tasks.yml',content:json({smoke:{command,args,timeout:120}})},{path:'.tastedev/tests.yml',content:json({smoke:{task:'smoke',type:'unit'}})},{path:'README.md',content:'# '+name+'\n\nRun '+command+' '+args.join(' ')+' locally, or queue smoke in Studio Tests. No third-party dependencies are required. TypeScript uses Node type stripping; it does not run a typechecker. Rust requires Cargo and rustc; Python requires python on PATH.\n'}];
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
