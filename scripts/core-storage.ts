import path from 'node:path';import {backupCore,restoreCore} from '../transport/backup.ts';import {runtimeConfig} from '../transport/runtime-config.ts';
const [action,target]=process.argv.slice(2);
if(action==='backup'&&target){const config=runtimeConfig(process.env,process.platform,false);const m=await backupCore(config.storagePath,config.artifactRoot,path.resolve(target));console.log(JSON.stringify({result:'backup-complete',files:m.files.length,artifactCount:m.artifactCount}));}
else if(action==='restore'&&target&&process.argv[4])console.log(JSON.stringify(await restoreCore(path.resolve(target),path.resolve(process.argv[4]))));
else throw Error('Usage: pnpm core:storage backup <new-directory> | restore <backup-directory> <new-directory>. Stop Core first.');
