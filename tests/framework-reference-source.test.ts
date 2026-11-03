import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifiedReferenceFiles,referenceSourceIdentity} from '../src/features/frameworks/reference-source.ts';
import {frameworkGameSnapshot} from '../src/features/frameworks/source.ts';
import {buildProjectSnapshot} from '../src/features/ai/project-snapshot.ts';
const identity=()=>({projectId:crypto.randomUUID(),proposalId:crypto.randomUUID(),attempt:1,baseRevision:'saved-working-tree',changedFiles:[]});
function source(rows:Map<string,string>){return{list:async(dir='')=>{const result=new Map<string,{path:string;name:string;kind:'directory'|'file'}>();for(const p of rows.keys()){if(dir&&!p.startsWith(dir+'/'))continue;const rest=dir?p.slice(dir.length+1):p,name=rest.split('/')[0],full=dir?dir+'/'+name:name;result.set(full,{path:full,name,kind:rest.includes('/')?'directory':'file'});}return [...result.values()];},read:async(p:string)=>{const content=rows.get(p);assert.notEqual(content,undefined,'Only current project files may be read from disk');return{content:content!,size:Buffer.byteLength(content!),modified:0};},readBytes:async(p:string)=>{assert(rows.has(p));return Buffer.from(rows.get(p)!);}};}
test('pinned public reference sources retain all 46 exact files and reject content or manifest tampering',async()=>{
 const references=await verifiedReferenceFiles();assert.equal(references.length,46);for(const engine of ['godot','unity','unreal'])assert(references.some(f=>f.path==='docs/engine-reference/'+engine+'/VERSION.md'));
 const raw=JSON.parse(await readFile('resources/integrations/ccgs/05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418/reference-source.json','utf8'));assert.equal(raw.identity,referenceSourceIdentity);
 const changed=structuredClone(raw);changed.files[0].content=Buffer.from('changed public reference').toString('base64');await assert.rejects(verifiedReferenceFiles(changed),/checksum/);
 const escaped=structuredClone(raw);escaped.files[0].path='../escape.md';await assert.rejects(verifiedReferenceFiles(escaped),/manifest|path/);
});
test('framework snapshot supplies missing engine references with source provenance while preserving saved user edits and secret exclusions',async()=>{
 const edited='docs/engine-reference/godot/VERSION.md';
 const rows=new Map([['src/player.gd','extends Node2D\n# saved user change\n'],[edited,'# User reviewed custom engine pin\n'],['.env','API_KEY=DUMMY_FRAMEWORK_REFERENCE_EXCLUDED_ONLY\n']]);
 const files=source(rows),id=identity(),plain=await buildProjectSnapshot(files,id),built=await frameworkGameSnapshot(files,id);
 assert.equal(rows.size,3,'Snapshot preparation never writes original Source');assert.notEqual(built.snapshot.checksum,plain.snapshot.checksum,'Reference bytes participate in the approved Source identity');
 assert.equal(built.frameworkReferences.manifest,referenceSourceIdentity);assert.equal(built.frameworkReferences.added.length,45);assert(!built.frameworkReferences.added.includes(edited));
 assert.equal(built.snapshot.files.find(f=>f.path===edited)?.content,rows.get(edited));assert.equal(built.snapshot.files.find(f=>f.path==='src/player.gd')?.content,rows.get('src/player.gd'));assert(built.excluded.includes('.env'));assert(!JSON.stringify(built.snapshot).includes('DUMMY_FRAMEWORK_REFERENCE_EXCLUDED_ONLY'));
 assert(built.snapshot.files.some(f=>f.path==='docs/engine-reference/godot/modules/input.md'));assert(built.snapshot.files.some(f=>f.path==='docs/engine-reference/unity/VERSION.md'));assert(built.snapshot.files.some(f=>f.path==='docs/engine-reference/unreal/VERSION.md'));
});
test('a reference directory collision fails closed without replacing existing project files',async()=>{
 const rows=new Map([['docs','Saved user file that must not become a directory\n'],['src/player.gd','extends Node2D\n']]);
 await assert.rejects(frameworkGameSnapshot(source(rows),identity()),/conflicts with project path: docs/);assert.equal(rows.get('docs'),'Saved user file that must not become a directory\n');
});
test('a secret-bearing user reference remains excluded rather than replaced with a trusted public copy',async()=>{
 const name='docs/engine-reference/godot/VERSION.md',rows=new Map([[name,'API_KEY=DUMMY_USER_REFERENCE_MUST_STAY_PRIVATE\n'],['src/player.gd','extends Node2D\n']]);
 const built=await frameworkGameSnapshot(source(rows),identity());assert(built.excluded.includes(name));assert(!built.frameworkReferences.added.includes(name));assert(!built.snapshot.files.some(f=>f.path===name));assert.equal(rows.get(name),'API_KEY=DUMMY_USER_REFERENCE_MUST_STAY_PRIVATE\n');
});
