const fs=require('fs'),path=require('path'),{randomUUID,createHash}=require('crypto');
const mime={screenshot:'image/png',trace:'application/zip','test-report':'application/json','browser-console':'application/json','page-errors':'application/json','network-log':'application/json'},CHUNK=1048576;
function safe(file){for(let cursor=path.resolve(file);;cursor=path.dirname(cursor)){if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())throw Error('Upload journal links forbidden');if(path.dirname(cursor)===cursor)break;}}
function save(file,ledger){const temp=file+'.'+randomUUID()+'.tmp';safe(temp);const fd=fs.openSync(temp,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(ledger));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temp,file);}
async function uploadArtifact({bytes,type,input,dir,request=fetch}){
 if(!Object.hasOwn(mime,type)||bytes.length<1||bytes.length>32*1024*1024||!/^[a-f0-9-]{36}$/.test(input.runStepId))throw Error('Upload artifact limits');
 const file=path.join(dir,'upload-journal.json');safe(file);let ledger={};if(fs.existsSync(file)){if(fs.statSync(file).size>32768)throw Error('Upload journal limit');ledger=JSON.parse(fs.readFileSync(file,'utf8'));}
 const checksum=createHash('sha256').update(bytes).digest('hex'),key=type+':'+checksum;let row=ledger[key];
 if(!row){if(Object.keys(ledger).length>=40)throw Error('Upload journal capacity');const id=randomUUID();row={id,checksum,size:bytes.length,type,name:input.runStepId+'-'+id+'.'+(type==='screenshot'?'png':type==='trace'?'zip':'json'),offset:0,complete:false};ledger[key]=row;save(file,ledger);}
 if(row.checksum!==checksum||row.size!==bytes.length||row.type!==type||!/^[a-f0-9-]{36}$/.test(row.id)||!Number.isSafeInteger(row.offset)||row.offset<0||row.offset>bytes.length||typeof row.complete!=='boolean')throw Error('Upload journal integrity');
 if(row.complete)return row;
 const url=input.transfer.url+'/'+row.id,headers={Authorization:'Bearer '+input.transfer.token,'Content-Type':mime[type],'X-Artifact-Type':type,'X-Artifact-Name':row.name,'X-Artifact-Size':String(bytes.length),'X-Artifact-Checksum':checksum};
 let last='unknown';
 for(let attempt=0;attempt<3;attempt++){try{
  if(input.transfer.resumable){const progress=await request(url,{method:'HEAD',redirect:'error',headers,signal:AbortSignal.timeout(10000)});if(!progress.ok||progress.headers.get('x-upload-protocol')!=='chunk-v1')throw Error('Transfer '+progress.status);const raw=progress.headers.get('x-upload-offset');if(!raw||!/^\d+$/.test(raw))throw Error('Transfer offset invalid');row.offset=Number(raw);if(!Number.isSafeInteger(row.offset)||row.offset<0||row.offset>bytes.length)throw Error('Transfer offset invalid');save(file,ledger);
   do{const start=row.offset,end=Math.min(start+CHUNK,bytes.length),response=await request(url,{method:'PUT',redirect:'error',headers:{...headers,'X-Upload-Offset':String(start),'X-Upload-Chunk-Checksum':createHash('sha256').update(bytes.subarray(start,end)).digest('hex')},body:bytes.subarray(start,end),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Transfer '+response.status);const offset=Number(response.headers.get('x-upload-offset'));if(!Number.isSafeInteger(offset)||offset!==end)throw Error('Transfer ACK offset invalid');row.offset=offset;row.complete=response.status===201;if(row.complete&&offset!==bytes.length)throw Error('Transfer premature completion');if(!row.complete&&offset===bytes.length)throw Error('Transfer missing completion');save(file,ledger);}while(!row.complete);
  }else{const response=await request(url,{method:'PUT',redirect:'error',headers,body:bytes,signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Transfer '+response.status);row.offset=bytes.length;row.complete=true;save(file,ledger);}
  return row;
 }catch(error){last=error.message;}}
 throw Error(last);
}
module.exports={uploadArtifact,CHUNK};
