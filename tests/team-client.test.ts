import test from 'node:test';
import assert from 'node:assert/strict';
import {coreAccess,accessFeedback,accessDeniedMessage,sessionExpiredMessage,teamActions,teamRoles} from '../src/features/core/access.ts';
import {teamMessages} from '../src/i18n/team.ts';
import {runtimeConfig} from '../transport/runtime-config.ts';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
test('untrusted access descriptions reject cross-project, unknown and duplicate actions',()=>{
 const value={mode:'team',userId:'viewer',role:'Viewer',projectId:'a',actions:['read'],revision:1};
 assert.deepEqual(coreAccess(value,'a'),value);
 for(const changed of [{projectId:'b'},{role:'Root'},{actions:['shell']},{actions:['read','read']},{revision:-1}])assert.throws(()=>coreAccess({...value,...changed},'a'));
 assert.equal(accessFeedback('TEAM_FORBIDDEN'),accessDeniedMessage);assert.equal(accessFeedback('TEAM_SESSION_EXPIRED'),sessionExpiredMessage);assert.equal(accessFeedback('Provider timeout'),'Provider timeout');
});
test('all team roles, actions and refusal notices have all supported translations',()=>{
 for(const locale of ['ko','de','es','fr','it','pt','ja','zh','zh-hant'] as const){const messages=teamMessages[locale]!;for(const role of teamRoles)assert.ok(messages[role]);assert.ok(messages[accessDeniedMessage]);assert.ok(messages[sessionExpiredMessage]);assert.equal(teamActions.length,11);assert.ok(Object.values(messages).every(value=>typeof value==='string'&&value.length>0));}
});
test('bootstrap malformed team configuration fails before opening Core storage',()=>{
 const root=path.resolve('../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-6/config',randomUUID());fs.mkdirSync(root,{recursive:true});const file=path.join(root,'invalid-team.json');fs.writeFileSync(file,JSON.stringify({users:[]}));
 assert.throws(()=>runtimeConfig({CORE_ACCESS_MODE:'team',CORE_TEAM_CONFIG:file,CORE_DATA_DIR:root,CORE_AGENT_TOKEN:'Dummy-agent-team-config',CORE_STUDIO_TOKEN:'Dummy-studio-team-config'}),/TEAM_CONFIG_INVALID/);
 assert.equal(fs.existsSync(path.join(root,'core.sqlite')),false);
});
