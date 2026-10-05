import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const output = process.argv[2];
if (!output) throw Error('Usage: node scripts/prepare-core-runtime.mjs OUTPUT');
const toolRoot = process.env.TASTESTUDIO_RELEASE_RESOURCES ?? resolve('../tools/cross-platform-release/service-runtime');
const { bundle } = await import(pathToFileURL(resolve(toolRoot, 'New-NodeRuntimeBundle.mjs')).href);
// 임의의 폴더나 이전 묶음으로 조용히 대체하지 않는다. 공용 도구가 신규 출력과 checksum을 보장한다.
if (!existsSync('transport/main.ts')) throw Error('Core entry point missing');
const manifest = bundle(process.cwd(), output, ['transport', 'src', 'package.json', 'browser-runner'], ['ws', 'js-yaml', 'cron-parser']);
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
console.log(JSON.stringify({ component: 'TASTESTUDIO Core', version, files: manifest.length }));
