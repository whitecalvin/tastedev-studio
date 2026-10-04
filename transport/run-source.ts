import type {CoreService} from '../src/features/core/service.ts';
import type {ProjectSnapshot} from '../src/features/ai/project-snapshot.ts';
import {uuid} from '../src/features/ai/security.ts';
/** A Run ID binds reads to the transferred immutable Source, never the current workspace. */
export function runSource(core:CoreService,project:string,runId:string){
 uuid(runId);const snapshot=core.snapshot(project,undefined,runId),run=snapshot.runs.find(r=>r.id===runId&&r.projectId===project),job=snapshot.jobs.find(j=>j.id===run?.jobId&&j.projectId===project),source=job?.payload.steps.find(s=>s.source?.provider==='snapshot')?.source;
 if(!run||source?.provider!=='snapshot'||source.snapshot.schemaVersion!==2||run.revision?.snapshotId!==source.snapshot.snapshotId||run.revision.commit!==source.snapshot.checksum||run.revision.proposalId!==source.snapshot.proposalId||run.revision.attempt!==source.snapshot.attempt)throw Error('Run Snapshot unavailable or identity mismatch.');return source.snapshot as ProjectSnapshot;
}
