import {CodexClient} from '../transport/codex-client.ts';
import {startChatGPTLogin} from '../transport/codex-login.ts';
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),600000);
process.once('SIGINT',()=>controller.abort());
const client=await CodexClient.connect(controller.signal);
try{
 const notifications:{loginId:unknown;success:unknown}[]=[];let closed=false;let wake:(()=>void)|undefined;
 const unsubscribe=client.onNotification(p=>{if(p.method==='account/login/completed'){notifications.push({loginId:p.params?.loginId,success:p.params?.success});wake?.();}if(p.method==='client/closed'){closed=true;wake?.();}});
 const login=await startChatGPTLogin(client);
 if(login.connected)console.log(`ChatGPT connected (${login.plan}).`);
 else{
  console.log('Open this official link and sign in with your ChatGPT subscription account:\n'+login.authUrl);
  await new Promise<void>((resolve,reject)=>{wake=()=>{const completed=notifications.find(n=>n.loginId===login.loginId);if(completed){if(completed.success===true)resolve();else reject(Error('ChatGPT sign-in did not complete.'));}else if(closed)reject(Error('ChatGPT sign-in connection closed.'));else if(controller.signal.aborted)reject(Error('ChatGPT sign-in timed out.'));};controller.signal.addEventListener('abort',wake,{once:true});wake();});
  console.log('ChatGPT sign-in complete. TASTESTUDIO can now use Codex.');
 }
 unsubscribe();
}finally{clearTimeout(timer);client.close();}
