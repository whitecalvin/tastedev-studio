'use client';
import {useI18n} from '@/i18n/react';
import type {GraphOverview} from './execution';

/** Render only the captured execution. Never substitute the latest published Source. */
export function ExecutionIdentity({execution}:{execution:GraphOverview['executions'][number]}){
 const {t}=useI18n(),source=execution.source;
 return <details className="orch-execution-identity"><summary>{t('Captured execution identity')}</summary><p>{t('These values belong to this historical execution, not the current workspace or latest published configuration.')}</p><dl>
  <dt>{t('Execution ID')}</dt><dd>{execution.id}</dd>
  <dt>{t('Project ID')}</dt><dd>{execution.projectId}</dd>
  <dt>{t('Captured configuration version')}</dt><dd>{execution.revision}</dd>
  <dt>{t('Published graph checksum')}</dt><dd>{execution.checksum}</dd>
  <dt>{t('Protocol input checksum')}</dt><dd>{execution.inputChecksum}</dd>
  <dt>{t('Created')}</dt><dd><time dateTime={execution.createdAt}>{execution.createdAt}</time></dd>
  {execution.finishedAt&&<><dt>{t('Finished')}</dt><dd><time dateTime={execution.finishedAt}>{execution.finishedAt}</time></dd></>}
  {source&&<><dt>{t('Source base revision')}</dt><dd>{source.baseRevision}</dd><dt>Snapshot ID</dt><dd>{source.snapshotId}</dd><dt>{t('Snapshot manifest checksum')}</dt><dd>{source.checksum}</dd><dt>{t('Proposal ID')}</dt><dd>{source.proposalId}</dd><dt>{t('Attempt')}</dt><dd>{source.attempt}</dd></>}
 </dl>{!source&&<p>{t('No graph-level Snapshot was captured. Review the individual Run or AI analysis for its tested Source identity.')}</p>}</details>;
}
