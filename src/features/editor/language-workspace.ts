import type * as Monaco from 'monaco-editor';
import { normalizePath } from '../filesystem/paths.ts';
import { indexWorkspace, type IndexReader } from './workspace-index.ts';
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
  const defaults=[monaco.typescript.typescriptDefaults,monaco.typescript.javascriptDefaults];
  for(const setting of defaults){setting.setCompilerOptions({...setting.getCompilerOptions(),allowJs:true,checkJs:true,allowNonTsExtensions:true,target:monaco.typescript.ScriptTarget.ESNext,module:monaco.typescript.ModuleKind.ESNext,moduleResolution:monaco.typescript.ModuleResolutionKind.NodeJs,noEmit:true});setting.setDiagnosticsOptions({...setting.getDiagnosticsOptions(),noSemanticValidation:false,noSyntaxValidation:false});setting.setEagerModelSync(true);}
  const models:Monaco.editor.ITextModel[]=[];
  const overlay=new Map(current().map(file=>[file.path,file.content]));
  for(const file of result.files){const uri=workspaceUri(monaco,connectionId,file.path);if(!monaco.editor.getModel(uri))models.push(monaco.editor.createModel(overlay.get(file.path)??file.content,detectLanguage(file.path),uri));}
  return {result,models,dispose:()=>models.forEach(model=>{if(!model.isDisposed())model.dispose();})};
}
