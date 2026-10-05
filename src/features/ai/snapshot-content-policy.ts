import {mask} from './security.ts';

/** Source transfer is byte-preserving. AI display masking is deliberately unchanged. */
export function snapshotHasSecret(path:string,text:string,secrets:string[]=[]):boolean {
 if(secrets.some(s=>s&&text.includes(s))||/\bsk-[A-Za-z0-9_-]{12,}/.test(text))return true;
 // Rust fields such as `password: Option<&str>` contain a type, not a credential.
 // Other data/code formats retain the existing conservative policy.
 if(!path.endsWith('.rs')||!/(?:\b(?:fn|struct|enum|impl|use|mod|const|static|let|pub)\b)/.test(text))return mask(text)!==text;
 const key='(?:authorization|password|token|secret|api[_-]?key)';
 const literal=new RegExp(`(?:["']${key}["']\\s*:|(?<![\\w"'])\\b${key}\\b\\s*:|(?<![\\w"'])\\b${key}\\b(?:\\s*:[^=;\\r\\n]+)?\\s*=)\\s*(?:b?r#{0,16}|b)?["']`,'i');
 if(literal.test(text))return true;
 const urls=text.match(/https?:\/\/[^\s"'<>`\\]+/g)??[];
 for(const raw of urls){
  try{const url=new URL(raw);if(url.username||url.password||[...url.searchParams.keys()].some(k=>/authorization|password|token|secret|api[_-]?key|credential|signature|^sig$/i.test(k)))return true;}catch{
   // Source may document a protocol prefix or URL placeholder. Potential private
   // userinfo/query assignments still fail closed, including malformed URLs.
   if(raw.includes('@')||/[?&#](?:authorization|password|token|secret|api[_-]?key|credential|signature|sig)=/i.test(raw))return true;
  }
 }
 // URLs have already been checked above. Do not let AI display sanitization turn
 // a harmless commented URL example into a source-file exclusion.
 let comments=text;for(const url of urls)comments=comments.split(url).join('[public-url]');
 for(const comment of comments.match(/\/\/[^\r\n]*/g)??[])if(mask(comment)!==comment)return true;
 return false;
}
