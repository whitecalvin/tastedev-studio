import {AIError} from '../src/features/ai/domain.ts';
import type {CodexClient} from './codex-client.ts';
/** Reauthentication stays within the existing isolated ChatGPT home; no API fallback. */
export async function startChatGPTLogin(client:Pick<CodexClient,'call'>){
 type Account={type:string;planType?:string}|null;let account:Account=null;
 try{({account}=await client.call<{account:Account}>('account/read',{refreshToken:false}));}
 catch(error){if(!(error instanceof AIError)||error.code!=='authentication')throw error;}
 if(account?.type==='chatgpt')return{connected:true as const,plan:account.planType??'plan unavailable'};
 const login=await client.call<{authUrl:string;loginId:string}>('account/login/start',{type:'chatgpt'});
 const url=new URL(login.authUrl);
 if(url.protocol!=='https:'||!['auth.openai.com','chatgpt.com'].includes(url.hostname)||url.username||url.password||typeof login.loginId!=='string'||!login.loginId||login.loginId.length>200)throw new AIError('authentication');
 return{connected:false as const,authUrl:url.href,loginId:login.loginId};
}
