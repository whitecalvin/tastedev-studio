import { readFile, mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await readFile(resolve(root, 'node_modules/monaco-editor/package.json'), 'utf8'));
const target = resolve(root, 'public/monaco', pkg.version);
const source = resolve(root, 'node_modules/monaco-editor/min/vs/assets');
await mkdir(target, { recursive: true });
const entries = await readdir(source);
const manifest = {};
for (const label of ['editor', 'json', 'css', 'html', 'ts']) {
  const name = entries.find(name => name.startsWith(`${label}.worker-`) && name.endsWith('.js'));
  if (!name) throw new Error(`Missing Monaco ${label} worker for ${pkg.version}`);
  await copyFile(resolve(source, name), resolve(target, name));
  // Match this pinned Monaco distribution's worker-ready handshake.
  await writeFile(resolve(target, `${label}.worker.js`), `importScripts('./${name}');\nself.postMessage({ type: 'vscode-worker-ready' });\n`);
  manifest[label] = `/monaco/${pkg.version}/${label}.worker.js`;
}
await copyFile(resolve(root, 'node_modules/monaco-editor/LICENSE'), resolve(target, 'LICENSE'));
await writeFile(resolve(root, 'public/monaco/workers.json'), JSON.stringify(manifest));
console.log(`Monaco ${pkg.version}: same-origin worker assets prepared.`);
