'use client';
import { CustomSelect } from '@/components/ui/custom-select';
import {useCallback,useEffect,useSyncExternalStore} from 'react';
import {Languages} from 'lucide-react';
import {languages,languageNames,languageLocales,languageKey,languagePreference,resolveLanguage,type LanguagePreference,type Language} from './core';
import {translate,translateFeedback} from './messages';

let memoryPreference:LanguagePreference|undefined;
const listeners=new Set<()=>void>();
const notify=()=>{for(const listener of listeners)listener();};
function storageChanged(event:StorageEvent){
 if(event.key===languageKey||event.key===null){memoryPreference=undefined;notify();}
}
function read(){
 let preference:LanguagePreference;
 try{preference=memoryPreference??languagePreference(localStorage.getItem(languageKey));}
 catch{preference=memoryPreference??'system';}
 let system:readonly string[]|undefined;
 try{system=navigator.languages?.length?navigator.languages:[navigator.language];}catch{}
 return `${preference}:${resolveLanguage(preference,system)}`;
}
function subscribe(listener:()=>void){
 if(!listeners.size){
  window.addEventListener('storage',storageChanged);
  window.addEventListener('studio-language',notify);
  window.addEventListener('languagechange',notify);
 }
 listeners.add(listener);
 return()=>{
  listeners.delete(listener);
  if(!listeners.size){
   window.removeEventListener('storage',storageChanged);
   window.removeEventListener('studio-language',notify);
   window.removeEventListener('languagechange',notify);
  }
 };
}
export function setLanguage(value:LanguagePreference){
 memoryPreference=languagePreference(value);
 try{localStorage.setItem(languageKey,memoryPreference);}catch{}
 window.dispatchEvent(new Event('studio-language'));
}
export function useI18n(){
 const state=useSyncExternalStore(subscribe,read,()=> 'system:en');
 const [preference,language]=state.split(':') as [LanguagePreference,Language];
 const t=useCallback((key:string,values?:Record<string,string|number>)=>translate(language,key,values),[language]);
 const feedback=useCallback((message:string)=>translateFeedback(language,message),[language]);
 return{preference,language,locale:languageLocales[language],t,feedback};
}
export function LanguageProvider({children}:{children:React.ReactNode}){
 const {locale}=useI18n();
 useEffect(()=>{document.documentElement.lang=locale;},[locale]);
 return children;
}
export function LanguageControl(){
 const {preference,t}=useI18n();
 return <label className="theme-control language-control">
  <Languages size={16} aria-hidden="true"/><span className="sr-only">{t('Language')}</span>
  <CustomSelect aria-label={t('Language')} value={preference} onChange={event=>setLanguage(event.target.value as LanguagePreference)}>
   <option value="system">{t('System language')}</option>
   {languages.map(language=><option key={language} value={language}>{languageNames[language]}</option>)}
  </CustomSelect>
 </label>;
}
export function I18nText({text}:{text:string}){const{t}=useI18n();return t(text);}
