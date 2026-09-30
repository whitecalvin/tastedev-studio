import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {languages,languagePreference,systemLanguage,resolveLanguage,interpolate} from '../src/i18n/core.ts';
import {catalogs,translate,translateFeedback} from '../src/i18n/messages.ts';
import {feedbackTemplates} from '../src/i18n/approval.ts';

test('Studio supports the same language set as tastedev-web',()=>{
 const web=readFileSync('../tastedev-web/i18n/config.ts','utf8');
 const match=web.match(/export const locales = \[([^\]]+)\]/)!;
 assert.deepEqual([...languages].sort(),[...match[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]).sort());
});
test('system is the default; missing, corrupt and unsupported preferences are safe',()=>{
 for(const value of [null,undefined,'','system','invalid',{},'fr-FR'])assert.equal(languagePreference(value),'system');
 for(const value of languages)assert.equal(languagePreference(value),value);
 for(const value of [undefined,[],[''],['ru-RU'],['ar-SA'],['unsupported','ko-KR']])assert.equal(systemLanguage(value),'en');
});
test('system locale regions, case and traditional Chinese are resolved correctly',()=>{
 const cases:Record<string,string>={'ko-KR':'ko','en-GB':'en','DE_de':'de','es-MX':'es','fr-CA':'fr','it-IT':'it','pt-PT':'pt','JA-jp':'ja','zh-CN':'zh','zh-SG':'zh','zh-TW':'zh-hant','zh-HK':'zh-hant','zh-MO':'zh-hant','zh-Hant':'zh-hant','zh-Hans-TW':'zh'};
 for(const[locale,expected]of Object.entries(cases))assert.equal(systemLanguage([locale]),expected);
 assert.equal(systemLanguage([' ','ko-KR']),'ko');
});
test('explicit language overrides system and system restores detection',()=>{
 for(const language of languages)assert.equal(resolveLanguage(language,['ko-KR']),language);
 assert.equal(resolveLanguage('system',['fr-FR']),'fr');
});
test('English fallback and interpolation preserve user data literally',()=>{
 assert.equal(translate('ja','Unknown provider error: EXAMPLE'),'Unknown provider error: EXAMPLE');
 for(const language of languages)for(const key of ['constructor','toString','__proto__'])assert.equal(translate(language,key),key);
 const name='Projects <script> {date} $&';
 for(const language of languages)assert.ok(translate(language,'Opening {name}…',{name}).includes(name));
 assert.equal(interpolate('{value} {missing}',{value:0}),'0 {missing}');
 assert.equal(interpolate('{toString}'),' {toString}'.trim());
});
test('all localized catalogs preserve placeholder contracts',()=>{
 const slots=(value:string)=>[...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(m=>m[1]).sort();
 for(const language of languages.filter(l=>l!=='en')){
  assert.ok(Object.keys(catalogs[language]!).length>500,language);
  for(const[key,value]of Object.entries(catalogs[language]!)){
   assert.ok(value.trim(),`${language}: ${key}`);
   assert.deepEqual(slots(value),slots(key),`${language}: ${key}`);
  }
 }
});
test('approval dialogs translate surrounding instructions while preserving approved scope',()=>{
 const scope={proposal:'proposal-1',files:'src/Projects.ts, src/Cancel.ts',task:'Search',command:'node test.mjs --name Save',test:'Run',repository:'owner/Projects',title:'User title: Apply',count:'2',name:'Save',path:'src/Projects',open:'2',dirty:'1'};
 for(const template of feedbackTemplates){
  const message=interpolate(template,scope);
  for(const language of languages){
   const localized=translateFeedback(language,message);
   assert.equal(localized,translate(language,template,scope));
   for(const slot of template.matchAll(/\{([a-z]+)\}/g))assert.ok(localized.includes(scope[slot[1] as keyof typeof scope]));
  }
 }
});
const technical=new Set(['2026-10-01T03:00:00+09:00','Chromium','Chromium · ','Commit SHA','FixAttempt','Git:','GitHub #','GitHub:','KiB','Linux','OS','PTY','Protocol:','TASTEDEV Protocol','URL','Windows','["dev"]','arm64','chromium','e.g. 24.11.1','e.g. node','firefox','macOS','pnpm','s','tastedev:artifact/','webkit','x86_64','· Playwright','Docker / GPU / PTY']);
test('every static UI translation key is present in all nine catalogs',()=>{
 const files:string[]=[];function walk(dir:string){for(const entry of readdirSync(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory()&&!['verification','i18n'].includes(entry.name))walk(file);else if(entry.name.endsWith('.tsx'))files.push(file);}}walk('src');
 const keys=new Set<string>();
 for(const file of files){const text=readFileSync(file,'utf8');for(const match of text.matchAll(/\bt\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)){const key=match[1][0]==='"'?JSON.parse(match[1]):match[1].slice(1,-1).replace(/\\'/g,"'");keys.add(key);}}
 for(const key of keys)if(!technical.has(key))for(const language of languages.filter(l=>l!=='en'))assert.ok(catalogs[language]?.[key],`${language} missing ${key}`);
});
