import type * as Monaco from 'monaco-editor';
import { normalizePath } from '../filesystem/paths.ts';
import { indexWorkspace, type IndexReader } from './workspace-index.ts';
import { projectLanguage } from './project-language.ts';
import { detectLanguage } from './policy.ts';
export function workspaceUri(monaco: typeof Monaco, connectionId: string, path: string) {
  return monaco.Uri.from({scheme:'studio',authority:encodeURIComponent(connectionId),path:'/'+normalizePath(path)});
}
export function uriWorkspacePath(uri: Monaco.Uri, connectionId: string) {
  if(uri.scheme!=='studio'||uri.authority!==encodeURIComponent(connectionId))return null;
  try { const path=normalizePath(uri.path.slice(1));return path&&uri.path==='/'+path?path:null; }catch{return null;}
}
/** Uses Monaco's bundled TypeScript worker; no external language server or shell. */
export async function loadLanguageWorkspace(monaco: typeof Monaco, reader: IndexReader, connectionId: string, signal: AbortSignal, current: () => readonly {path:string;content:string}[]) {
  // Read saved files first; overlay the latest editor state only after asynchronous IO.
  const result=await indexWorkspace(reader,signal,[],true);
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  const configuration=await projectLanguage(reader,signal);
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  const defaults=[monaco.typescript.typescriptDefaults,monaco.typescript.javascriptDefaults];
  const previous=defaults.map(setting=>({compiler:{...setting.getCompilerOptions()},diagnostics:{...setting.getDiagnosticsOptions()}}));
  const options:Monaco.typescript.CompilerOptions={allowJs:true,checkJs:true,allowNonTsExtensions:true,target:monaco.typescript.ScriptTarget.ESNext,module:monaco.typescript.ModuleKind.ESNext,moduleResolution:monaco.typescript.ModuleResolutionKind.NodeJs,noEmit:true};
  const raw=configuration.options;
  for(const key of ['strict','strictNullChecks','noImplicitAny','allowJs','checkJs','esModuleInterop','allowSyntheticDefaultImports','skipLibCheck','resolveJsonModule','allowImportingTsExtensions'] as const)if(typeof raw[key]==='boolean')Object.assign(options,{[key]:raw[key]});
  for(const [key,values] of [['target',monaco.typescript.ScriptTarget],['module',monaco.typescript.ModuleKind],['moduleResolution',monaco.typescript.ModuleResolutionKind],['jsx',monaco.typescript.JsxEmit]] as const){const value=raw[key];if(typeof value==='string'){const entry=Object.entries(values).find(([name,v])=>typeof v==='number'&&name.toLowerCase()===value.toLowerCase());if(entry)Object.assign(options,{[key]:entry[1]});}}
  if(raw.paths!==undefined||raw.baseUrl!==undefined){options.baseUrl=workspaceUri(monaco,connectionId,configuration.baseUrl).toString();if(raw.paths)options.paths=raw.paths as Record<string,string[]>;}
  for(const setting of defaults){setting.setCompilerOptions(options);setting.setDiagnosticsOptions({noSemanticValidation:false,noSyntaxValidation:false});setting.setEagerModelSync(true);}
  result.files.push(...configuration.declarations);result.limited ||= configuration.limited;

  const models:Monaco.editor.ITextModel[]=[];
  const overlay=new Map(current().map(file=>[file.path,file.content]));
  for(const file of result.files){const uri=workspaceUri(monaco,connectionId,file.path);if(!monaco.editor.getModel(uri))models.push(monaco.editor.createModel(overlay.get(file.path)??file.content,detectLanguage(file.path),uri));}
  return {result,models,warnings:configuration.warnings,dispose:()=>{models.forEach(model=>{if(!model.isDisposed())model.dispose();});defaults.forEach((setting,i)=>{setting.setCompilerOptions(previous[i].compiler);setting.setDiagnosticsOptions(previous[i].diagnostics);});}};
}
