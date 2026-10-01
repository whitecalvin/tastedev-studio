'use client';
import { useI18n } from '@/i18n/react';
import { useFiles } from './session';
export function ProblemsView(){const {t}=useI18n();const {problems,documents,run,connection}=useFiles();return <section aria-label={t('Problems')}><p>{t('TypeScript and JavaScript diagnostics include bounded project dependency types.')}</p>{!problems.length?<p>{t('No diagnostics reported.')}</p>:<ul>{problems.map((problem,index)=><li key={`${problem.path}:${problem.line}:${index}`}><button className="ws-text-button" disabled={connection?.permission!=='granted'} onClick={()=>void run('Opening diagnostic…',async()=>{await documents.open(problem.path);documents.reveal(problem.line);})}>{problem.path}:{problem.line}:{problem.column}</button>{' '}{problem.message}</li>)}</ul>}</section>;}
