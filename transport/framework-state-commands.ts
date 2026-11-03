import {realpath,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {bundleManifest} from '../src/features/frameworks/catalog.ts';

const helpers=new Set(['project-state.sh','set-stage.sh','config-set.sh']);
const stages=new Set(['Concept','Systems Design','Technical Setup','Pre-Production','Production','Polish','Release']);
const settings:Record<string,readonly string[]>={
  'modes.rigor':['minimal','standard','full'],
  'modes.automation':['collaborative','guided','autonomous'],
};
/** Undefined means another existing command policy owns this command. No Shell fallback. */
export async function frameworkStateCommand(command:string,cwd:string,canWrite:(relative:string)=>Promise<boolean>):Promise<boolean|undefined>{
  const name=command.match(/(?:^|[\\/])([a-z-]+\.sh)\b/)?.[1];
  if(!name||!helpers.has(name))return undefined;
  // Accept literal arguments only. No substitutions, redirection, chained commands or escaped parsing.
  if(/[;|&<>$`\r\n\\]/.test(command))return false;
  const tokens:string[]=[];let cursor=0;
  for(const match of command.matchAll(/"[^"\r\n]*"|'[^'\r\n]*'|[^\s"']+/g)){if(command.slice(cursor,match.index).trim())return false;tokens.push(match[0]);cursor=match.index+match[0].length;}
  if(!tokens.length||command.slice(cursor).trim())return false;
  const values=tokens.map(v=>v.replace(/^(["'])(.*)\1$/,'$2'));
  if(values[0]!=='bash'||values[1]!=='.claude/scripts/'+name)return false;
  const args=values.slice(2),dry=args.at(-1)==='--dry-run';if(dry)args.pop();
  const file='.claude/scripts/'+name;
  const expected=bundleManifest.files.find(f=>f.path===file);if(!expected)return false;
  try{const root=await realpath(cwd),resolved=await realpath(path.join(root,file));if(resolved!==path.join(root,...file.split('/'))||createHash('sha256').update(await readFile(resolved)).digest('hex')!==expected.sha256)return false;}catch{return false;}
  if(name==='project-state.sh')return !dry&&(args.length===0||args.length===1&&args[0]==='--stage');
  if(name==='set-stage.sh')return args.length===1&&stages.has(args[0])&&(dry||await canWrite('project.yaml')&&await canWrite('production/stage.txt'));
  if(args.length===1&&args[0].includes('=')){const split=args[0].indexOf('=');args.splice(0,1,args[0].slice(0,split),args[0].slice(split+1));}
  return args.length===2&&!!settings[args[0]]?.includes(args[1])&&(dry||await canWrite('project.yaml'));
}
