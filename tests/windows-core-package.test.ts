import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const base = path.resolve('../../../resources/verification/dev-01/tasks/tastedev-studio/deployment-foundation-20261005/windows-contract');
function fixture() {
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'fixture-'));
  fs.mkdirSync(path.join(root, 'transport'));
  const files = [['transport/main.ts', '// controlled runtime'], ['package.json', '{"version":"0.1.42"}']].map(([file, body]) => {
    fs.writeFileSync(path.join(root, file), body);
    return { file, sha256: createHash('sha256').update(body).digest('hex') };
  });
  fs.writeFileSync(path.join(root, 'runtime-manifest.json'), JSON.stringify({ schemaVersion: 1, files }));
  return root;
}
function validate(root: string) {
  return spawnSync('pwsh.exe', ['-NoProfile', '-File', 'scripts/package-windows-core.ps1', '-RuntimeDirectory', root, '-OutputDirectory', path.join(root, 'unused'), '-ValidateOnly'], { encoding: 'utf8' });
}
test('Windows Core packaging verifies the complete manifest without installing a service', () => {
  const root = fixture(); const result = validate(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Runtime verified: 2 files/);
  assert.equal(fs.existsSync(path.join(root, 'unused')), false);
});
test('Windows Core packaging rejects tampered content', () => {
  const root = fixture(); fs.appendFileSync(path.join(root, 'transport/main.ts'), 'tampered');
  const result = validate(root);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Runtime checksum mismatch/);
});
test('Windows Core packaging rejects output inside the source runtime', () => {
  const root = fixture();
  const result = spawnSync('pwsh.exe', ['-NoProfile', '-File', 'scripts/package-windows-core.ps1', '-RuntimeDirectory', root, '-OutputDirectory', path.join(root, 'nested-output')], { encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /outside the input runtime/);
  assert.equal(fs.existsSync(path.join(root, 'nested-output')), false);
});
test('Windows Core packaging rejects manifest traversal and extra credential files', () => {
  const root = fixture(); const manifest = JSON.parse(fs.readFileSync(path.join(root, 'runtime-manifest.json'), 'utf8'));
  manifest.files[0].file = '../outside.ts';
  fs.writeFileSync(path.join(root, 'runtime-manifest.json'), JSON.stringify(manifest));
  const traversal = validate(root);
  assert.notEqual(traversal.status, 0); assert.match(traversal.stderr, /Unsafe runtime manifest entry/);
  const extra = fixture(); fs.writeFileSync(path.join(extra, '.env'), 'DUMMY_TOKEN=NOT_REAL');
  const result = validate(extra);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Unlisted runtime file/);
});
test('Core service configuration keeps credentials outside JSON and refuses replacement', () => {
  const runtime = fixture(); const kit = path.dirname(runtime);
  const isolated = fs.mkdtempSync(path.join(kit, 'configuration-'));
  fs.cpSync(runtime, path.join(isolated, 'runtime'), { recursive: true });
  fs.copyFileSync('scripts/configure-windows-core.ps1', path.join(isolated, 'configure-windows-core.ps1'));
  const credential = path.join(isolated, 'test-credentials.env');
  fs.writeFileSync(credential, 'CORE_AGENT_TOKEN=DUMMY_AGENT_VALUE_20261005\nCORE_STUDIO_TOKEN=DUMMY_STUDIO_VALUE_20261005');
  const args = ['-NoProfile', '-File', path.join(isolated, 'configure-windows-core.ps1'), '-NodePath', process.execPath, '-CredentialFile', credential, '-DataDirectory', path.join(isolated, 'data')];
  const result = spawnSync('pwsh.exe', args, { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const content = fs.readFileSync(path.join(isolated, 'core-service.json'), 'utf8');
  const definition = JSON.parse(content);
  assert.doesNotMatch(content, /DUMMY_(AGENT|STUDIO)_VALUE/);
  assert.equal(definition.startArguments[0], `--env-file=${credential}`);
  assert.equal(definition.stopArguments.at(-1), 'stop');
  assert.equal(definition.environment.CORE_HOST, '127.0.0.1');
  assert.equal(definition.readinessUrl, 'http://127.0.0.1:4340/health/ready');
  assert.equal(fs.existsSync(path.join(isolated, 'data')), false);
  const again = spawnSync('pwsh.exe', args, { encoding: 'utf8' });
  assert.notEqual(again.status, 0); assert.match(again.stderr, /Existing definition/);
  assert.equal(fs.readFileSync(path.join(isolated, 'core-service.json'), 'utf8'), content);
});

test('current Core runtime includes its Snapshot policy and loads without the development node_modules',()=>{
 const root=fixture(),output=path.join(path.dirname(root),path.basename(root)+'-current-core');
 const prepared=spawnSync(process.execPath,['scripts/prepare-core-runtime.mjs',output],{encoding:'utf8'});
 assert.equal(prepared.status,0,prepared.stderr);
 assert(fs.existsSync(path.join(output,'src/features/ai/snapshot-content-policy.ts')));
 const checked=validate(output);assert.equal(checked.status,0,checked.stderr);
 const entry=JSON.stringify(path.join(output,'transport/source-snapshot-store.ts').replaceAll('\\','/'));
 const loaded=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',`await import('file:///'+${entry});`],{cwd:output,encoding:'utf8'});
 assert.equal(loaded.status,0,loaded.stderr);
});

test('Windows Core host reuse checks source, tool, compiler and executable before packaging',()=>{
 const runtime=fixture(),parent=path.dirname(runtime),first=runtime+'-host',second=runtime+'-reused';
 const packageArgs=(output:string,reuse?:string)=>['-NoProfile','-File','scripts/package-windows-core.ps1','-RuntimeDirectory',runtime,'-OutputDirectory',output,...(reuse?['-ReuseHostPackage',reuse]:[])];
 const built=spawnSync('pwsh.exe',packageArgs(first),{encoding:'utf8'});
 assert.equal(built.status,0,built.stderr);
 fs.writeFileSync(path.join(parent,'LATEST-VERIFIED-HOST.txt'),first);
 const reused=spawnSync('pwsh.exe',packageArgs(second,first),{encoding:'utf8'});
 assert.equal(reused.status,0,reused.stderr);
 assert.match(reused.stdout,/no compilation/);
 assert.deepEqual(fs.readFileSync(path.join(first,'tastestudio-core-service.exe')),fs.readFileSync(path.join(second,'tastestudio-core-service.exe')));
 const recordFile=path.join(first,'host-build.json'),original=fs.readFileSync(recordFile,'utf8'),record=JSON.parse(original);
 for(const key of ['sourceSha256','toolSha256','compilerSha256','contract']){
  const changed=structuredClone(record);changed.inputs[key]='changed';fs.writeFileSync(recordFile,JSON.stringify(changed));
  const output=second+'-'+key,result=spawnSync('pwsh.exe',packageArgs(output,first),{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Service host input changed/);assert.equal(fs.existsSync(output),false);
 }
 fs.writeFileSync(recordFile,original);
 fs.appendFileSync(path.join(first,'tastestudio-core-service.exe'),'tampered');
 const output=second+'-corrupt',corrupt=spawnSync('pwsh.exe',packageArgs(output,first),{encoding:'utf8'});
 assert.notEqual(corrupt.status,0);assert.match(corrupt.stderr,/Service host checksum mismatch/);assert.equal(fs.existsSync(output),false);
 // Reused output retains the verified bytes and provenance for the real current runtime package.
 fs.writeFileSync(path.join(parent,'LATEST-VERIFIED-HOST.txt'),second);
});
