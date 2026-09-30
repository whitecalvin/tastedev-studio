import { WorkspaceProject } from "@/features/workspace/workspace";
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <WorkspaceProject key={projectId} projectId={projectId} />;
}


export function generateStaticParams() { return process.env.STUDIO_DESKTOP_EXPORT === '1' ? [{ projectId: 'desktop' }] : []; }

