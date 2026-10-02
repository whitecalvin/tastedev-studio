import test from 'node:test';import assert from 'node:assert/strict';
import {languageCompletions} from '../src/features/editor/language-completion.ts';
test('real LSP completion list forms preserve snippets, ranges and plain untrusted documentation',()=>{
 const result=languageCompletions({isIncomplete:true,items:[{label:'add',kind:3,insertText:'add(${1:value})',insertTextFormat:2,documentation:{kind:'markdown',value:'local function'}},{label:'name',textEdit:{range:{start:{line:0,character:2},end:{line:0,character:5}},newText:'value'}}]});
 assert.equal(result.incomplete,true);assert.equal(result.items[0].snippet,true);assert.equal(result.items[0].documentation,'local function');assert.equal(result.items[1].insertText,'value');assert.equal(result.items[1].range?.start.character,2);
});
test('completion blocks commands, hidden extra writes, malformed bounds and unsupported defaults',()=>{
 assert.deepEqual(languageCompletions([{label:'shell',command:{command:'execute'}},{label:'imports',additionalTextEdits:[{}]},{label:'bad',textEdit:{range:{start:{line:-1,character:0},end:{line:0,character:0}},newText:'x'}},{label:'nul',insertText:'a\0b'}]).items,[]);
 assert.equal(languageCompletions({items:[{label:'x'}],itemDefaults:{editRange:{}}}).items.length,0);assert.equal(languageCompletions(Array.from({length:1001},()=>({label:'x'}))).items.length,0);
});
