'use client';
import {useState} from 'react';
import {useI18n} from '@/i18n/react';
import {useCore} from '../core/context';
import type {RecoveryAudit} from './recovery-audit';
export function RecoveryAuditPanel({executionId,scope,labels={}}:{executionId:string;scope:string;labels?:Record<string,string>}){
 const {t,locale}=useI18n(),core=useCore(),[result,setResult]=useState<{scope:string;value:RecoveryAudit}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function inspect(){if(busy||!core.connection.connected)return;setBusy(true);setError('');const generation=core.connection.generation;
  try{const value=await core.connection.graphRequest<RecoveryAudit>('recovery-inspect',{executionId});if(value.executionId!==executionId||value.projectId!==core.project.id)throw Error('Saved execution identity is inconsistent.');if(generation===core.connection.generation)setResult({scope,value});}
  catch{setError('Recovery inspection failed.');}finally{setBusy(false);}
 }
 const report=result?.scope===scope?result.value:null;
 return <section className="orch-recovery-audit" aria-label={t('Saved execution integrity')}>
  <button type="button" className="fs-button" disabled={busy||!core.connection.connected} onClick={()=>void inspect()}>{t('Inspect saved Run and Source')}</button>
  <p>{t('Inspection does not resume work. Core checks Run, Job and Source identities again before resuming.')}</p>
  {report&&<><p>{t(report.ready?'Saved identities verified.':'Saved execution integrity requires review.')}</p><time dateTime={report.checkedAt}>{new Date(report.checkedAt).toLocaleString(locale)}</time><ul>{report.rows.map(row=><li key={row.activationId}><strong>{Object.hasOwn(labels,row.nodeId)?labels[row.nodeId]:row.nodeId}</strong> · {t('Attempt')} {row.attempt} · {t(row.status)}{row.runId&&<code> · {row.runId}</code>}{row.source&&<small> · {row.source.snapshotId} · {row.source.checksum}</small>}{row.reason&&<p role="alert">{t(row.reason)}</p>}</li>)}</ul></>}
  {error&&<p role="alert">{t(error)}</p>}
 </section>;
}
