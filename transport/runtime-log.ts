import fs from 'node:fs';
import path from 'node:path';
import {sanitize} from '../src/features/ai/security.ts';

export class RuntimeLog {
 private filename:string;
 private maxBytes:number;private files:number;private secrets:string[];private output:(line:string)=>void;
 constructor(directory:string,maxBytes:number,files:number,secrets:string[]=[],output:(line:string)=>void=line=>process.stdout.write(line)) {this.maxBytes=maxBytes;this.files=files;this.secrets=secrets;this.output=output;fs.mkdirSync(directory,{recursive:true,mode:0o700});this.filename=path.join(directory,'core.jsonl');}
 write(level:'info'|'warn'|'error',event:string,fields:Record<string,unknown>={}) {
  const clean=sanitize(fields,this.secrets);const line=JSON.stringify({timestamp:new Date().toISOString(),level,event,fields:clean}).slice(0,32768);
  // Drop oversized records rather than writing truncated, invalid JSON.
  const record=line.length>=32768||Buffer.byteLength(line)+1>this.maxBytes?JSON.stringify({timestamp:new Date().toISOString(),level,event,fields:{omitted:'record size limit'}})+'\n':line+'\n';
  if(fs.existsSync(this.filename)&&fs.statSync(this.filename).size+Buffer.byteLength(record)>this.maxBytes){for(let i=this.files-1;i>=1;i--){const old=this.filename+'.'+i,next=this.filename+'.'+(i+1);if(i===this.files-1){if(fs.existsSync(old))fs.unlinkSync(old);}else if(fs.existsSync(old))fs.renameSync(old,next);}if(this.files>1)fs.renameSync(this.filename,this.filename+'.1');else fs.unlinkSync(this.filename);}
  fs.appendFileSync(this.filename,record,{mode:0o600});this.output(record);
 }
}
