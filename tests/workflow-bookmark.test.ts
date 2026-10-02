import test from 'node:test';import assert from 'node:assert/strict';
import {workflowBookmark,resolveWorkflow,workflowKey} from '../src/features/workspace/workflow-bookmark.ts';
import {Documents} from '../src/features/editor/documents.ts';import type {WorkspaceFileService} from '../src/features/filesystem/file-service.ts';
test('workflow restart preserves identifiers only and rejects credentials, foreign boundaries and traversal',()=>{
 const projectId=crypto.randomUUID(),endpoint='ws://localhost:4349/studio',analysisId=crypto.randomUUID(),attemptId=crypto.randomUUID(),runId=crypto.randomUUID();const row={version:1,projectId,endpoint,path:'src/main.rs',analysisId,attemptId,runId};
 const storage=new Map([[workflowKey(projectId),JSON.stringify(workflowBookmark(row,projectId,endpoint))]]);const restored=workflowBookmark(JSON.parse(storage.get(workflowKey(projectId))!),projectId,endpoint);assert.deepEqual(restored,row);
 for(const value of [{...row,token:'dummy'},{...row,approval:true},{...row,content:'dummy'},{...row,projectId:crypto.randomUUID()},{...row,endpoint:'ws://localhost:4350/studio'},{...row,path:'../outside.rs'},{...row,path:'C:/outside.rs'},{...row,endpoint:'ws://user:dummy@localhost:4349/studio'}])assert.throws(()=>workflowBookmark(value,projectId,endpoint));
});
test('workflow restore resolves real project history and rejects stale or unrelated attempt/run identity',()=>{
 const projectId=crypto.randomUUID(),analysisId=crypto.randomUUID(),attemptId=crypto.randomUUID(),runId=crypto.randomUUID(),bookmark=workflowBookmark({version:1,projectId,endpoint:'ws://localhost:4349/studio',analysisId,attemptId,runId},projectId,'ws://localhost:4349/studio');const analyses=[{id:analysisId,projectId}],attempts=[{id:attemptId,projectId,analysisId,retestRunId:runId}];assert.equal(resolveWorkflow(bookmark,analyses,attempts).attempt?.id,attemptId);assert.throws(()=>resolveWorkflow(bookmark,[],attempts));assert.throws(()=>resolveWorkflow(bookmark,analyses,[{...attempts[0],projectId:crypto.randomUUID()}]));assert.throws(()=>resolveWorkflow({...bookmark,runId:crypto.randomUUID()},analyses,attempts));
});
test('workflow source reopen preserves dirty editor contents without disk writes',async()=>{
 let reads=0;const documents=new Documents({read:async()=>{reads++;return{content:'saved',size:5,modified:0};}} as unknown as WorkspaceFileService);await documents.open('src/main.rs');const id=documents.snapshot().activeEditorId!;documents.edit(id,'user unsaved');await documents.open('src/main.rs');assert.equal(reads,1);assert.equal(documents.get(id).content,'user unsaved');assert.deepEqual(documents.snapshot().dirtyEditors,[id]);
});
