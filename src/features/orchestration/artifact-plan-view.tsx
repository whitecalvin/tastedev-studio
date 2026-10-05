'use client';
import {Package} from 'lucide-react';
import {useI18n} from '@/i18n/react';
import type {GraphArtifactPlan} from './artifact-plans';

export function GraphArtifactPlanView({plans}:{plans?:GraphArtifactPlan[]}){
 const {t}=useI18n();if(!plans?.length)return null;
 return <details className="orch-artifact-plans"><summary><Package size={14} aria-hidden="true"/>{t('Build artifact flow')} <span>{plans.reduce((n,p)=>n+p.outputs.length+p.inputs.length,0)}</span></summary>
  <p className="orch-artifact-note">{t('Declared transfer scope. A declaration does not prove that files were transferred.')}</p>
  {plans.map((plan,index)=><section key={`${plan.taskReference}:${index}`}><strong>{plan.stepName}</strong><div className="orch-artifact-columns">
   {!!plan.outputs.length&&<div><h4>{t('Declared outputs')}</h4><ul>{plan.outputs.map(output=><li key={output.name}><span>{output.name}</span><code>{output.path}</code>{output.executable!==undefined&&<span>{t(output.executable?'Executable (owner only on Unix)':'Data file (owner only on Unix)')}</span>}</li>)}</ul></div>}
   {!!plan.inputs.length&&<div><h4>{t('Required inputs')}</h4><ul>{plan.inputs.map(input=><li key={`${input.fromTask}:${input.name}`}><span>{input.fromTask} → {input.name}</span><code>{input.path}</code>{input.executable!==undefined&&<span>{t(input.executable?'Executable (owner only on Unix)':'Data file (owner only on Unix)')}</span>}</li>)}</ul></div>}
  </div></section>)}
  <p className="orch-artifact-note">{t('Paths are relative to this step’s working directory. Existing input files are protected.')}</p>
 </details>;
}
export function CapturedArtifactPlans({plans,labels}:{plans?:Record<string,GraphArtifactPlan[]>;labels:Record<string,string>}){
 const {t}=useI18n();const rows=Object.entries(plans??{});if(!rows.length)return null;
 return <details className="orch-artifact-plans"><summary><Package size={14} aria-hidden="true"/>{t('Captured build artifact plan')}<span>{rows.length}</span></summary>{rows.map(([nodeId,plan])=><section key={nodeId}><strong>{labels[nodeId]??nodeId}</strong><GraphArtifactPlanView plans={plan}/></section>)}</details>;
}
