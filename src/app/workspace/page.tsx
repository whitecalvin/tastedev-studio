'use client';
import { useI18n } from '@/i18n/react';
import { WorkspaceLoading } from '@/components/ui/workspace-loading';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { WorkspaceProject } from '@/features/workspace/workspace';
function WorkspaceRoute() {
  const { t } = useI18n();
 const id = useSearchParams().get('project'); return id ? <WorkspaceProject key={id} projectId={id} /> : <p>{t("Select a project from the Project Manager.")}</p>; }
export default function Page() { return <Suspense fallback={<WorkspaceLoading/>}><WorkspaceRoute /></Suspense>; }
