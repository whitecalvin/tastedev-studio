import type {TeamConfiguration} from './team-access.ts';
import {validConfiguration} from './team-access.ts';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

export class ConfigError extends Error { code:string;constructor(code:string){super(code);this.code=code;} }
export interface RuntimeConfig {accessMode:'local-single-user'|'team';team?:TeamConfiguration;host:string;port:number;agentToken:string;studioToken:string;allowLan:boolean;tlsProxy:boolean;origins:string[];dataDir:string;logDir:string;storagePath:string;schedulePath:string;artifactRoot:string;artifactBaseUrl?:string;heartbeatTimeoutMs:number;shutdownTimeoutMs:number;logMaxBytes:number;logFiles:number}
export function runtimeConfig(env:Record<string,string|undefined>=process.env,platform=process.platform,requireCredentials=true,legacyPath=fileURLToPath(new URL('../../../../resources/runtime/tastedev-studio/core.sqlite',import.meta.url))):RuntimeConfig {
 const paths=platform==='win32'?path.win32:path.posix;
 const filename=env.CORE_CONFIG;let file:Record<string,unknown>={};
 if(filename){if(!path.isAbsolute(filename))throw new ConfigError('CONFIG_PATH_ABSOLUTE_REQUIRED');try{file=JSON.parse(fs.readFileSync(filename,'utf8'));}catch{throw new ConfigError('CONFIG_READ_FAILED');}if(!file||typeof file!=='object'||Array.isArray(file))throw new ConfigError('CONFIG_OBJECT_REQUIRED');}
 const names:Record<string,string>={accessMode:'CORE_ACCESS_MODE',teamConfig:'CORE_TEAM_CONFIG',host:'CORE_HOST',port:'CORE_PORT',allowLan:'CORE_ALLOW_LAN',tlsProxy:'CORE_TLS_PROXY',origins:'CORE_ORIGINS',dataDir:'CORE_DATA_DIR',logDir:'CORE_LOG_DIR',storagePath:'CORE_STORAGE_PATH',schedulePath:'CORE_SCHEDULE_PATH',artifactRoot:'CORE_ARTIFACT_ROOT',artifactBaseUrl:'CORE_ARTIFACT_BASE_URL',heartbeatTimeoutMs:'CORE_HEARTBEAT_TIMEOUT_MS',shutdownTimeoutMs:'CORE_SHUTDOWN_TIMEOUT_MS',logMaxBytes:'CORE_LOG_MAX_BYTES',logFiles:'CORE_LOG_FILES'};
 if(Object.keys(file).some(k=>!Object.hasOwn(names,k)))throw new ConfigError('CONFIG_UNKNOWN_FIELD');
 const value=(key:string,fallback:unknown)=>env[names[key]]??file[key]??fallback;
 const integer=(key:string,fallback:number,min:number,max:number)=>{const v=value(key,fallback);if((typeof v!=='number'&&typeof v!=='string')||String(v).trim()===''||!/^\d+$/.test(String(v)))throw new ConfigError(`CONFIG_${key.toUpperCase()}_INVALID`);const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)throw new ConfigError(`CONFIG_${key.toUpperCase()}_INVALID`);return n;};
 const flag=(key:string)=>{const v=value(key,false);if(![false,true,'0','1'].includes(v as boolean))throw new ConfigError(`CONFIG_${key.toUpperCase()}_INVALID`);return v===true||v==='1';};
 const absolute=(key:string,fallback:string)=>{const v=value(key,fallback);if(typeof v!=='string'||!paths.isAbsolute(v)||v.includes('\0'))throw new ConfigError(`CONFIG_${key.toUpperCase()}_ABSOLUTE_REQUIRED`);return paths.resolve(v);};
 const defaults=platform==='win32'?paths.join(env.ProgramData??'C:/ProgramData','TASTESTUDIO','Core'):platform==='linux'?'/var/lib/tastestudio-core':paths.join(os.homedir(),'.local/share/tastestudio-core');
 const dataDir=absolute('dataDir',defaults),logDir=absolute('logDir',platform==='linux'?'/var/log/tastestudio-core':paths.join(dataDir,'logs'));
 const host=value('host','127.0.0.1');if(typeof host!=='string'||!host||host.length>253||/[\s/\\]/.test(host))throw new ConfigError('CONFIG_HOST_INVALID');
 const accessMode=value('accessMode','local-single-user');if(!['local-single-user','team'].includes(String(accessMode)))throw new ConfigError('CONFIG_ACCESS_MODE_INVALID');
 let team:TeamConfiguration|undefined;const teamFile=value('teamConfig',undefined);if(accessMode==='team'){if(typeof teamFile!=='string'||!paths.isAbsolute(teamFile))throw new ConfigError('TEAM_CONFIG_ABSOLUTE_REQUIRED');let parsed:TeamConfiguration;try{parsed=JSON.parse(fs.readFileSync(teamFile,'utf8'));}catch{throw new ConfigError('TEAM_CONFIG_READ_FAILED');}try{team=validConfiguration(parsed);}catch{throw new ConfigError('TEAM_CONFIG_INVALID');}}else if(teamFile!==undefined)throw new ConfigError('TEAM_CONFIG_REQUIRES_TEAM_MODE');
 const allowLan=flag('allowLan'),tlsProxy=flag('tlsProxy');if(!['127.0.0.1','::1','localhost'].includes(host)&&(!allowLan||!tlsProxy))throw new ConfigError('REMOTE_REQUIRES_ALLOW_LAN_AND_TLS_PROXY');
 const agentToken=env.CORE_AGENT_TOKEN??'',studioToken=env.CORE_STUDIO_TOKEN??'';if(requireCredentials&&([agentToken,studioToken].some(t=>t.length<16||t.length>512)||agentToken===studioToken))throw new ConfigError('DISTINCT_AGENT_STUDIO_TOKENS_REQUIRED');
 const rawOrigins=value('origins',['http://127.0.0.1:4317','http://localhost:4317','http://127.0.0.1:4320','http://localhost:4320','http://127.0.0.1:4330','http://tauri.localhost','https://tauri.localhost','tauri://localhost']);
 const origins=typeof rawOrigins==='string'?rawOrigins.split(','):rawOrigins;
 if(!Array.isArray(origins)||!origins.length||origins.length>32||origins.some(v=>{if(typeof v!=='string')return true;try{const u=new URL(v);return !['http:','https:','tauri:'].includes(u.protocol)||!!u.username||!!u.password||!['','/'].includes(u.pathname)||!!u.search||!!u.hash;}catch{return true;}}))throw new ConfigError('CONFIG_ORIGINS_INVALID');
 const base=value('artifactBaseUrl',undefined);if(base!==undefined){try{const u=new URL(String(base));if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error();}catch{throw new ConfigError('CONFIG_ARTIFACT_BASE_URL_INVALID');}}
 if(allowLan&&(!base||new URL(String(base)).protocol!=='https:'))throw new ConfigError('REMOTE_HTTPS_ARTIFACT_URL_REQUIRED');
 if(platform===process.platform&&!env.CORE_STORAGE_PATH&&!env.CORE_DATA_DIR&&!file.storagePath&&!file.dataDir&&fs.existsSync(legacyPath))throw new ConfigError('LEGACY_STORAGE_REQUIRES_EXPLICIT_PATH');
 return {accessMode:accessMode as 'local-single-user'|'team',...(team?{team}:{}),host,port:integer('port',4340,1,65535),agentToken,studioToken,allowLan,tlsProxy,origins,dataDir,logDir,storagePath:absolute('storagePath',paths.join(dataDir,'core.sqlite')),schedulePath:absolute('schedulePath',paths.join(dataDir,'schedules.json')),artifactRoot:absolute('artifactRoot',paths.join(dataDir,'artifacts')),...(base?{artifactBaseUrl:String(base)}:{}),heartbeatTimeoutMs:integer('heartbeatTimeoutMs',15000,1000,300000),shutdownTimeoutMs:integer('shutdownTimeoutMs',15000,100,120000),logMaxBytes:integer('logMaxBytes',1048576,4096,16777216),logFiles:integer('logFiles',5,1,30)};
}
