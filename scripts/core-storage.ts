import path from 'node:path';import {fileURLToPath} from 'node:url';import {backupCore,restoreCore} from '../transport/backup.ts';
const runtime=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../../resources/runtime/tastedev-studio');const [action,target]=process.argv.slice(2);
if(action==='backup'&&target){const m=await backupCore(process.env.CORE_STORAGE_PATH??path.join(runtime,'core.sqlite'),process.env.CORE_ARTIFACT_ROOT??path.resolve(runtime,'../../artifacts/tastedev-studio'),path.resolve(target));console.log(JSON.stringify({result:'backup-complete',files:m.files.length,artifactCount:m.artifactCount}));}
else if(action==='restore'&&target&&process.argv[4])console.log(JSON.stringify(await restoreCore(path.resolve(target),path.resolve(process.argv[4]))));
else throw Error('Usage: pnpm core:storage backup <new-directory> | restore <backup-directory> <new-directory>. Stop Core first.');
