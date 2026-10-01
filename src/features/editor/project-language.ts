import type {IndexReader,IndexedFile} from './workspace-index.ts';
import {normalizePath} from '../filesystem/paths.ts';
export function parseJsonConfig(text:string):Record<string,unknown>{
 if(text.length>65536)throw Error('Language configuration is too large.');
 let cleaned='',quoted=false,escaped=false;
 for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(quoted){cleaned+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}if(c==='"'){quoted=true;cleaned+=c;}else if(c==='/'&&n==='/'){while(i<text.length&&text[i]!=='\n')i++;cleaned+='\n';}else if(c==='/'&&n==='*'){i+=2;while(i<text.length&&!(text[i]==='*'&&text[i+1]==='/')){cleaned+=text[i]==='\n'?'\n':' ';i++;}if(i>=text.length)throw Error('Unclosed configuration comment.');i++;}else cleaned+=c;}
 let output='';quoted=false;escaped=false;
 for(let i=0;i<cleaned.length;i++){const c=cleaned[i];if(quoted){output+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}if(c==='"')quoted=true;if(c===','&&/^[\s]*[}\]]/.test(cleaned.slice(i+1)))continue;output+=c;}
 const value=JSON.parse(output);if(!value||Array.isArray(value)||typeof value!=='object')throw Error('Language configuration must be an object.');return value;
}
/** Resolve relative configuration paths without permitting escape above the Project. */
export function configPath(parent:string,value:string){
 if(value.length>240||/[\\:\0]/.test(value)||value.startsWith('/'))throw Error('Configuration path must stay in this Project.');
 const parts=parent?parent.split('/'):[];for(const part of value.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)throw Error('Configuration path escapes this Project.');parts.pop();}else parts.push(part);}if(parts.some(part=>['.git','.ssh','credentials','id_rsa','id_ed25519'].includes(part.toLowerCase())||/^\.env(?:\.|$)/i.test(part)||/\.(?:pem|key|pfx|p12)$/i.test(part)))throw Error('Credential paths are not language configuration.');return normalizePath(parts.join('/'));
}
export interface LanguageConfiguration {options:Record<string,unknown>;baseUrl:string;warnings:string[];declarations:IndexedFile[];limited:boolean}
export async function projectLanguage(reader:IndexReader,signal:AbortSignal):Promise<LanguageConfiguration>{
 const check=()=>{if(signal.aborted)throw new DOMException('Cancelled','AbortError');};const warnings:string[]=[];
 const read=async(file:string)=>{check();try{const value=(await reader.read(file)).content;check();return value;}catch(error){check();if(error instanceof DOMException&&error.name==='AbortError')throw error;return null;}};
 const seen=new Set<string>();
 async function config(file:string,depth:number):Promise<{options:Record<string,unknown>;baseUrl:string}>{
  if(depth>4||seen.has(file))throw Error('Configuration extends is cyclic or too deep.');seen.add(file);
  const text=await read(file);if(text===null)throw Error('Language configuration could not be read.');const data=parseJsonConfig(text),parent=file.split('/').slice(0,-1).join('/');let inherited={options:{} as Record<string,unknown>,baseUrl:parent};
  if(data.extends!==undefined){if(typeof data.extends!=='string'||!data.extends.startsWith('.'))throw Error('Only relative Project configuration extends is supported.');let target=configPath(parent,data.extends);if(!target.endsWith('.json'))target+='.json';inherited=await config(target,depth+1);}
  const raw=data.compilerOptions??{};if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid compiler options.');const options={...inherited.options,...raw},baseUrl=Object.hasOwn(raw,'baseUrl')?configPath(parent,String((raw as Record<string,unknown>).baseUrl)):inherited.baseUrl;
  if(options.paths!==undefined){if(!options.paths||typeof options.paths!=='object'||Array.isArray(options.paths)||Object.keys(options.paths).length>32)throw Error('Invalid path aliases.');for(const [key,targets] of Object.entries(options.paths)){if(key.length>120||(key.match(/\*/g)||[]).length>1||!Array.isArray(targets)||targets.length>8||targets.some(target=>typeof target!=='string'||(target.match(/\*/g)||[]).length>1))throw Error('Invalid path aliases.');for(const target of targets)configPath(baseUrl,target.replace('*','__wildcard__'));}}
  return {options,baseUrl};
 }
 let settings={options:{} as Record<string,unknown>,baseUrl:''};for(const file of ['tsconfig.json','jsconfig.json']){const text=await read(file);if(text===null)continue;try{settings=await config(file,0);}catch(error){warnings.push(error instanceof Error?error.message:'Language configuration unavailable.');}break;}
 const declarations:IndexedFile[]=[],packages=new Set<string>();let limited=false,bytes=0,entries=0;
 const validPackage=(name:string)=>/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(name)&&!name.split('/').some(part=>part==='.'||part==='..');
 const packageText=await read('package.json');if(packageText!==null){try{const pkg=parseJsonConfig(packageText);for(const kind of ['dependencies','devDependencies','optionalDependencies']){const dependencies=pkg[kind];if(dependencies&&typeof dependencies==='object'&&!Array.isArray(dependencies))for(const name of Object.keys(dependencies).slice(0,64))if(validPackage(name))packages.add(name);}}catch{warnings.push('Dependency metadata could not be read.');}}
 const listedTypes=settings.options.types;if(listedTypes!==undefined){if(!Array.isArray(listedTypes)||listedTypes.length>64||listedTypes.some(name=>typeof name!=='string'||!validPackage(name)))warnings.push('Invalid TypeScript types list.');else for(const name of listedTypes)packages.add('@types/'+name);}else{try{check();for(const entry of (await reader.list('node_modules/@types')).slice(0,64)){check();if(entry.kind==='directory'&&validPackage(entry.name)&&entry.path==='node_modules/@types/'+entry.name)packages.add('@types/'+entry.name);}}catch(error){check();if(error instanceof DOMException&&error.name==='AbortError')throw error;}}
 const selectedTypes=Array.isArray(listedTypes)?new Set(listedTypes.filter((value):value is string=>typeof value==='string').map(name=>'@types/'+name)):undefined;
 for(const name of [...packages].filter(name=>!name.startsWith('@types/')||!selectedTypes||selectedTypes.has(name)).slice(0,64)){const queue=['node_modules/'+name];while(queue.length&&!limited){check();const parent=queue.shift()!;let children;try{children=await reader.list(parent);check();}catch(error){check();if(error instanceof DOMException&&error.name==='AbortError')throw error;continue;}for(const child of children){if(++entries>2000){limited=true;break;}let file:string;try{file=normalizePath(child.path);}catch{continue;}if(file!==parent+'/'+child.name||child.name.includes('/')||child.name.includes('\\'))continue;if(child.kind==='directory'){if(file.split('/').length<12&&!['node_modules','.git','.cache'].includes(child.name))queue.push(file);continue;}if(!/\.d\.(?:[cm]?ts)$/i.test(file)||/(?:secret|credential|password|token)/i.test(child.name))continue;if(declarations.length>=128){limited=true;break;}const content=await read(file);if(content===null)continue;const size=new TextEncoder().encode(content).length;if(size>512*1024||content.includes('\0'))continue;if(bytes+size>4*1024*1024){limited=true;break;}bytes+=size;declarations.push({path:file,content});}}}
 check();return {...settings,warnings,declarations,limited};
}
