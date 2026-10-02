'use client';
import {useI18n} from '@/i18n/react';
import {useFiles} from './session';
import {AlertTriangle} from 'lucide-react';

export function LanguageIndexStatus(){
  const {t}=useI18n(),{languageNotices}=useFiles();
  const notices=[...new Set([...languageNotices.monaco,...languageNotices.server])];
  if(!notices.length)return null;
  return <details className="ws-language-status"><summary title={notices.map(message=>t(message)).join('\n')}><AlertTriangle size={12} aria-hidden="true"/>{t('Language index notice')}</summary><div className="ws-language-notices" role="status"><strong>{t('Language index notice')}</strong><ul>{notices.map(message=><li key={message}>{t(message)}</li>)}</ul></div></details>;
}
