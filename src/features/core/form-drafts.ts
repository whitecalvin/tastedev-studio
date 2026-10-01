export type CoreForm='agent'|'job';
export type FormDraft=Record<string,string|boolean>;
export const defaultForms:Record<CoreForm,FormDraft>={agent:{name:'',platform:'windows',architecture:'x86_64',cpu:'1',memory:'1024',node:'',docker:false,gpu:false,pty:false,browser:false},job:{name:'',executable:'',timeout:'60',args:'[]',platform:'',architecture:'',node:'',priority:'0',browser:'',docker:false,requestId:''}};
export function coreFormDrafts(value:unknown):Record<CoreForm,FormDraft>{
 const result=structuredClone(defaultForms);if(!value||typeof value!=='object')return result;
 for(const kind of ['agent','job'] as const){const source=(value as Record<string,unknown>)[kind];if(!source||typeof source!=='object')continue;for(const [key,initial]of Object.entries(defaultForms[kind])){const v=(source as Record<string,unknown>)[key];if(typeof v===typeof initial&&(typeof v!=='string'||v.length<=10000))result[kind][key]=v as string|boolean;}}
 return result;
}
export function jobCreationKey(draft:FormDraft){const existing=draft.requestId;return typeof existing==='string'&&/^[a-f0-9-]{36}$/.test(existing)?existing:crypto.randomUUID();}
