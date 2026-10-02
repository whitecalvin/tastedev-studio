'use client';
import { useI18n } from '@/i18n/react';
import {AnalyzeFailure} from '../ai/views';
import {CreateIssueCandidate} from '../issues/views';
import { useState } from 'react';
import { useCore } from './context';
import { useWorkspace } from '../workspace/context';
import { activeRun } from './domain';
import {EvidenceSummary,EvidenceViewer} from './evidence-viewer';
import { testResult } from './orchestrator';
const executionLabels={PASSED:'Passed',TEST_FAILED:'Test failed',EXECUTION_ERROR:'Could not execute the task',TIMEOUT:'Execution timed out',CANCELLED:'Cancelled',CONNECTION_LOST:'Connection to Core was lost',AGENT_SHUTDOWN:'Agent was stopped',AGENT_RESTARTED:'Agent restarted during execution',CAPABILITY_MISMATCH:'Required tools are unavailable or changed'};

export function PipelineRunDetail({id}:{id:string}) {
  const { t } = useI18n();

  const {snapshot,logs,service,project,select,setMessage}=useCore();
  const {dispatch}=useWorkspace();
  const run=snapshot.runs.find(r=>r.id===id)!;
  const job=snapshot.jobs.find(j=>j.id===run.jobId)!;
  const steps=snapshot.steps.filter(s=>s.runId===id).sort((a,b)=>a.order-b.order);
  const projection=testResult(run,steps,job.payload.testPlan!.testName,job.payload.testPlan!.type);
  const [selected,setSelected]=useState<string|null>(null);
  const chosen=steps.find(s=>s.id===selected)??projection.failedStep??steps.find(s=>s.status==='running')??steps[0];
  const output=(logs[id]??[]).filter(c=>c.runStepId===chosen?.id);
  const perform=async(action:()=>unknown)=>{try{await action();}catch(e){setMessage(e instanceof Error?e.message:'Run action failed.');}};
  return <section className="core-detail pipeline-detail"><h1>{projection.testName}</h1><p className="core-description">{projection.type} · <strong>{run.status.toUpperCase()}</strong> · {steps.filter(s=>!['pending','running'].includes(s.status)).length}/{steps.length} {t("steps ·")} {(projection.duration/1000).toFixed(1)}{t("s")}</p>
    {projection.failedStep&&<div className="core-notice" role="status"><strong>{t("Primary failure:")} {projection.failedStep.name}</strong><p>{projection.failedStep.failureReason} {t("· Exit")} {projection.failedStep.exitCode??t("not reported")}</p><button className="ws-text-button" onClick={()=>setSelected(projection.failedStep!.id)}>{t("View")} {projection.failedStep.name} {t("logs")}</button></div>}
    {steps.find(s=>s.browserResult)&&<EvidenceSummary result={steps.find(s=>s.browserResult)!.browserResult!} artifacts={snapshot.artifacts.filter(a=>a.runId===id)}/>}
    {run.cleanupWarning&&<p role="status">{t("Cleanup warning:")} {run.cleanupWarning}</p>}
    <dl className="core-fields"><div><dt>{t("Agent")}</dt><dd>{snapshot.agents.find(a=>a.id===run.agentId)?.name??run.agentId}</dd></div><div><dt>{t("Run")}</dt><dd>{id}</dd></div><div><dt>{t("Source")}</dt><dd>{run.revision?.repository??(job.payload.steps.find(s=>s.source)?.source?.repository?t("Preparing source…"):t("Empty workspace"))}</dd></div>{run.revision&&<><div><dt>{run.revision.snapshotId?t("Base revision"):t("Branch / revision")}</dt><dd>{run.revision.branch}</dd></div><div><dt>{run.revision.snapshotId?t("Manifest checksum"):t("Commit SHA")}</dt><dd><code>{run.revision.commit}</code></dd></div></>}</dl>
    {run.revision&&<p className="core-description">{run.revision.snapshotId?<>{t("Remote test uses workspace snapshot")} {run.revision.snapshotId}{t(", proposal")} {run.revision.proposalId}{t(", attempt")} {run.revision.attempt}{t(". Manifest checksum:")} {run.revision.commit}{t(". Saved workspace changes are included; unsaved editor changes are excluded.")}</>:<>{t("Remote test uses Git revision")} {run.revision.commit.slice(0,12)}{t(". Unsaved or uncommitted local changes are not included.")}</>}</p>}
    <div className="core-actions"><CreateIssueCandidate runId={id}/>{projection.failedStep&&<AnalyzeFailure runId={id}/>} {activeRun(run)&&<button className="button" disabled={!!job.cancellationRequestedAt} onClick={()=>void perform(()=>service.cancelJob(project.id,job.id))}>{t("Cancel test")}</button>}{job.status==='failed'&&<button className="button" disabled={job.attempt>=job.maxAttempts} onClick={()=>void perform(async()=>{const retry=await service.retryJob(project.id,job.id);select({kind:'job',id:retry.id});dispatch({type:'activity',value:'queue'});})}>{t("Retry test")}</button>}</div>
    <details><summary>{t("Execution profile")}</summary><pre>{JSON.stringify({requested:job.payload.testPlan!.executionProfile??null,observed:run.executionEnvironment??run.agentEnvironment??null},null,2)}</pre></details><h2>{t("Pipeline steps")}</h2><div className="core-table-scroll"><table><thead><tr><th>{t("Step")}</th><th>{t("Task")}</th><th>{t("Status")}</th><th>{t("Duration")}</th><th>{t("Exit")}</th></tr></thead><tbody>{steps.map(s=><tr key={s.id} aria-selected={s.id===chosen?.id}><td><button className="ws-text-button" aria-pressed={s.id===chosen?.id} onClick={()=>setSelected(s.id)}>{s.order+1}. {s.name}</button></td><td>{s.taskReference??'—'}</td><td>{t(s.status)}</td><td>{s.startedAt?`${Math.max(0,Date.parse(s.finishedAt??new Date().toISOString())-Date.parse(s.startedAt))/1000}s`:'—'}</td><td>{s.exitCode??'—'}</td></tr>)}</tbody></table></div>
    <h2>{chosen?.name} {t("logs")}</h2>{chosen?.failureReason&&<p>{chosen.failureReason}</p>}{chosen?.serviceId&&<p>{t("Service process:")} {chosen.serviceId} {t("· stopped during cleanup or termination")}</p>}
    {chosen?.executionReport&&<p className="core-description">{t("Execution result:")} {t(executionLabels[chosen.executionReport.classification])}</p>}
    {chosen?.executionReport?.outputSummary?.partial&&<p className="core-notice" role="status">{t("Some live output was omitted because the log limit or transfer queue was full.")} {chosen.executionReport.outputSummary.droppedChunks} {t("chunks omitted.")}</p>}
    <p className="core-description">{t("Live stdout / stderr · latest 128 KiB retained per run")}</p><pre className="core-live-log" aria-label={t("Step log")} tabIndex={0}>{output.length?output.map(c=><span key={`${c.runStepId}-${c.sequence}`} className={c.stream==='stderr'?'core-stderr':undefined}>{`[${c.stream}] ${c.text}`}</span>):t("No output for this step.")}</pre>
    <EvidenceViewer key={id} runId={id}/><h2>{t("Result")}</h2><p>{run.result?.summary??t("Execution in progress.")}</p><h2>{t("Artifacts")}</h2><p className="core-description">{snapshot.artifacts.filter(a=>a.runId===id).map(a=>`${a.name} · ${a.runStepId??'Run'}`).join(', ')||t("No artifact metadata recorded.")}</p>
  </section>;
}
