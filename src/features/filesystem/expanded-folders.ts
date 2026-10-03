import type {FileEntry} from './contracts.ts';

export async function readExpandedFolders(paths:readonly string[],read:(path:string)=>Promise<FileEntry[]>,active:()=>boolean=()=>true){
  const entries:Record<string,FileEntry[]>={},errors:Record<string,string>={};
  for(const path of new Set(['',...paths])){
    if(!active())return null;
    try{entries[path]=await read(path);}catch(error){if(!path)throw error;errors[path]=error instanceof Error?error.message:'Filesystem operation failed.';}
    if(!active())return null;
  }
  return {entries,errors};
}
