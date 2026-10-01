import {createHash,randomUUID} from 'node:crypto';
import type {CoreStore} from './storage.ts';

import type {TeamRole,TeamAction} from '../src/features/core/access.ts';
export type {TeamRole,TeamAction} from '../src/features/core/access.ts';

export interface TeamUser {id:string;role:TeamRole;projects:string[];disabled?:boolean}
export interface TeamSession {id:string;userId:string;tokenHash:string;expiresAt:string;revokedAt?:string}
export interface TeamAgent {id:string;tokenHash:string;groups:string[];labels:Record<string,string>;disabled?:boolean}
export interface TeamProject {id:string;agentGroups:string[];maxQueued:number;maxActive:number}
export interface TeamConfiguration {users:TeamUser[];sessions:TeamSession[];agents:TeamAgent[];projects:TeamProject[];maxQueuedPerUser:number;maxActivePerUser:number}
export interface TeamIdentity {userId:string;sessionId:string}
export interface TeamAudit {id:string;timestamp:string;userId:string|null;sessionId:string|null;projectId:string|null;action:TeamAction|'authentication';decision:'allowed'|'denied';target?:string}
interface TeamState {configuration:TeamConfiguration;audit:TeamAudit[];revision:number}
export class TeamAccessError extends Error {constructor(code='TEAM_FORBIDDEN'){super(code);this.name='TeamAccessError';}}
export const teamTokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
const roleActions:Record<TeamRole,readonly TeamAction[]>={
 Owner:['read','run','cancel','ai','approve','history-write','agent-manage','schedule-manage','issue-write','audit','access-manage'],
 Admin:['read','run','cancel','ai','approve','history-write','agent-manage','schedule-manage','issue-write','audit'],
 Developer:['read','run','cancel','ai','approve','history-write','issue-write'],Viewer:['read'],
};
const identifier=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,100}$/.test(v);
const hash=(v:string)=>/^[a-f0-9]{64}$/.test(v);
const bounded=(v:number)=>Number.isSafeInteger(v)&&v>0&&v<=1000;
export function validConfiguration(value:TeamConfiguration){
 if(!value||!['users','sessions','agents','projects'].every(k=>Array.isArray(value[k as 'users'])&&value[k as 'users'].length<=1000)||!bounded(value.maxQueuedPerUser)||!bounded(value.maxActivePerUser))throw new TeamAccessError('TEAM_CONFIG_INVALID');
 for(const rows of [value.users,value.sessions,value.agents,value.projects])if(rows.some(v=>!identifier(v.id))||new Set(rows.map(v=>v.id)).size!==rows.length)throw new TeamAccessError('TEAM_CONFIG_INVALID');
 const projects=new Set(value.projects.map(p=>p.id)),users=new Set(value.users.map(u=>u.id));
 if(!value.users.some(u=>u.role==='Owner'&&!u.disabled)||value.users.some(u=>!Object.hasOwn(roleActions,u.role)||!Array.isArray(u.projects)||u.projects.some(p=>!projects.has(p))||new Set(u.projects).size!==u.projects.length||u.disabled!==undefined&&typeof u.disabled!=='boolean'))throw new TeamAccessError('TEAM_CONFIG_INVALID');
 if(value.sessions.some(s=>!users.has(s.userId)||!hash(s.tokenHash)||!Number.isFinite(Date.parse(s.expiresAt))||s.revokedAt!==undefined&&!Number.isFinite(Date.parse(s.revokedAt)))||new Set(value.sessions.map(s=>s.tokenHash)).size!==value.sessions.length)throw new TeamAccessError('TEAM_CONFIG_INVALID');
 if(value.agents.some(a=>!hash(a.tokenHash)||!Array.isArray(a.groups)||a.groups.length>32||a.groups.some(g=>!identifier(g))||!a.labels||Object.keys(a.labels).length>32||Object.entries(a.labels).some(([k,v])=>!identifier(k)||typeof v!=='string'||v.length>100)||a.disabled!==undefined&&typeof a.disabled!=='boolean')||new Set(value.agents.map(a=>a.tokenHash)).size!==value.agents.length)throw new TeamAccessError('TEAM_CONFIG_INVALID');
 if(value.projects.some(p=>!Array.isArray(p.agentGroups)||p.agentGroups.length>32||p.agentGroups.some(g=>!identifier(g))||!bounded(p.maxQueued)||!bounded(p.maxActive)))throw new TeamAccessError('TEAM_CONFIG_INVALID');
 // Persistent records contain hashes only. Reject accidental credential fields.
 const keys=[['users',['id','role','projects','disabled']],['sessions',['id','userId','tokenHash','expiresAt','revokedAt']],['agents',['id','tokenHash','groups','labels','disabled']],['projects',['id','agentGroups','maxQueued','maxActive']]] as const;
 if(Object.keys(value).some(k=>!['users','sessions','agents','projects','maxQueuedPerUser','maxActivePerUser'].includes(k))||keys.some(([key,allowed])=>value[key].some(row=>Object.keys(row).some(k=>!(allowed as readonly string[]).includes(k)))))throw new TeamAccessError('TEAM_CONFIG_INVALID');
 return structuredClone(value);
}

/** Every decision consults current durable grants. A cached identity is not authority. */
export class TeamAccess {
 private state:TeamState;private store?:CoreStore;private now:()=>number;
 constructor(configuration:TeamConfiguration,store?:CoreStore,now=Date.now){
  const persisted=store?.get<TeamState>('team-access');this.store=store;this.now=now;
  this.state=persisted?{...persisted,configuration:validConfiguration(persisted.configuration)}:{configuration:validConfiguration(configuration),audit:[],revision:0};
  if(!Array.isArray(this.state.audit)||this.state.audit.length>10000||!Number.isSafeInteger(this.state.revision))throw new TeamAccessError('TEAM_STATE_INVALID');
  if(!persisted)this.commit(this.state);
 }
 private commit(next:TeamState){this.store?.put('team-access',next);this.state=next;}
 private record(identity:TeamIdentity|null,projectId:string|null,action:TeamAudit['action'],decision:TeamAudit['decision'],target?:string){
  const row:TeamAudit={id:randomUUID(),timestamp:new Date(this.now()).toISOString(),userId:identity?.userId??null,sessionId:identity?.sessionId??null,projectId,action,decision,...(target&&identifier(target)?{target}:{})};
  this.commit({...this.state,audit:[...this.state.audit.slice(-9999),row],revision:this.state.revision+1});
 }
 private current(identity:TeamIdentity){
  const session=this.state.configuration.sessions.find(s=>s.id===identity.sessionId&&s.userId===identity.userId);
  const user=this.state.configuration.users.find(u=>u.id===identity.userId);
  if(!session||!user||user.disabled||session.revokedAt||Date.parse(session.expiresAt)<=this.now())throw new TeamAccessError('TEAM_SESSION_EXPIRED_OR_REVOKED');
  return user;
 }
 authenticate(token:unknown){
  if(typeof token!=='string'||token.length<16||token.length>512){this.record(null,null,'authentication','denied');throw new TeamAccessError('TEAM_AUTHENTICATION_FAILED');}
  const session=this.state.configuration.sessions.find(s=>s.tokenHash===teamTokenHash(token));
  const identity=session?{sessionId:session.id,userId:session.userId}:null;
  try{if(!identity)throw new TeamAccessError('TEAM_AUTHENTICATION_FAILED');this.current(identity);this.record(identity,null,'authentication','allowed');return identity;}
  catch(error){this.record(identity,null,'authentication','denied');throw error;}
 }
 require(identity:TeamIdentity,projectId:string|null,action:TeamAction,target?:string){
  try{const user=this.current(identity);if(!roleActions[user.role].includes(action)||projectId!==null&&(!this.state.configuration.projects.some(p=>p.id===projectId)||!user.projects.includes(projectId))||projectId===null&&!['access-manage','audit'].includes(action))throw new TeamAccessError();this.record(identity,projectId,action,'allowed',target);return user;}
  catch(error){this.record(identity,projectId,action,'denied',target);throw error;}
 }
 permits(identity:TeamIdentity,projectId:string,action:TeamAction){try{const user=this.current(identity);return roleActions[user.role].includes(action)&&user.projects.includes(projectId)&&this.state.configuration.projects.some(p=>p.id===projectId);}catch{return false;}}
 describe(identity:TeamIdentity,projectId:string){const user=this.require(identity,projectId,'read');return{mode:'team' as const,userId:user.id,role:user.role,projectId,actions:roleActions[user.role].filter(a=>this.permits(identity,projectId,a)),revision:this.state.revision};}
 update(identity:TeamIdentity,configuration:TeamConfiguration){this.require(identity,null,'access-manage');const next=validConfiguration(configuration);if(!next.users.some(u=>u.id===identity.userId&&u.role==='Owner'&&!u.disabled)||!next.sessions.some(s=>s.id===identity.sessionId&&s.userId===identity.userId&&!s.revokedAt&&Date.parse(s.expiresAt)>this.now()))throw new TeamAccessError('TEAM_LAST_OWNER_PROTECTION');this.commit({...this.state,configuration:next,revision:this.state.revision+1});}
 configuration(identity:TeamIdentity){this.require(identity,null,'access-manage');return structuredClone(this.state.configuration);}
 audit(identity:TeamIdentity,projectId:string|null){this.require(identity,projectId,'audit');const user=this.current(identity);return structuredClone(this.state.audit.filter(r=>user.role==='Owner'||r.projectId!==null&&user.projects.includes(r.projectId)));}
 authenticateAgent(agentId:string,token:unknown){const agent=this.state.configuration.agents.find(a=>a.id===agentId&&!a.disabled);if(typeof token!=='string'||token.length<16||token.length>512||!agent||agent.tokenHash!==teamTokenHash(token))throw new TeamAccessError('TEAM_AGENT_AUTHENTICATION_FAILED');return structuredClone(agent);}
 allowedAgent(projectId:string,agentId:string){const project=this.state.configuration.projects.find(p=>p.id===projectId),agent=this.state.configuration.agents.find(a=>a.id===agentId&&!a.disabled);return !!project&&!!agent&&project.agentGroups.some(g=>agent.groups.includes(g));}
 validAgentSession(agentId:string,tokenHash:string){return this.state.configuration.agents.some(a=>a.id===agentId&&!a.disabled&&a.tokenHash===tokenHash);}
 limits(projectId:string){const project=this.state.configuration.projects.find(p=>p.id===projectId);if(!project)throw new TeamAccessError();return{queued:project.maxQueued,active:project.maxActive,userQueued:this.state.configuration.maxQueuedPerUser,userActive:this.state.configuration.maxActivePerUser};}
}
