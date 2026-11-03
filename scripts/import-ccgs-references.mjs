/** Read pinned public template documentation as project Source data; never execute upstream code. */
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const commit='05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418';
const source=path.resolve(process.argv[2]??'target/framework-sources/ccgs-20261031');
const git=(...args)=>execFileSync('git',['-C',source,...args],{maxBuffer:16*1024*1024,windowsHide:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
assertCommit();function assertCommit(){if(git('rev-parse','HEAD').toString().trim()!==commit)throw Error('Pinned reference commit mismatch.');}
const files=[];
for(const name of git('ls-tree','-r','--name-only',commit,'--','docs/engine-reference').toString().trim().split('\n').sort()){
 if(!/^docs\/engine-reference\/(?:README\.md|(?:godot|unity|unreal)\/[A-Za-z0-9_./-]+\.md)$/.test(name)||name.split('/').includes('..'))throw Error('Unexpected reference path.');
 const mode=git('ls-tree',commit,'--',name).toString().split(' ')[0];if(mode!=='100644')throw Error('Reference links/executables are not allowed.');
 const bytes=git('show',commit+':'+name);files.push({path:name,sha256:sha(bytes),bytes:bytes.length,content:bytes.toString('base64')});
}
const identity=sha(JSON.stringify(files.map(({path,sha256,bytes})=>({path,sha256,bytes}))));
const record={version:1,repository:'https://github.com/Donchitos/Claude-Code-Game-Studios.git',commit,identity,license:'MIT',licensePath:'LICENSE',scope:'Public engine-reference template files as reviewed snapshot Source data; preserve existing project files and the original definition manifest.',files};
const target=path.resolve('resources/integrations/ccgs',commit,'reference-source.json');
let existing;try{existing=await readFile(target,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
const text=JSON.stringify(record,null,2)+'\n';if(existing!==undefined&&existing!==text)throw Error('Reference source update conflict; do not overwrite existing data.');
if(existing===undefined)await writeFile(target,text,{flag:'wx'});
console.log(JSON.stringify({files:files.length,identity,bytes:files.reduce((n,f)=>n+f.bytes,0)}));
