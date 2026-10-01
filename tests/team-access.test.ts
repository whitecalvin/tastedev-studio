import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {TeamAccess,teamTokenHash,type TeamConfiguration,type TeamRole} from '../transport/team-access.ts';
import {CoreStore} from '../transport/storage.ts';
const token=(id:string)=>`Dummy-Team-Session-${id}-20261001`;
function configuration():TeamConfiguration{return{
 users:['Owner','Admin','Developer','Viewer'].map(role=>({id:role,role:role as TeamRole,projects:role==='Owner'?['alpha','beta']:['alpha']})),
 sessions:['Owner','Admin','Developer','Viewer'].map(userId=>({id:`session-${userId}`,userId,tokenHash:teamTokenHash(token(userId)),expiresAt:'2099-01-01T00:00:00.000Z'})),
 projects:[{id:'alpha',agentGroups:['a'],maxQueued:3,maxActive:1},{id:'beta',agentGroups:['b'],maxQueued:3,maxActive:1}],
 agents:[{id:'agent-a',tokenHash:teamTokenHash(token('agent-a')),groups:['a'],labels:{zone:'local'}},{id:'agent-b',tokenHash:teamTokenHash(token('agent-b')),groups:['b'],labels:{zone:'local'}}],
 maxQueuedPerUser:2,maxActivePerUser:1,
};}
for(const role of ['Owner','Admin','Developer','Viewer'] as const)test(`team ${role} matrix is enforced by the service`,()=>{
 const access=new TeamAccess(configuration()),identity=access.authenticate(token(role));
 assert.equal(access.describe(identity,'alpha').role,role);
 access.require(identity,'alpha','read');
 for(const action of ['run','cancel','ai','approve','history-write','issue-write'] as const){if(role==='Viewer')assert.throws(()=>access.require(identity,'alpha',action),/TEAM_FORBIDDEN/);else access.require(identity,'alpha',action);}
 for(const action of ['agent-manage','schedule-manage','audit'] as const){if(role==='Viewer'||role==='Developer')assert.throws(()=>access.require(identity,'alpha',action),/TEAM_FORBIDDEN/);else access.require(identity,'alpha',action);}
 if(role==='Owner')access.configuration(identity);else assert.throws(()=>access.configuration(identity),/TEAM_FORBIDDEN/);
});
test('cross project IDs and forged identity never grant authority',()=>{
 const access=new TeamAccess(configuration()),identity=access.authenticate(token('Developer'));
 assert.throws(()=>access.require(identity,'beta','read'),/TEAM_FORBIDDEN/);
 assert.throws(()=>access.require({...identity,userId:'Owner'},'alpha','approve'),/TEAM_SESSION/);
 assert.throws(()=>access.require(identity,'unknown','read'),/TEAM_FORBIDDEN/);
});
test('role reduction revokes cached approval authority immediately',()=>{
 const access=new TeamAccess(configuration()),owner=access.authenticate(token('Owner')),developer=access.authenticate(token('Developer'));
 access.require(developer,'alpha','approve','proposal-1');const next=access.configuration(owner);next.users.find(u=>u.id==='Developer')!.role='Viewer';access.update(owner,next);
 assert.throws(()=>access.require(developer,'alpha','approve','proposal-1'),/TEAM_FORBIDDEN/);
 access.require(developer,'alpha','read');
});
test('membership removal protects the same authenticated identity',()=>{
 const access=new TeamAccess(configuration()),owner=access.authenticate(token('Owner')),developer=access.authenticate(token('Developer'));
 const next=access.configuration(owner);next.users.find(u=>u.id==='Developer')!.projects=[];access.update(owner,next);
 assert.equal(access.permits(developer,'alpha','read'),false);assert.throws(()=>access.describe(developer,'alpha'),/TEAM_FORBIDDEN/);
});
test('expiry and revocation apply without a reconnect',()=>{
 let now=Date.parse('2026-10-01T00:00:00Z');const next=configuration();next.sessions.find(s=>s.userId==='Developer')!.expiresAt=new Date(now+1000).toISOString();const access=new TeamAccess(next,undefined,()=>now),owner=access.authenticate(token('Owner')),developer=access.authenticate(token('Developer'));
 now+=1000;assert.throws(()=>access.require(developer,'alpha','read'),/TEAM_SESSION/);assert.throws(()=>access.authenticate(token('Developer')),/TEAM_SESSION/);
 const revised=access.configuration(owner);revised.sessions.find(s=>s.userId==='Admin')!.revokedAt=new Date(now).toISOString();access.update(owner,revised);assert.throws(()=>access.authenticate(token('Admin')),/TEAM_SESSION/);
});
test('disabled user and agent tokens are rejected',()=>{
 const next=configuration();next.users.find(u=>u.id==='Viewer')!.disabled=true;next.agents[0].disabled=true;const access=new TeamAccess(next);
 assert.throws(()=>access.authenticate(token('Viewer')),/TEAM_SESSION/);assert.throws(()=>access.authenticateAgent('agent-a',token('agent-a')),/TEAM_AGENT/);assert.equal(access.allowedAgent('alpha','agent-a'),false);
});
test('Agent identity, trusted groups and project limits are explicit',()=>{
 const access=new TeamAccess(configuration());assert.equal(access.authenticateAgent('agent-a',token('agent-a')).groups[0],'a');assert.throws(()=>access.authenticateAgent('agent-b',token('agent-a')),/TEAM_AGENT/);
 assert.equal(access.allowedAgent('alpha','agent-a'),true);assert.equal(access.allowedAgent('alpha','agent-b'),false);assert.equal(access.allowedAgent('beta','agent-b'),true);assert.deepEqual(access.limits('alpha'),{queued:3,active:1,userQueued:2,userActive:1});
});
test('Agent credential replacement invalidates old authenticated execution authority',()=>{
 const access=new TeamAccess(configuration()),owner=access.authenticate(token('Owner')),old=teamTokenHash(token('agent-a'));assert.equal(access.validAgentSession('agent-a',old),true);
 const next=access.configuration(owner);next.agents[0].tokenHash=teamTokenHash(token('rotated-agent'));access.update(owner,next);
 assert.equal(access.validAgentSession('agent-a',old),false);assert.throws(()=>access.authenticateAgent('agent-a',token('agent-a')),/TEAM_AGENT/);assert.equal(access.validAgentSession('agent-a',next.agents[0].tokenHash),true);
});
test('bootstrap and updates reject unbounded or secret-bearing configuration',()=>{
 const next=configuration();next.maxQueuedPerUser=0;assert.throws(()=>new TeamAccess(next),/TEAM_CONFIG/);
 const bad=configuration();Object.assign(bad.sessions[0],{token:token('Owner')});assert.throws(()=>new TeamAccess(bad),/TEAM_CONFIG/);
 const duplicate=configuration();duplicate.sessions[1].tokenHash=duplicate.sessions[0].tokenHash;assert.throws(()=>new TeamAccess(duplicate),/TEAM_CONFIG/);
});
test('the last active Owner and current administration session are protected',()=>{
 const access=new TeamAccess(configuration()),owner=access.authenticate(token('Owner'));const next=access.configuration(owner);next.users[0].role='Viewer';assert.throws(()=>access.update(owner,next),/TEAM_CONFIG|TEAM_LAST_OWNER/);
 const revoked=access.configuration(owner);revoked.sessions[0].revokedAt='2026-10-01T00:00:00Z';assert.throws(()=>access.update(owner,revoked),/TEAM_LAST_OWNER/);
});
test('audit access is project scoped and does not expose tokens',()=>{
 const access=new TeamAccess(configuration()),owner=access.authenticate(token('Owner')),admin=access.authenticate(token('Admin'));
 access.require(owner,'beta','approve','proposal-beta');assert.throws(()=>access.authenticate('invalid'),/TEAM_AUTH/);
 assert.ok(access.audit(owner,null).some(a=>a.projectId==='beta'));assert.ok(access.audit(admin,'alpha').every(a=>a.projectId==='alpha'));
 assert.ok(!JSON.stringify(access.audit(owner,null)).includes(token('Owner')));
});
test('durable grants, revocation and audit survive restart without restoring bootstrap grants',()=>{
 const directory=path.resolve('../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-6/unit',randomUUID());fs.mkdirSync(directory,{recursive:true});const filename=path.join(directory,'access.sqlite');
 const store=new CoreStore(filename,Buffer.alloc(32,7));const access=new TeamAccess(configuration(),store),owner=access.authenticate(token('Owner'));const next=access.configuration(owner);next.sessions.find(s=>s.userId==='Developer')!.revokedAt='2026-10-01T00:00:00Z';access.update(owner,next);store.close();
 const reopened=new CoreStore(filename,Buffer.alloc(32,7));try{const restored=new TeamAccess(configuration(),reopened);assert.throws(()=>restored.authenticate(token('Developer')),/TEAM_SESSION/);assert.ok(restored.audit(restored.authenticate(token('Owner')),null).length>0);}finally{reopened.close();}
 assert.ok(!fs.readFileSync(filename).includes(Buffer.from(token('Owner'))));
});
