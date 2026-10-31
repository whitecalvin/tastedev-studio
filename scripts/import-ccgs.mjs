/** Import only Git blobs: never checkout, execute hooks, fetch main, or overwrite edits. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
export const repository='https://github.com/Donchitos/Claude-Code-Game-Studios.git';
export const commit='05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=path.resolve(process.argv[2]??'target/framework-sources/ccgs-20261031');
const root=path.resolve('resources/integrations/ccgs',commit);
const git=(...args)=>execFileSync('git',['-C',source,...args],{maxBuffer:32*1024*1024,windowsHide:true});
if(git('rev-parse','HEAD').toString().trim()!==commit)throw Error('Pinned commit mismatch.');
const names=git('ls-tree','-r','--name-only',commit).toString().trim().split('\n').filter(p=>p.startsWith('.claude/')||['CLAUDE.md','project.yaml','LICENSE','README.md','UPGRADING.md'].includes(p)).sort();
const files=[],entries=[],runtimeFiles=[],normalizedFiles=[];const normalize=bytes=>{const text=bytes.toString('utf8');if(!Buffer.from(text).equals(bytes))return bytes;return Buffer.from(text.replace(/[ \t]+(?=\r?$)/gm,'').replace(/(?:\r?\n)+$/,'\n'));};
for(const name of names){
 if(!/^[A-Za-z0-9_. /-]+$/.test(name)||name.split('/').some(p=>!p||p==='..'))throw Error('Unsafe upstream path.');
 const mode=git('ls-tree',commit,'--',name).toString().split(' ')[0];
 if(mode!=='100644'&&mode!=='100755')throw Error('Links and submodules are not supported.');
 const bytes=git('show',commit+':'+name),file=path.join(root,'original',name);
 let old;try{old=await readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}
 const display=normalize(bytes);if(old&&!old.equals(bytes)&&!old.equals(display))throw Error('UPDATE_CONFLICT: '+name);
 await mkdir(path.dirname(file),{recursive:true});if(!old)await writeFile(file,display,{flag:'wx'});else if(!old.equals(display))await writeFile(file,display);if(!display.equals(bytes))normalizedFiles.push({path:name,sourceChecksum:sha(bytes),displayChecksum:sha(display),displayBytes:display.length});
 const text=bytes.toString('utf8'),record={path:name,sha256:sha(bytes),bytes:bytes.length,mode};files.push(record);runtimeFiles.push({...record,content:bytes.toString('base64')});
 const kind=name.startsWith('.claude/agents/')?'role':/^\.claude\/skills\/[^/]+\/SKILL.md$/.test(name)?'skill':name.startsWith('.claude/rules/')?'rule':name.startsWith('.claude/hooks/')?'hook':name.endsWith('workflow-catalog.yaml')?'workflow':null;
 if(kind){const match=text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/),frontmatter=match?yaml.load(match[1],{schema:yaml.JSON_SCHEMA}):{};
 entries.push({id:kind+':'+(kind==='skill'?name.split('/')[2]:path.posix.basename(name).replace(/\.[^.]+$/,'')),kind,path:name,sha256:sha(bytes),frontmatter:frontmatter??{},raw:text});}
}
const identity=sha(JSON.stringify(files)),manifest={version:1,repository,commit,identity,license:'MIT',licensePath:'LICENSE',files};
const catalog={version:1,repository,commit,identity,entries,projectYaml:git('show',commit+':project.yaml').toString(),claudeMd:git('show',commit+':CLAUDE.md').toString(),license:git('show',commit+':LICENSE').toString()};
const runtimeBundle={version:1,commit,identity,files:runtimeFiles};
for(const [name,value] of [['manifest.json',manifest],['catalog.json',catalog],['runtime-bundle.json',runtimeBundle],['display-normalization.json',{version:1,commit,identity,policy:'Only inspection mirrors remove trailing whitespace and extra EOF blank lines. Runtime/catalog retain original bytes.',files:normalizedFiles}]]){
 const file=path.join(root,name),bytes=JSON.stringify(value,null,2)+'\n';let old;try{old=await readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}if(old!==undefined&&old!==bytes&&JSON.stringify(JSON.parse(old))!==JSON.stringify(value))throw Error('UPDATE_CONFLICT: '+name);if(old===undefined)await writeFile(file,bytes,{flag:'wx'});
}
console.log(JSON.stringify({commit,identity,files:files.length,entries:entries.reduce((a,e)=>(a[e.kind]=(a[e.kind]??0)+1,a),{})}));
