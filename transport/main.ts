import { startCoreServer } from './server.ts';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const server=await startCoreServer({storagePath:process.env.CORE_STORAGE_PATH??path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../resources/runtime/tastedev-studio/core.sqlite'),schedulePath:process.env.CORE_SCHEDULE_PATH??path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../resources/runtime/tastedev-studio/schedules.json'),artifactRoot:process.env.CORE_ARTIFACT_ROOT,artifactBaseUrl:process.env.CORE_ARTIFACT_BASE_URL,host:process.env.CORE_HOST??'127.0.0.1',port:Number(process.env.CORE_PORT??4340),agentToken:process.env.CORE_AGENT_TOKEN??'',studioToken:process.env.CORE_STUDIO_TOKEN??'',allowLan:process.env.CORE_ALLOW_LAN==='1',...(process.env.CORE_ORIGINS?{origins:process.env.CORE_ORIGINS.split(',')}:{}),heartbeatTimeoutMs:Number(process.env.CORE_HEARTBEAT_TIMEOUT_MS??15000)});
console.log(`TASTEDEV Core listening on port ${server.port}; SQLite-backed execution, scheduler and review history.`);
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>void server.close().then(()=>process.exit(0)));
