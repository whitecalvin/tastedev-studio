const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),{randomUUID,createHash}=require('crypto');
const {sanitizer}=require('./sanitize.cjs');
const mime={screenshot:'image/png',trace:'application/zip','test-report':'application/json','browser-console':'application/json','page-errors':'application/json','network-log':'application/json'};
(async()=>{
 const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),dir=path.dirname(process.argv[2]),cwd=process.cwd();
 const config=path.resolve(cwd,input.browser.config);if(!config.startsWith(cwd+path.sep)||!fs.existsSync(config))throw Error('Browser config unavailable');
 const project=path.dirname(config);const output=path.join(dir,'output');fs.mkdirSync(output,{recursive:true});
 const generated=path.join(project,`.tastedev-${input.runStepId}.config.ts`);
 const modulePath=p=>p.replaceAll('\\','/');
 const base=`import base from ${JSON.stringify(modulePath(config))};\nexport default {...base, testDir:base.testDir || '.', retries:0,workers:1,fullyParallel:false, outputDir:${JSON.stringify(modulePath(output))}, reporter:[[${JSON.stringify(modulePath(path.join(__dirname,'reporter.cjs')))}]], projects:[{name:'tastedev-chromium',use:{...base.use,browserName:'chromium',channel:undefined,baseURL:${JSON.stringify(input.browser.baseUrl)},storageState:undefined,headless:true,screenshot:'only-on-failure',trace:'on',video:'off'}}]};`;
 fs.writeFileSync(generated,base,{flag:'wx'});
 const probe=await require('@playwright/test').chromium.launch({headless:true,timeout:4000});const browserVersion=probe.version();await probe.close();
 const clean=sanitizer(input.maskValues);let exit=1;
 try{
  const cli=require.resolve('@playwright/test/cli');
  const child=spawn(process.execPath,[cli,'test','--config',generated],{cwd,windowsHide:true,stdio:'inherit',env:{...process.env,TASTEDEV_BROWSER_VERSION:browserVersion,TASTEDEV_EVIDENCE_DIR:dir,TASTEDEV_MASK_VALUES:JSON.stringify(input.maskValues),NODE_PATH:[path.join(__dirname,'node_modules'),process.env.NODE_PATH].filter(Boolean).join(path.delimiter)}});
  exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
 }finally{fs.unlinkSync(generated);}
 let manifest;try{manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));}catch{manifest={summary:{total:0,passed:0,failed:0,skipped:0,duration:0,browserVersion:'unknown',playwrightVersion:require('@playwright/test/package.json').version,classification:'RUNNER_FAILED',failures:[{name:'Browser runner',message:'Runner exited without a report.'}],consoleErrors:0,pageErrors:0,networkFailures:0,evidenceWarnings:[]},attachments:[]};}
 // Finalize only after bounded transfer attempts. Metadata is registered by Core after verified bytes.
 for(const a of manifest.attachments.slice(0,40)){
  try{
   const real=fs.realpathSync.native(a.path);if(!real.startsWith(fs.realpathSync.native(dir)+path.sep))throw Error('Unsafe artifact path');
   const size=fs.statSync(real).size;if(size<1||size>32*1024*1024)throw Error('Artifact exceeds size limit');
   const bytes=fs.readFileSync(real),id=randomUUID(),checksum=createHash('sha256').update(bytes).digest('hex');let ok=false,last='unknown';
   for(let attempt=0;attempt<2&&!ok;attempt++){try{const response=await fetch(`${input.transfer.url}/${id}`,{method:'PUT',redirect:'error',headers:{Authorization:`Bearer ${input.transfer.token}`,'Content-Type':mime[a.type],'X-Artifact-Type':a.type,'X-Artifact-Name':`${input.runStepId}-${id}.${a.type==='screenshot'?'png':a.type==='trace'?'zip':'json'}`,'X-Artifact-Size':String(size),'X-Artifact-Checksum':checksum},body:bytes,signal:AbortSignal.timeout(10000)});ok=response.ok;last=String(response.status);}catch(e){last=e.cause?.code??e.name;}}if(!ok)throw Error('Transfer '+last);
  }catch(e){manifest.summary.evidenceWarnings.push(`Artifact transfer failed: ${a.type} (${e.message})`);}
 }
 const summary=clean(manifest.summary);fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(summary));console.log(`Browser tests: ${summary.passed} passed, ${summary.failed} failed; evidence warnings: ${summary.evidenceWarnings.length}`);process.exitCode=exit;
})().catch(()=>{console.error('Browser runner infrastructure failed.');process.exitCode=2;});
