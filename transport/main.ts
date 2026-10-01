import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {startCoreServer} from './server.ts';
import {runtimeConfig,ConfigError} from './runtime-config.ts';
import {RuntimeLog} from './runtime-log.ts';

let log:RuntimeLog|undefined;
try {
 const config=runtimeConfig();const action=process.argv[2]??'start';
 if(!['start','health','stop'].includes(action))throw new ConfigError('COMMAND_INVALID');
 if(action!=='start') {
  const host=config.host==='::1'?'[::1]':config.host;
  if(!['localhost','127.0.0.1','::1','0.0.0.0','::'].includes(config.host))throw new ConfigError('ADMIN_LOCAL_LISTENER_REQUIRED');
  const local=['0.0.0.0','::'].includes(config.host)?'127.0.0.1':host;
  const adminToken=config.accessMode==='team'?process.env.CORE_SESSION_TOKEN:config.studioToken;
  if(action==='stop'&&(!adminToken||adminToken.length<16||adminToken.length>512))throw new ConfigError('OWNER_SESSION_TOKEN_REQUIRED');
  const response=await fetch(`http://${local}:${config.port}/${action==='health'?'health/ready':'runtime/stop'}`,{method:action==='stop'?'POST':'GET',headers:action==='stop'?{authorization:`Bearer ${adminToken}`}:{},signal:AbortSignal.timeout(5000)});
  console.log(JSON.stringify({event:`core.${action}`,status:response.status,result:await response.json()}));if(!response.ok)process.exitCode=1;
 } else {
  const secrets=Object.entries(process.env).filter(([key])=>/key|secret|token|password/i.test(key)).map(([,value])=>value??'').filter(Boolean);
  log=new RuntimeLog(config.logDir,config.logMaxBytes,config.logFiles,secrets);
  const write=log.write.bind(log);let deadline:ReturnType<typeof setTimeout>|undefined;
  const emit=(level:'info'|'warn'|'error',event:string,fields?:Record<string,unknown>)=>{write(level,event,fields);if(event==='core.draining'){deadline??=setTimeout(()=>{write('error','core.hard_stop_deadline');process.exit(1);},config.shutdownTimeoutMs+1000);deadline.unref();}if(event==='core.stopped'){clearTimeout(deadline);process.exitCode=fields?.timedOut?2:0;if(process.connected)process.disconnect();}};
  emit('info','core.starting');
  const version=(JSON.parse(fs.readFileSync(fileURLToPath(new URL('../package.json',import.meta.url)),'utf8')) as {version:string}).version;
  const server=await startCoreServer({...config,version,runtimeEvent:emit});
  let exiting=false;
  const stop=()=>{if(exiting)return;exiting=true;
   void server.stop(config.shutdownTimeoutMs).catch(()=>{emit('error','core.shutdown_failed');process.exit(1);});
  };
  for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,stop);
  process.on('message',message=>{if(message==='stop')stop();});
  process.on('warning',warning=>emit('warn','runtime.warning',{name:warning.name,message:warning.message}));
  process.send?.({type:'ready',port:server.port,version,protocolVersion:1});
 }
} catch(error) {
 const code=error instanceof ConfigError?error.code:(error as NodeJS.ErrnoException)?.code??'CORE_START_FAILED';
 try{if(log)log.write('error','core.failed',{code});else process.stderr.write(JSON.stringify({level:'error',event:'core.failed',code})+'\n');}finally{process.exitCode=1;}
}
