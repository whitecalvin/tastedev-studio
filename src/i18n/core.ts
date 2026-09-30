export const languages=['ko','en','de','es','fr','it','pt','ja','zh','zh-hant'] as const;
export type Language=typeof languages[number];
export type LanguagePreference=Language|'system';
export const languageKey='tastedev.studio.language.v1';
export const languageNames:Record<Language,string>={ko:'한국어',en:'English',de:'Deutsch',es:'Español',fr:'Français',it:'Italiano',pt:'Português (Brasil)',ja:'日本語',zh:'简体中文','zh-hant':'繁體中文'};
export const languageLocales:Record<Language,string>={ko:'ko-KR',en:'en-US',de:'de-DE',es:'es-ES',fr:'fr-FR',it:'it-IT',pt:'pt-BR',ja:'ja-JP',zh:'zh-Hans','zh-hant':'zh-Hant'};
export function languagePreference(value:unknown):LanguagePreference{return typeof value==='string'&&(languages as readonly string[]).includes(value)?value as Language:'system';}
export function systemLanguage(values:readonly string[]|undefined):Language{
 const first=values?.find(v=>typeof v==='string'&&v.trim())?.trim().toLowerCase().replaceAll('_','-');
 if(!first)return 'en';
 const [base,...parts]=first.split('-');
 if(base==='zh')return parts.includes('hant')||(!parts.includes('hans')&&parts.some(p=>['tw','hk','mo'].includes(p)))?'zh-hant':'zh';
 return (languages as readonly string[]).includes(base)?base as Language:'en';
}
export function resolveLanguage(preference:LanguagePreference,system:readonly string[]|undefined):Language{return preference==='system'?systemLanguage(system):preference;}
export function interpolate(message:string,values:Record<string,string|number>={}){return message.replace(/\{([A-Za-z0-9_]+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match);}
