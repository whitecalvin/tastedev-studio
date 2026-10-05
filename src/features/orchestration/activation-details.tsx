'use client';
import {GraphArtifactReceiptView,GraphArtifactInstallationView} from './artifact-receipt-view';
import {GraphArtifactPlanView} from './artifact-plan-view';
import type {GraphArtifactPlan} from './artifact-plans';
import {useI18n} from '@/i18n/react';
import type {GraphActivation} from './execution';

export function GraphActivationDetails({activation,running,artifactPlans}:{activation:GraphActivation;running:boolean;artifactPlans?:GraphArtifactPlan[]}) {
 const {t}=useI18n();
 return <>{running&&['ready','queued'].includes(activation.status)&&!!activation.waitingReasons?.length&&<div className="orch-activation-wait"><strong>{t('Execution waiting reason')}</strong><ul>{activation.waitingReasons.map(reason=><li key={reason}>{t(reason)}</li>)}</ul></div>}{activation.reason&&<p>{t(activation.reason)}</p>}<GraphArtifactPlanView plans={artifactPlans}/><GraphArtifactReceiptView receipts={activation.artifactReceipts}/><GraphArtifactInstallationView receipts={activation.artifactInstallations}/></>;
}
