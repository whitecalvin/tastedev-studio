import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/bash';
const unix=(value:string)=>value.replaceAll('\\','/').replace(/^([A-Za-z]):/,(_,drive:string)=>`/${drive.toLowerCase()}`);
const base=path.resolve('../../../resources/verification/dev-01/tasks/tastedev-studio/linux-node-preflight-20261006/fixtures');
function fixture(){
 fs.mkdirSync(base,{recursive:true});const root=fs.mkdtempSync(path.join(base,'runtime-'));
 const bin=path.join(root,'.nvm/versions/node/v24.11.1/bin');fs.mkdirSync(bin,{recursive:true});
 fs.writeFileSync(path.join(bin,'node'),'#!/bin/sh\nexec "$FIXTURE_NODE" "$@"\n');
 fs.writeFileSync(path.join(bin,'pnpm'),'#!/bin/sh\necho unexpected-package-execution >&2\nexit 99\n');
 return{root,bin};
}
function check(root:string,extra=''){
 return spawnSync(bash,['-c',`chmod +x "$FIXTURE_HOME/.nvm/versions/node/v24.11.1/bin/"*; export HOME="$FIXTURE_HOME" NVM_DIR="$FIXTURE_HOME/.nvm" PATH=/usr/bin:/bin; unset TASTESTUDIO_NODE; ${extra} bash scripts/prepare-linux-release.sh --check-runtime`],{encoding:'utf8',env:{...process.env,FIXTURE_HOME:unix(root),FIXTURE_NODE:unix(process.execPath),MSYS_NO_PATHCONV:'1'}});
}
test('noninteractive preparation finds installed nvm Node and pnpm without building or installing',()=>{
 const {root}=fixture(),result=check(root);assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/Linux frontend runtime: v24\./);assert.match(result.stdout,/package manager: pnpm/);
 assert.doesNotMatch(result.stderr,/unexpected-package-execution/);
});
test('explicit invalid runtime never silently falls back to an installed nvm runtime',()=>{
 const {root}=fixture(),result=check(root,'export TASTESTUDIO_NODE=/definitely/missing/node;');
 assert.equal(result.status,127);assert.match(result.stderr,/absolute executable path/);
});
test('incompatible installed Node gives actionable runtime guidance without starting package gates',()=>{
 const {root,bin}=fixture();fs.writeFileSync(path.join(bin,'node'),'#!/bin/sh\nexit 1\n');
 const result=check(root);assert.equal(result.status,127);assert.match(result.stderr,/No compatible installed runtime/);
 assert.match(result.stderr,/Completed Cargo\/Windows gates need not be repeated/);
});
