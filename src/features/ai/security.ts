import {AIError} from './domain.ts';
export function aiPath(value:unknown){
 if(typeof value!=='string'||!value||value.length>512||/^[\\/]|[:\\%\x00-\x1f]/.test(value)||value.split('/').some(p=>!p||p==='.'||p==='..'||p.startsWith('.env')||/^(\.git|\.ssh|\.npmrc|\.netrc|\.pypirc|node_modules|target|dist|build|out|coverage|\.next)$/i.test(p)||/secret|credential|password|token|\.pem$|\.key$|\.pfx$|\.p12$|\.kdbx$|^id_rsa|^id_ed25519/i.test(p)))throw new AIError('tool-failure');return value;
}
export function allowedPath(value:string){try{aiPath(value);return true;}catch{return false;}}
export function mask(text:string,secrets:string[]=[]){
 let result=text.replace(/\x1b\[[0-9;]*m/g,'');for(const secret of secrets.filter(Boolean).sort((a,b)=>b.length-a.length))result=result.split(secret).join('[redacted]');
 result=result.replace(/https?:\/\/[^\s"'<>`\\]+/g,raw=>{try{const u=new URL(raw);if(!u.username&&!u.password&&!u.search&&!u.hash)return raw;u.username='';u.password='';u.search=u.search?'?[redacted]':'';u.hash='';return u.href;}catch{return '[url]';}});
 return result.replace(/\bsk-[A-Za-z0-9_-]{12,}/g,'[redacted]').replace(/(authorization|password|token|secret|api[_-]?key)(["']?\s*[:=]\s*["']?)(?:Bearer\s+)?[^\s,"'}]+/gi,'$1$2[redacted]');
}
export function uuid(value:unknown){if(typeof value!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value))throw new AIError('tool-failure');return value;}
export function args(value:unknown,keys:string[]){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw new AIError('tool-failure');return value as Record<string,unknown>;}

export function sanitize(value:unknown,secrets:string[]=[]):unknown { if(typeof value==='string')return mask(value,secrets);if(Array.isArray(value))return value.map(v=>sanitize(v,secrets));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,/^(authorization|password|token|secret|api[_-]?key)$/i.test(k)?'[redacted]':sanitize(v,secrets)]));return value; }
