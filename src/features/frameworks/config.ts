import yaml from 'js-yaml';
import contract from './upstream-config.json' with {type:'json'};
const table=(lines:string[])=>Object.fromEntries(lines.map(line=>{const at=line.indexOf('::');return[line.slice(0,at),line.slice(at+2)];}));
const enums=table(contract.enums),defaults=table(contract.defaults),rigor=table(contract.rigor_expansion),localKeys=new Set(contract.locally_overridable);
export interface ResolvedValue {value:unknown;source:string}
/** Same indented scalar/map subset as the pinned helper. Repeated maps merge, leaves take last. */
export function parseSettings(text:string|undefined,name:string){
 const values:Record<string,unknown>=Object.create(null),notes:string[]=[],seen=new Map<string,number>(),stack:{indent:number;key:string}[]=[];let block:number|undefined;
 if(text===undefined){notes.push(name+' absent');return{values,notes};}
 if(text.length>262144){notes.push(name+' exceeds configuration limit');return{values,notes};}
 if(!text.trim())notes.push(name+' is EMPTY');
 for(const [index,line] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
  if(/^ *\t/.test(line)){notes.push(name+': tab at line '+(index+1));continue;}
  if(!line.trim()||line.trimStart().startsWith('#'))continue;
  const indent=line.length-line.trimStart().length;
  if(block!==undefined&&indent>block)continue;block=undefined;
  while(stack.length&&stack.at(-1)!.indent>=indent)stack.pop();
  if(line.trimStart().startsWith('- ')){const key=stack.map(s=>s.key).join('.');if(!key){notes.push(name+': malformed list at line '+(index+1));continue;}try{const v=yaml.load(line.trimStart().slice(2),{schema:yaml.JSON_SCHEMA});if(!Array.isArray(values[key]))values[key]=[];(values[key] as unknown[]).push(v);}catch{notes.push(name+': malformed '+key);}continue;}
  const m=line.trim().match(/^([\w-]+):(?:\s+(.*))?$/);if(!m){notes.push(name+': unsupported YAML at line '+(index+1));continue;}
  const key=[...stack.map(s=>s.key),m[1]].join('.'),raw=m[2]?.trim();
  if(seen.has(key))notes.push(name+': duplicate '+key+' at lines '+seen.get(key)+', '+(index+1));seen.set(key,index+1);
  if(!raw||raw.startsWith('#')){stack.push({indent,key:m[1]});continue;}
  if(/^[|>][-+0-9]*(?:\s*#.*)?$/.test(raw)){block=indent;continue;}
  try{const v=yaml.load(raw,{schema:yaml.JSON_SCHEMA});if(v!==null&&v!==undefined&&v!=='')values[key]=v;}catch{notes.push(name+': malformed '+key);}
 }
 return{values,notes};
}
export function resolveFrameworkConfig(input:{project?:string;local?:string;legacyReview?:string;legacyStage?:string;inlineReview?:string;system?:string;technicalPreferences?:string}){
 const project=parseSettings(input.project,'project.yaml'),local=parseSettings(input.local,'project.local.yaml'),notes=[...project.notes,...local.notes],values:Record<string,ResolvedValue>=Object.create(null);
 for(const key of Object.keys(local.values))if(!localKeys.has(key)&&key!=='schema_version'&&!key.startsWith('framework.'))notes.push('project.local.yaml: ignored locked key '+key);
 function valid(key:string,value:unknown,source:string){if(value===undefined||value===null||value===''||key==='modes.automation_always_ask'&&Array.isArray(value)&&!value.length)return false;if(enums[key]&&!enums[key].split('|').includes(String(value))){notes.push(source+': invalid '+key);return false;}return true;}
 function explicit(key:string):ResolvedValue|undefined {
  if(key==='modes.review_mode'&&valid(key,input.inlineReview,'inline --review'))return{value:input.inlineReview,source:'inline --review'};
  if(localKeys.has(key)&&valid(key,local.values[key],'project.local.yaml'))return{value:local.values[key],source:'project.local.yaml'};
  if(valid(key,project.values[key],'project.yaml'))return{value:project.values[key],source:'project.yaml'};
  const legacy=key==='modes.review_mode'?input.legacyReview:key==='project.stage'?input.legacyStage:undefined;
  if(valid(key,legacy,'legacy'))return{value:legacy,source:key==='modes.review_mode'?'production/review-mode.txt':'production/stage.txt'};
 }
 const level=String(explicit('modes.rigor')?.value??defaults['modes.rigor']);
 const expansion=Object.fromEntries(rigor[level].split(',').map(p=>p.split('=')));
 for(const key of new Set([...Object.keys(enums),...Object.keys(project.values),...localKeys,...Object.keys(expansion),'modes.automation_always_ask','engine.version','engine.language'])){
  let resolved=explicit(key);
  if(!resolved&&expansion[key]!==undefined)resolved={value:expansion[key],source:'rigor:'+level};
  if(!resolved&&defaults[key]!==undefined)resolved={value:defaults[key],source:'default'};
  if(!resolved&&key==='modes.automation_always_ask')resolved={value:['scope_changes','file_deletions','schema_changes'],source:'default'};
  values[key]=resolved??{value:null,source:'unset'};
 }
 if(input.system){const key='workflow_overrides.system_overrides.'+input.system,v=project.values[key];if(valid('modes.workflow',v,'project.yaml'))values['modes.workflow']={value:v,source:'project.yaml:'+key};}
 const tpSource='.claude/docs/technical-preferences.md',tp=(label:string)=>{const line=(input.technicalPreferences??'').split(/\r?\n/).find(l=>l.includes('**'+label+'**:')),v=line?.split('**'+label+'**:').slice(1).join('**'+label+'**:').trim();return v&&!v.includes('TO BE CONFIGURED')?v:undefined;},engine=tp('Engine'),parts=engine?.split(/ +/),legacyVersion=parts&&/^\d/.test(parts.at(-1)??'')?parts.pop():undefined,legacyName=parts?.join(' ');
 for(const [key,fallback]of [['engine.name',legacyName],['engine.version',legacyVersion],['engine.language',tp('Language')]] as const)values['derived.'+key]=values[key]?.value!==null&&values[key]?.value!==undefined?{...values[key]}:{value:fallback??null,source:fallback?tpSource:'unset'};
 const engineName=String(values['derived.engine.name'].value??'').toLowerCase(),primary=engineName==='godot'?'godot-specialist':engineName==='unity'?'unity-specialist':engineName.startsWith('unreal')?'unreal-specialist':tp('Primary');values['derived.specialists.primary']={value:primary??null,source:primary&&['godot','unity'].includes(engineName)||engineName.startsWith('unreal')?'engine.name':tpSource};
 const specialistBlock=/^specialists:[ \t]*(?:#.*)?\r?\n(?:[ \t]*#.*\r?\n)* +[\w-]+:/m.test(input.project??'');for(const [key,label]of [['code','Language/Code Specialist'],['shader','Shader Specialist'],['ui','UI Specialist'],['additional','Additional Specialists']]as const)values['derived.specialists.'+key]={value:specialistBlock?project.values['specialists.'+key]??null:tp(label)??null,source:specialistBlock?'project.yaml':tpSource};
 for(const type of ['logic','integration','visual','ui','config']){const explicit=values['testing.strict.'+type],legacy=project.values['testing.strict'],v=typeof explicit?.value==='boolean'?explicit:typeof legacy==='boolean'?{value:legacy,source:'testing.strict'}:undefined;values['derived.gate_level.'+type]={value:v?v.value?'blocking':'advisory':type==='config'?'advisory (/smoke-check: blocking)':'blocking',source:v?.source??'default'};}
 const review=String(values['modes.review_mode'].value);values['derived.review_gate']={value:{skillGates:review==='full'?'run':'skip',phaseGates:['full','lean'].includes(review)?'run':'skip'},source:values['modes.review_mode'].source};
 const platformBlock=Object.keys(project.values).some(k=>k.startsWith('platform.')),methods=new Set<string>();if(platformBlock){const targets=project.values['platform.targets'];if(Array.isArray(targets)&&targets.some(t=>['pc','web'].includes(String(t).toLowerCase())))methods.add('keyboard/mouse');if(/^(full|partial)$/i.test(String(project.values['platform.gamepad_support'])))methods.add('gamepad');if(/^(full|partial)$/i.test(String(project.values['platform.touch_support'])))methods.add('touch');const primary=String(project.values['platform.primary_input']??'').toLowerCase().replaceAll(' ','');if(primary)methods.add(['keyboard','mouse','keyboard&mouse','keyboard/mouse'].includes(primary)?'keyboard/mouse':['controller','joypad','gamepad'].includes(primary)?'gamepad':['touch','touchscreen'].includes(primary)?'touch':String(project.values['platform.primary_input']).toLowerCase());}values['derived.input_methods']={value:platformBlock?[...methods]:tp('Input Methods')??null,source:platformBlock?'project.yaml':tpSource};
 return {values,notes:[...new Set(notes)]};
}
