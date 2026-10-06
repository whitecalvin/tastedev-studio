import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const evidence = path.resolve('../../../resources/verification/dev-01/tasks/tastedev-studio/deployment-foundation-20261005/package-contract');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';
const unix = (value: string) => value.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);
function fixture() {
  fs.mkdirSync(evidence, { recursive: true });
  const root = fs.mkdtempSync(path.join(evidence, 'fixture-'));
  for (const dir of ['payload/core/transport', 'output', 'bin', 'captured']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  for (const name of ['tastestudio', 'tastestudio-agent']) fs.writeFileSync(path.join(root, 'payload', name), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'payload/core/transport/main.ts'), '// Controlled package layout fixture');
  fs.writeFileSync(path.join(root, 'payload/core/runtime-manifest.json'), '{"schemaVersion":1,"files":[]}');
  const nodeRoot = path.join(root, 'payload/core/node');
  fs.mkdirSync(path.join(nodeRoot, 'bin'), { recursive: true });
  const runtimeFiles = { 'bin/node': '#!/bin/sh\nexit 0\n', LICENSE: 'Controlled license fixture', VERSION: 'v24.11.1\n' };
  for (const [file, contents] of Object.entries(runtimeFiles)) fs.writeFileSync(path.join(nodeRoot, file), contents, { mode: 0o755 });
  fs.writeFileSync(path.join(nodeRoot, 'SHA256SUMS'), Object.entries(runtimeFiles).map(([file, contents]) => `${createHash('sha256').update(contents).digest('hex')}  ${file}`).join('\n') + '\n');
  // Only the DEB builder is intercepted; the real shell stages files, service units and controls.
  fs.writeFileSync(path.join(root, 'bin/dpkg-deb'), '#!/bin/sh\ncp -R "$3" "$CAPTURE/$(basename "$3")"\nprintf controlled-package > "$4"\n', { mode: 0o755 });
  return root;
}
function run(root: string, formats = 'deb') {
  const command = 'chmod +x "$FIXTURE/bin/"* "$FIXTURE/payload/tastestudio" "$FIXTURE/payload/tastestudio-agent"; export PATH="$FIXTURE/bin:$PATH"; bash scripts/package-linux-release.sh --payload-dir "$FIXTURE/payload" --output-dir "$FIXTURE/output" --package-name tastedev-studio-0.1.42-linux-x86_64 --version 0.1.42 --packager-script /unused --icon resources/branding/tastedev-studio-desktop/icons/icon.png --desktop-categories-base64 RGV2ZWxvcG1lbnQ7SURFOw== --formats ' + formats + ' --rpm-license MIT';
  return spawnSync(bash, ['-c', command], { cwd: process.cwd(), env: { ...process.env, FIXTURE: unix(root), CAPTURE: unix(path.join(root, 'captured')), MSYS_NO_PATHCONV: '1' }, encoding: 'utf8' });
}
test('Linux package layout separates GUI/Core/Agent and bundles exact component versions', () => {
  const root = fixture(); const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const read = (pkg: string, file: string) => fs.readFileSync(path.join(root, 'captured', `deb-tastedev-studio${pkg}`, file), 'utf8');
  assert.match(read('-desktop', 'usr/share/applications/tastestudio.desktop'), /^Exec=\/usr\/bin\/tastestudio$/m);
  assert.doesNotMatch(read('-desktop', 'usr/share/applications/tastestudio.desktop'), /Exec=.*agent/);
  assert.match(read('-desktop', 'DEBIAN/control'), /Replaces: tastedev-studio/);
  assert.match(read('-core', 'lib/systemd/system/tastestudio-core.service'), /ExecStart=\/usr\/lib\/tastestudio-core\/node\/bin\/node.*transport\/main.ts/);
  assert.doesNotMatch(read('-core', 'DEBIAN/control'), /nodejs/);
  assert.equal(read('-core', 'usr/lib/tastestudio-core/node/VERSION'), 'v24.11.1\n');
  assert.ok(read('-core', 'usr/lib/tastestudio-core/node/LICENSE').includes('Controlled'));
  assert.doesNotMatch(read('-core', 'DEBIAN/postinst'), /systemctl (start|restart|enable)/);
  assert.match(read('-core', 'usr/share/doc/tastedev-studio-core/README-CORE.txt'), /chmod 0640/);
  const archive = spawnSync(bash, ['-c', 'tar -tzf "$FIXTURE/output/tastedev-studio-0.1.42-linux-x86_64.tar.gz"'], { env: { ...process.env, FIXTURE: unix(root) }, encoding: 'utf8' });
  assert.equal(archive.status, 0, archive.stderr);
  assert.match(archive.stdout, /\/core.env.example\n/);
  assert.match(archive.stdout, /\/README-CORE.txt\n/);
  assert.match(archive.stdout, /\/core\/node\/bin\/node\n/);
  assert.match(read('-agent', 'lib/systemd/system/tastestudio-agent.service'), /ExecStart=\/usr\/bin\/tastestudio-agent --config/);
  const full = read('', 'DEBIAN/control');
  for (const component of ['desktop', 'core', 'agent']) assert.ok(full.includes(`tastedev-studio-${component} (= 0.1.42)`));
  const server = read('-server', 'DEBIAN/control');
  assert.ok(server.includes('tastedev-studio-core (= 0.1.42)'));
  assert.doesNotMatch(server, /studio-desktop/);
});
test('an Agent-only payload cannot be published as a complete Studio package', () => {
  const root = fixture(); fs.unlinkSync(path.join(root, 'payload/tastestudio'));
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refusing an Agent-only/);
});

test('RPM staging preserves dependency paths and isolates the build database', () => {
  const root = fixture();
  const dependency = path.join(root, 'payload/core/node_modules/example/[types]');
  fs.mkdirSync(dependency, { recursive: true });
  fs.writeFileSync(path.join(dependency, 'license notice %{name}.txt'), 'controlled');
  // Real shell staging/spec generation; rpmbuild is intercepted, not claimed as a Linux RPM build.
  fs.writeFileSync(path.join(root, 'bin/rpmbuild'), `#!/bin/bash
set -eu
spec="\${!#}"
top="$(dirname "$(dirname "$spec")")"
name="$(sed -n 's/^Name: //p' "$spec")"
printf '%s\\n' "$@" > "$CAPTURE/$name.args"
cp "$spec" "$CAPTURE/$name.spec"
mkdir -p "$top/RPMS/x86_64"
printf controlled-rpm > "$top/RPMS/x86_64/$name-0.1.42-1.x86_64.rpm"
`, { mode: 0o755 });
  const result = run(root, 'rpm');
  assert.equal(result.status, 0, result.stderr);
  const spec = fs.readFileSync(path.join(root, 'captured/tastedev-studio-core.spec'), 'utf8');
  assert.doesNotMatch(spec, /Requires:.*nodejs/);
  assert.ok(spec.includes('"/usr/lib/tastestudio-core/node/bin/node"'));
  assert.ok(spec.includes('"/usr/lib/tastestudio-core/node_modules/example/[types]/license notice %%{name}.txt"'));
  assert.ok(spec.includes('"/usr/lib/systemd/system/tastestudio-core.service"'));
  for (const component of ['desktop', 'core', 'agent', 'server', '']) {
    const name = `tastedev-studio${component ? '-' + component : ''}`;
    const args = fs.readFileSync(path.join(root, 'captured', `${name}.args`), 'utf8');
    assert.match(args, /_dbpath .*\/rpmdb\n/);
    assert.doesNotMatch(args, /\/var\/lib\/rpm/);
    assert.ok(fs.existsSync(path.join(root, 'output', `${name}-0.1.42-linux-x86_64.rpm`)));
  }
});

test('missing or modified bundled Node is rejected before package creation', () => {
  for (const file of ['bin/node', 'LICENSE']) {
    const root = fixture();
    fs.unlinkSync(path.join(root, 'payload/core/node', file));
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Bundled Node runtime missing/);
    assert.deepEqual(fs.readdirSync(path.join(root, 'output')), []);
  }
  const root = fixture();
  fs.appendFileSync(path.join(root, 'payload/core/node/bin/node'), '# changed');
  const result = run(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /checksum verification failed/);
  assert.deepEqual(fs.readdirSync(path.join(root, 'output')), []);
});
