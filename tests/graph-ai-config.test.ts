import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyAIConfigurations,newAIConfiguration,validateAIConfigurations,saveAIConfigurations,configurationPrompt,aiConfigurationKey,canPrepareConfiguration} from '../src/features/orchestration/ai-config.ts';
test('AI configurations preserve distinct provider, model, tool, role and task assignments',()=>{
 const value=emptyAIConfigurations('a');value.profiles=[{...newAIConfiguration('one'),provider:'anthropic',model:'configured-model',tool:'claude-code',role:'review',connection:'api',location:'external'}];value.bindings={task:'one'};
 const checked=validateAIConfigurations(value,'a');assert.deepEqual(checked,value);
 assert.throws(()=>validateAIConfigurations(value,'b'));assert.throws(()=>validateAIConfigurations({...value,bindings:{task:'missing'}},'a'));
 assert.notEqual(aiConfigurationKey('a'),aiConfigurationKey('b'));
});
test('limits, unknown adapters, duplicates and invalid prompts are rejected',()=>{
 const value=emptyAIConfigurations('a'),profile=newAIConfiguration('one');
 for(const patch of [{maxRequests:0},{timeoutSeconds:121},{maxAttempts:4},{prompt:''},{provider:'fake'},{name:''}])assert.throws(()=>validateAIConfigurations({...value,profiles:[{...profile,...patch}]},'a'));
 assert.throws(()=>validateAIConfigurations({...value,profiles:[profile,profile]},'a'));
});
test('stored configuration strips credential fields and masks dummy prompt secrets',()=>{
 const value=emptyAIConfigurations('a');value.profiles=[{...newAIConfiguration('one'),prompt:'Inspect source. api_key=sk-dummy1234567890',connectionRef:'password=dummy-password',token:'dummy-token'} as ReturnType<typeof newAIConfiguration>];
 const checked=validateAIConfigurations(value,'a'),json=JSON.stringify(checked);
 assert.ok(!json.includes('dummy1234567890'));assert.ok(!json.includes('dummy-password'));assert.ok(!json.includes('dummy-token'));
 assert.ok(configurationPrompt(checked.profiles[0],'Source review').includes('Task: Source review'));
});
test('save detects other-window edits and preserves existing stored data',()=>{
 const map=new Map<string,string>(),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}},value=emptyAIConfigurations('a');value.profiles=[newAIConfiguration('one')];
 saveAIConfigurations(storage,value,null);const original=storage.getItem(aiConfigurationKey('a'));
 assert.throws(()=>saveAIConfigurations(storage,{...value,profiles:[]},null));assert.equal(storage.getItem(aiConfigurationKey('a')),original);
 assert.deepEqual(validateAIConfigurations(JSON.parse(original!),'a'),value);
});
test('unsupported model, provider, tool or connection cannot silently fall back to Core',()=>{
 const p=newAIConfiguration('one');assert.equal(canPrepareConfiguration(p),true);
 for(const patch of [{provider:'anthropic'},{provider:'google'},{provider:'local'},{model:'another-model'},{tool:'codex'},{tool:'claude-code'},{connection:'api'},{connectionRef:'another-connection'},{location:'device'}] as Partial<typeof p>[])
 assert.equal(canPrepareConfiguration({...p,...patch}),false);
 assert.equal(canPrepareConfiguration(undefined),false);
});
