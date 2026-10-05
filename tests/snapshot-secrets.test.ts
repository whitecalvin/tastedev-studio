import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotHasSecret} from '../src/features/ai/snapshot-content-policy.ts';
import {mask} from '../src/features/ai/security.ts';
import {buildProjectSnapshot,verifyProjectSnapshot} from '../src/features/ai/project-snapshot.ts';
test('Rust types, localization labels and public query URLs preserve original source bytes',()=>{
 const text='struct Options { password: Option<&str>, token: String }\nfn translate() { let x = "Password:"; }\nconst URL: &str = "https://example.test/list?sort=name";';
 assert.equal(snapshotHasSecret('src/main.rs',text),false);assert.notEqual(mask(text),text);assert.equal(snapshotHasSecret('data.txt',text),true);
 assert.equal(snapshotHasSecret('src/main.rs','const PREFIX: &str="https://"; // https://{host}/path'),false);
});
test('Rust credential literals, raw strings, comments and private URL parameters remain blocked',()=>{
 for(const text of ['const TOKEN: &str = "DUMMY_PRIVATE";','fn x() { let password = "DUMMY_PRIVATE"; }','struct X { token: String }\n// api_key=DUMMY_PRIVATE','const TOKEN: &str = r#"DUMMY_PRIVATE"#;','fn x() { let y=serde_json::json!({"password":"DUMMY_PRIVATE"}); }','const URL: &str="https://user:pass@example.test";','const URL: &str="https://example.test?token=DUMMY_PRIVATE";','const URL: &str="https://example.test?sig=DUMMY_PRIVATE";','const KEY: &str="sk-DUMMY1234567890123456";'])assert.equal(snapshotHasSecret('src/main.rs',text),true,text);
 assert.equal(snapshotHasSecret('renamed.rs','api_key=DUMMY_PRIVATE'),true);
 assert.equal(snapshotHasSecret('src/main.rs','const URL: &str="https://user:pass@";'),true);
});
test('known values are checked before any Rust syntax exception, including binary surroundings',()=>{
 const text='struct Options { password: Option<DUMMY_KNOWN>, token: String }';assert.equal(snapshotHasSecret('src/main.rs',text,['DUMMY_KNOWN']),true);assert.equal(snapshotHasSecret('src/main.rs','\0'+text+'\xff',['DUMMY_KNOWN']),true);
});
test('builder and verifier preserve typed Rust but exclude dummy literals and secret paths',async()=>{
 const rows=new Map([['main.rs','struct Options { password: Option<String>, token: String }'],['unsafe.rs','const TOKEN: &str="DUMMY_PRIVATE";'],['.env','DUMMY_PRIVATE']]);
 const built=await buildProjectSnapshot({list:async()=>[...rows.keys()].map(path=>({path,name:path,kind:'file' as const})),read:async path=>({content:rows.get(path)!,size:rows.get(path)!.length,modified:0})},{projectId:crypto.randomUUID(),proposalId:crypto.randomUUID(),attempt:1,baseRevision:'working-tree',changedFiles:[]});
 assert.deepEqual(built.snapshot.files.map(f=>f.path),['main.rs']);assert.equal(built.snapshot.files[0].content,rows.get('main.rs'));assert(built.excluded.includes('.env'));assert(built.excluded.includes('unsafe.rs'));await verifyProjectSnapshot(built.snapshot);
});

test('Rust src/bin source paths are preserved without allowing output bin or credentials',async()=>{
 const {snapshotPath}=await import('../src/features/ai/snapshot.ts');
 assert.equal(snapshotPath('crates/license/src/bin/licensegen.rs'),'crates/license/src/bin/licensegen.rs');
 assert.equal(snapshotPath('src/bin'),'src/bin');
 for(const path of ['bin/app.exe','crates/license/bin/app.exe','src/bin/.env','src/bin/private.key','src/bin/../escape.rs'])assert.throws(()=>snapshotPath(path));
});

test('branding build inputs survive the snapshot while operational resources stay excluded',async()=>{
 const {snapshotPath}=await import('../src/features/ai/snapshot.ts');
 assert.equal(snapshotPath('resources'),'resources');
 assert.equal(snapshotPath('resources/branding/product/app.ico'),'resources/branding/product/app.ico');
 for(const path of ['resources/verification/report.json','resources/guides/run.md','resources/branding/.env','resources/branding/private.key'])assert.throws(()=>snapshotPath(path));
 const bytes=Uint8Array.from([137,80,78,71,0,255]);
 const files={list:async(dir:string)=>dir===''?[{name:'resources',path:'resources',kind:'directory' as const}]:dir==='resources'?[{name:'branding',path:'resources/branding',kind:'directory' as const},{name:'verification',path:'resources/verification',kind:'directory' as const}]:[{name:'icon.png',path:'resources/branding/icon.png',kind:'file' as const}],read:async()=>({content:'',size:bytes.length,modified:0}),readBytes:async()=>bytes};
 const built=await buildProjectSnapshot(files,{projectId:crypto.randomUUID(),proposalId:crypto.randomUUID(),attempt:1,baseRevision:'working-tree',changedFiles:[]});
 assert.deepEqual(built.snapshot.files.map(f=>f.path),['resources/branding/icon.png']);assert(built.excluded.includes('resources/verification'));await verifyProjectSnapshot(built.snapshot);
});
