import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('production Native lifecycle commands are declared and confined to managed local windows',()=>{
  const handlers=read('../src-tauri/src/lib.rs').split('.invoke_handler(tauri::generate_handler![')[1]?.split('])')[0];
  assert(handlers,'Actual Native invocation registry must exist');
  const required=['project_begin','project_prepare','project_cancel','project_environment','git_collaboration','language_start','language_call','language_stop','debug_start','debug_action','debug_stop'];
  const manifest=read('../src-tauri/build.rs');
  const capability=JSON.parse(read('../src-tauri/capabilities/main.json'));
  assert.deepEqual(capability.windows,['main','task-*']);
  assert.equal(capability.remote,undefined,'Do not grant remote website access to Native lifecycle tools');
  for(const command of required){
    assert.match(handlers,new RegExp(`\\b${command}\\b`),'A permission must resolve to an actual implemented handler');
    assert(manifest.includes(`"${command}"`),`${command}: command manifest missing`);
    assert(capability.permissions.includes(`allow-${command.replaceAll('_','-')}`),`${command}: managed window grant missing`);
  }
  assert(!capability.permissions.some((permission:string)=>/shell:|allow-execute|allow-spawn/.test(permission)),'No unrestricted shell capability');
});
