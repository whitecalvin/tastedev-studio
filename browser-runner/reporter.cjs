const fs=require('fs'),path=require('path'),{unzipSync,zipSync,strFromU8,strToU8}=require('fflate');
const {sanitizer}=require('./sanitize.cjs');
class Reporter {
 constructor(){this.tests=[];this.attachments=[];this.console=[];this.pageErrors=[];this.network=[];this.warnings=[];this.browserVersion=process.env.TASTEDEV_BROWSER_VERSION||'unknown';this.clean=sanitizer(JSON.parse(process.env.TASTEDEV_MASK_VALUES||'[]'));}
 onTestEnd(test,result){
  this.tests.push({name:test.titlePath().join(' › '),status:result.status,duration:result.duration,location:`${path.basename(test.location.file)}:${test.location.line}`,errors:result.errors.map(e=>({message:e.message||'',stack:e.stack||''}))});
  for(const a of result.attachments){if(!a.path)continue;try{
   if(a.contentType==='image/png'&&result.status!=='passed')this.attachments.push({type:'screenshot',path:a.path});
   if(a.name==='trace')this.trace(a.path,result.status!=='passed'&&result.status!=='skipped');
  }catch{this.warnings.push('Evidence generation failed.');}}
 }
 trace(file,retain){
  if(fs.statSync(file).size>32*1024*1024)throw Error('Trace exceeds limit');
  let declared=0;const entries=unzipSync(fs.readFileSync(file),{filter:entry=>{declared+=entry.originalSize;if(declared>64*1024*1024)throw Error('Trace expanded limit');return entry.originalSize<=32*1024*1024;}});const safe={};let expanded=0;
  for(const [name,data] of Object.entries(entries)){
   expanded+=data.length;if(expanded>64*1024*1024)throw Error('Trace expanded limit');
   if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.includes('..'))continue;
   if(/\.(trace|network|stacks)$/.test(name)){
    const lines=[];for(const line of strFromU8(data).split('\n').filter(Boolean)){let e;try{e=JSON.parse(line);}catch{continue;}
     if(e.type==='context-options'&&e.browserVersion)this.browserVersion=e.browserVersion;
     if(e.type==='console'&&['error','warning','warn'].includes(e.messageType??e.level))this.console.push({level:e.messageType??e.level,message:e.text??e.message??'',timestamp:new Date().toISOString()});
     if(e.type==='event'&&e.method==='pageError')this.pageErrors.push({message:e.params?.error?.message??e.params?.message??'Page error',stack:e.params?.error?.stack,timestamp:new Date().toISOString()});
     if(e.type==='resource-snapshot'){const r=e.snapshot;if(r&&(r.response?.status>=400||r.response?._failureText||r._failureText))this.network.push({method:r.request?.method,url:r.request?.url,status:r.response?.status??0,failure:r.response?._failureText??r._failureText??'HTTP error',timestamp:r.startedDateTime});}
     lines.push(JSON.stringify(this.clean(e)));
    }safe[name]=strToU8(lines.join('\n'));
   }
   // Keep visual trace frames only, never arbitrary response bodies or source files.
   else if(name.startsWith('resources/')&&((data[0]===137&&data[1]===80&&data[2]===78)||(data[0]===255&&data[1]===216)))safe[name]=data;
  }
  if(retain){const dest=file+'.sanitized.zip';fs.writeFileSync(dest,zipSync(safe));this.attachments.push({type:'trace',path:dest});}
 }
 onError(error){this.warnings.push('Runner error: '+(error.message||'unknown'));}
 onEnd(result){
  const failed=this.tests.filter(t=>!['passed','skipped'].includes(t.status));
  const summary=this.clean({total:this.tests.length,passed:this.tests.filter(t=>t.status==='passed').length,failed:failed.length,skipped:this.tests.filter(t=>t.status==='skipped').length,duration:result.duration,browserVersion:this.browserVersion,playwrightVersion:require('@playwright/test/package.json').version,classification:failed.length?'TEST_FAILED':result.status==='passed'?'PASSED':'RUNNER_FAILED',failures:failed.slice(0,20).map(t=>({name:t.name,location:t.location,message:t.errors[0]?.message??t.status,stack:t.errors[0]?.stack})),consoleErrors:this.console.filter(e=>e.level==='error').length,pageErrors:this.pageErrors.length,networkFailures:this.network.length,evidenceWarnings:this.warnings});
  const dir=process.env.TASTEDEV_EVIDENCE_DIR;const records=[['test-report',{summary,tests:this.tests}],['browser-console',this.console],['page-errors',this.pageErrors],['network-log',this.network]];
  for(const [type,value] of records){const p=path.join(dir,`${type}.json`);fs.writeFileSync(p,JSON.stringify(this.clean(value)));this.attachments.push({type,path:p});}
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({summary,attachments:this.attachments}));
 }
}
module.exports=Reporter;
