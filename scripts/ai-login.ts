import {CodexClient} from '../transport/codex-client.ts';
const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),600000);
process.once('SIGINT',()=>controller.abort());
const client=await CodexClient.connect(controller.signal);
try{
 const {account}=await client.call<{account:{type:string;planType?:string}|null}>('account/read',{refreshToken:false});
 if(account?.type==='chatgpt')console.log(`ChatGPT connected (${account.planType??'plan unavailable'}).`);
 else{
  const completed=new Promise<boolean>(resolve=>client.onNotification(p=>{if(p.method==='account/login/completed')resolve(p.params?.success===true);if(p.method==='client/closed')resolve(false);}));
  const login=await client.call<{authUrl:string}>('account/login/start',{type:'chatgpt'});
  const url=new URL(login.authUrl);if(url.protocol!=='https:'||url.hostname!=='auth.openai.com')throw Error('Unexpected login URL.');
  console.log('Open this official link and sign in with your ChatGPT subscription account:\n'+login.authUrl);
  if(!await completed)throw Error('ChatGPT sign-in did not complete.');console.log('ChatGPT sign-in complete. TASTESTUDIO can now use Codex.');
 }
}finally{clearTimeout(timer);client.close();}
