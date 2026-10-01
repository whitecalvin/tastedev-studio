import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeFileSystemHost } from './helpers/fake-host.ts';
import { WorkspaceFileService } from '../src/features/filesystem/file-service.ts';
import { normalizePath, childPath, parentPath, nonRoot, validateName } from '../src/features/filesystem/paths.ts';
import { checkFile, decodeText, detectLanguage, MAX_FILE_BYTES } from '../src/features/editor/policy.ts';
import { Documents } from '../src/features/editor/documents.ts';
import { LocalProjectRepository } from '../src/features/projects/services/project-repository.ts';
import { ProjectService } from '../src/features/projects/services/project-service.ts';
async function setup() { const host = new FakeFileSystemHost(); host.entries.set('src', null); host.entries.set('src/main.ts', 'const value = 1;\n'); host.entries.set('readme.md', '# Hello\n'); host.entries.set('.git', null); const files = new WorkspaceFileService(host); await files.restore('test'); return { host, files, documents: new Documents(files) }; }
test('relative paths normalize separators and root without allowing traversal or absolute injection', () => {
  assert.equal(normalizePath(''), ''); assert.equal(normalizePath('./src//main.ts'), 'src/main.ts'); assert.equal(normalizePath('src\\main.ts'), 'src/main.ts'); assert.equal(childPath('src', 'a.ts'), 'src/a.ts'); assert.equal(parentPath('src/a.ts'), 'src'); assert.equal(parentPath('a.ts'), '');
  for (const input of ['../secret', 'src/../secret', '/etc/passwd', 'C:/work', '\\server\\share', 'a\u0000b', 'x:y', 'x/..', 'trailing.']) assert.throws(() => normalizePath(input));
  for (const name of ['', '.', '..', 'a/b', 'a\\b', 'CON', 'aux.txt', ' end', 'a?']) assert.throws(() => validateName(name));
  assert.throws(() => nonRoot('')); assert.equal(validateName('cancel'), 'cancel');
});
test('all specified languages and unknown extensions are detected', () => {
  const expected: Record<string, string> = { ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', css: 'css', scss: 'scss', html: 'html', md: 'markdown', yaml: 'yaml', yml: 'yaml', xml: 'xml', java: 'java', py: 'python', rs: 'rust', sql: 'sql', sh: 'shell', ps1: 'powershell' };
  for (const [extension, language] of Object.entries(expected)) assert.equal(detectLanguage(`file.${extension}`), language);
  assert.equal(detectLanguage('file.UNKNOWN'), 'plaintext'); assert.equal(detectLanguage('UPPER.TS'), 'typescript');
});
test('binary, oversize, NUL and invalid UTF-8 inputs are rejected without truncation', () => {
  for (const extension of ['png','jpg','jpeg','gif','webp','ico','pdf','zip','exe','dll']) assert.throws(() => checkFile(`file.${extension}`, 1), /Binary/);
  checkFile('file.txt', MAX_FILE_BYTES); assert.throws(() => checkFile('file.txt', MAX_FILE_BYTES + 1), /2 MiB/);
  assert.throws(() => decodeText('file.txt', new Uint8Array([0])), /Binary/); assert.throws(() => decodeText('file.txt', new Uint8Array([255])), /UTF-8/);
  assert.equal(decodeText('hello.ts', new TextEncoder().encode('한글\r\n')), '한글\r\n'); assert.equal(decodeText('bom.txt', new Uint8Array([239,187,191,65])), '\ufeffA');
});
test('directory listing is lazy and ignored entries remain on the host', async () => {
  const { files, host } = await setup(); const entries = await files.list(); assert.equal(entries.some(e => e.name === '.git'), false); assert.equal(host.entries.has('.git'), true); assert.deepEqual(host.reads, ['']); assert.equal((await files.list('src'))[0].path, 'src/main.ts'); assert.ok((await files.list('', true)).some(e => e.name === '.git'));
});
test('fake filesystem create/read/write/exists/rename/delete contract', async () => {
  const { files, host } = await setup(); await files.create('', 'new', 'directory'); await files.create('new', 'file.txt', 'file'); await files.write('new/file.txt', 'new text', ''); assert.equal((await files.read('new/file.txt')).content, 'new text'); assert.equal(await host.exists('authorized', 'new/file.txt'), true); await files.rename('new', 'renamed'); assert.equal((await files.read('renamed/file.txt')).content, 'new text'); await files.delete('renamed'); assert.equal(await host.exists('authorized', 'renamed'), false);
});
test('service and host reject escape, duplicate, root deletion and unauthorized handles', async () => {
  const { files, host } = await setup(); await assert.rejects(files.read('../secret')); await assert.rejects(host.readDirectory('unknown', '')); await assert.rejects(files.create('', 'readme.md', 'file'), /already exists/); await assert.rejects(files.rename('src', '../out')); await assert.rejects(files.delete('')); host.access = 'denied'; await assert.rejects(files.list(), /Access denied/);
});
test('Explorer open/edit/save integration changes the fake disk and clears dirty', async () => {
  const { files, host, documents } = await setup(); const path = (await files.list('src'))[0].path; await documents.open(path); const id = documents.snapshot().activeEditorId!; documents.edit(id, 'const value = 2;\n'); assert.deepEqual(documents.snapshot().dirtyEditors, [id]); await documents.save(id); assert.equal(host.entries.get(path), 'const value = 2;\n'); assert.equal((await files.read(path)).content, 'const value = 2;\n'); assert.equal(documents.snapshot().dirtyEditors.length, 0);
});
test('multiple tabs, normalized duplicate open and activation preserve documents', async () => {
  const { documents } = await setup(); await Promise.all([documents.open('src/main.ts'), documents.open('src//main.ts')]); assert.equal(documents.snapshot().openEditors.length, 1); const first = documents.snapshot().activeEditorId!; await documents.open('readme.md'); assert.equal(documents.snapshot().openEditors.length, 2); documents.activate(first); assert.equal(documents.snapshot().activeEditorId, first); await documents.open('./src/main.ts'); assert.equal(documents.snapshot().openEditors.length, 2);
});
test('undo to saved content clears dirty; failed save retains content and dirty state', async () => {
  const { documents, host } = await setup(); await documents.open('readme.md'); const id = documents.snapshot().activeEditorId!, original = documents.get(id).content; documents.edit(id, 'changed'); documents.edit(id, original); assert.equal(documents.snapshot().dirtyEditors.length, 0); documents.edit(id, 'pending'); host.fail.add('writeFile'); await assert.rejects(documents.save(id)); assert.equal(documents.get(id).savedContent, original); assert.equal(documents.get(id).content, 'pending'); assert.deepEqual(documents.snapshot().dirtyEditors, [id]);
});
test('save all records per-file success and failure without discarding edits', async () => {
  const { documents, host } = await setup(); await documents.open('src/main.ts'); await documents.open('readme.md'); for (const doc of documents.snapshot().openEditors) documents.edit(doc.id, 'changed'); host.fail.add('writeFile:readme.md'); const errors = await documents.saveAll(); assert.equal(errors.length, 1); assert.equal(documents.snapshot().dirtyEditors.length, 1); assert.equal(host.entries.get('src/main.ts'), 'changed'); assert.equal(host.entries.get('readme.md'), '# Hello\n');
});
test('clean close and dirty Save/Discard/Cancel have distinct outcomes', async () => {
  const { documents, host } = await setup(); await documents.open('readme.md'); let id = documents.snapshot().activeEditorId!; assert.equal(await documents.close(id), true); await documents.open('readme.md'); id = documents.snapshot().activeEditorId!; documents.edit(id, 'unsaved'); assert.equal(await documents.close(id, 'cancel'), false); assert.equal(documents.get(id).content, 'unsaved'); await documents.close(id, 'discard'); assert.equal(host.entries.get('readme.md'), '# Hello\n'); await documents.open('readme.md'); id = documents.snapshot().activeEditorId!; documents.edit(id, 'saved'); await documents.close(id, 'save'); assert.equal(host.entries.get('readme.md'), 'saved'); assert.equal(documents.snapshot().openEditors.length, 0);
});
test('failed save-and-close keeps tab; external edits conflict; dirty reload needs explicit discard', async () => {
  const { documents, host } = await setup(); await documents.open('readme.md'); const id = documents.snapshot().activeEditorId!; documents.edit(id, 'my change'); host.entries.set('readme.md', 'external'); await assert.rejects(documents.close(id, 'save'), /changed/); assert.equal(documents.get(id).content, 'my change'); await assert.rejects(documents.reload(id), /discard/); await documents.reload(id, true); assert.equal(documents.get(id).content, 'external'); assert.equal(documents.snapshot().dirtyEditors.length, 0);
});
test('create/refresh/open/folder rename/dirty path remap/delete stay synchronized', async () => {
  const { files, documents } = await setup(); await files.create('', 'folder', 'directory'); await files.create('folder', 'a.ts', 'file'); const entry = (await files.list('folder'))[0]; await documents.open(entry.path); const id = documents.snapshot().activeEditorId!; documents.edit(id, 'unsaved'); const target = await files.rename('folder', 'renamed'); documents.renamed('folder', target); assert.equal(documents.get(id).path, 'renamed/a.ts'); assert.equal(documents.get(id).content, 'unsaved'); await documents.save(id); assert.equal((await files.read('renamed/a.ts')).content, 'unsaved'); await files.delete('renamed'); documents.removed('renamed'); assert.equal(documents.snapshot().openEditors.length, 0); assert.equal(documents.snapshot().activeEditorId, null);
});
test('browser folder metadata has no invented absolute path and supports same folder names', async () => {
  const data = new Map<string,string>(); const repository = new LocalProjectRepository(() => ({ getItem: key => data.get(key) ?? null, setItem: (key,value) => { data.set(key,value); } })); const service = new ProjectService(repository); await service.registerBrowserFolder('same'); await service.registerBrowserFolder('same'); const list = await service.list(); assert.equal(list.length, 2); assert.ok(list.every(p => p.workspacePath === null && p.browserFolder));
});
test('read/create/rename/delete simulated failures preserve originals and open documents', async () => {
  const { files, host, documents } = await setup(); await documents.open('readme.md'); const before = new Map(host.entries); for (const op of ['readFile','create','rename','delete']) { host.fail.add(op); await assert.rejects(op === 'readFile' ? files.read('readme.md') : op === 'create' ? files.create('', 'new', 'file') : op === 'rename' ? files.rename('readme.md', 'other.md') : files.delete('readme.md')); host.fail.delete(op); assert.deepEqual(host.entries, before); } assert.equal(documents.snapshot().openEditors.length, 1);
});

test('ESM and CommonJS source and declaration extensions use their actual language worker',()=>{for(const file of ['main.mts','main.cts','index.d.mts','index.d.cts'])assert.equal(detectLanguage(file),'typescript');for(const file of ['main.mjs','main.cjs'])assert.equal(detectLanguage(file),'javascript');});
