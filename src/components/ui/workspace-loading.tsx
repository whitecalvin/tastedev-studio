'use client';
import {Boxes,LoaderCircle} from 'lucide-react';
import {useI18n} from '@/i18n/react';

/** Shared initial workspace state; it never masks an error or adds a loading delay. */
export function WorkspaceLoading({message='Loading workspace…'}:{message?:string}){
 const {t}=useI18n();
 return <div className="workspace-loading" role="status" aria-live="polite" aria-busy="true">
  <div className="workspace-loading-content">
   <div className="workspace-loading-brand"><Boxes size={24} aria-hidden="true"/><span>TASTESTUDIO</span></div>
   <LoaderCircle className="workspace-loading-spinner" size={24} aria-hidden="true"/>
   <p>{t(message)}</p>
  </div>
 </div>;
}
