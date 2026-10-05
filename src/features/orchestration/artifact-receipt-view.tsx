'use client';
import {PackageCheck} from 'lucide-react';
import {useI18n} from '@/i18n/react';
import type {GraphArtifactReceipt} from './artifact-receipts';

export function GraphArtifactReceiptView({receipts}:{receipts?:GraphArtifactReceipt[]}){
 const {t}=useI18n();if(!receipts?.length)return null;
 return <details className="orch-artifact-plans orch-artifact-receipts"><summary><PackageCheck size={14} aria-hidden="true"/>{t('Outputs verified by Core')}<span>{receipts.reduce((n,r)=>n+r.outputs.length,0)}</span></summary>
  <p className="orch-artifact-note">{t('Historical verification only. This does not prove the entire Run passed or the artifact is still available.')}</p>
  {receipts.map(receipt=><section key={receipt.stepId}><p className="orch-artifact-note">{t('Verified at')}: <time dateTime={receipt.verifiedAt}>{receipt.verifiedAt}</time></p>{receipt.outputs.map(artifact=><details key={artifact.id} className="orch-artifact-receipt"><summary>{artifact.name} · {artifact.size.toLocaleString()} {t('bytes')}</summary><dl>
   <dt>{t('Artifact ID')}</dt><dd>{artifact.id}</dd>{artifact.executable!==undefined&&<><dt>{t('Executable policy')}</dt><dd>{t(artifact.executable?'Executable (owner only on Unix)':'Data file (owner only on Unix)')}</dd></>}<dt>{t('Output path')}</dt><dd>{artifact.path}</dd><dt>{t('Checksum')}</dt><dd>{artifact.checksum}</dd>
   <dt>{t('Producer Run')}</dt><dd>{artifact.producerRunId}</dd><dt>{t('Producer Step')}</dt><dd>{artifact.producerStepId}</dd><dt>Snapshot ID</dt><dd>{artifact.snapshotId}</dd><dt>{t('Source checksum')}</dt><dd>{artifact.sourceChecksum}</dd>
  </dl></details>)}</section>)}
 </details>;
}

export function GraphArtifactInstallationView({receipts}:{receipts?:import('./artifact-installation').ArtifactInstallationReceipt[]}){
 const {t}=useI18n();if(!receipts?.length)return null;
 return <details className="orch-artifact-plans orch-artifact-receipts"><summary><PackageCheck size={14} aria-hidden="true"/>{t('Agent installation receipts')}<span>{receipts.reduce((n,r)=>n+r.inputs.length,0)}</span></summary><p className="orch-artifact-note">{t('Authenticated Agent installation report. This does not mean the test passed or attest the physical device.')}</p>{receipts.map(r=><section key={r.consumerStepId}><p className="orch-artifact-note"><time dateTime={r.verifiedAt}>{r.verifiedAt}</time></p>{r.inputs.map(i=><details className="orch-artifact-receipt" key={i.artifact.id}><summary>{i.artifact.name} · {i.artifact.size.toLocaleString()} {t('bytes')}</summary><dl><dt>{t('Artifact ID')}</dt><dd>{i.artifact.id}</dd>{i.artifact.executable!==undefined&&<><dt>{t('Executable policy')}</dt><dd>{t(i.artifact.executable?'Executable (owner only on Unix)':'Data file (owner only on Unix)')}</dd></>}<dt>{t('Installation path')}</dt><dd>{i.path}</dd><dt>{t('Checksum')}</dt><dd>{i.artifact.checksum}</dd><dt>{t('Producer Run')}</dt><dd>{i.artifact.producerRunId}</dd><dt>{t('Producer Step')}</dt><dd>{i.artifact.producerStepId}</dd><dt>{t('Consumer Run')}</dt><dd>{r.consumerRunId}</dd><dt>{t('Consumer Step')}</dt><dd>{r.consumerStepId}</dd><dt>{t('Agent')}</dt><dd>{r.agentId}</dd><dt>Snapshot ID</dt><dd>{i.artifact.snapshotId}</dd></dl></details>)}</section>)}</details>;
}
