import { ProjectWorkReportUnlockForm } from "@/components/obras/project-work-report-unlock-form"
import { ProjectWorkReportView } from "@/components/obras/project-work-report-view"
import { loadProjectWorkReport } from "@/lib/projects/work-report/load-report.server"
import { publicShareDenialMessage } from "@/lib/projects/work-report/share-access"
import {
  publicShareViewerIsUnlocked,
  readProjectWorkReportShareSession,
} from "@/lib/projects/work-report/share-cookie.server"
import { resolvePublicProjectReportShare } from "@/lib/projects/work-report/share.server"
import { projectWorkReportOptionsFromShare } from "@/lib/projects/work-report/share-options"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PublicInformePageProps = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}

function UnavailableState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center">
      <h1 className="text-xl font-semibold">Informe de obra</h1>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export default async function PublicInformePage({
  params,
  searchParams,
}: PublicInformePageProps) {
  const { token } = await params
  const query = await searchParams

  if (!token?.trim()) {
    return <UnavailableState message={publicShareDenialMessage()} />
  }

  const resolved = await resolvePublicProjectReportShare(token)
  if (!resolved.ok) {
    return <UnavailableState message={resolved.message} />
  }

  const session = await readProjectWorkReportShareSession()
  if (!publicShareViewerIsUnlocked(resolved.share, session)) {
    return (
      <ProjectWorkReportUnlockForm
        token={token}
        error={query.error}
      />
    )
  }

  const loaded = await loadProjectWorkReport({
    client: createAdminClient(),
    companyId: resolved.share.companyId,
    projectId: resolved.share.projectId,
    options: projectWorkReportOptionsFromShare(resolved.share),
    photoMode: "signed-url",
  })

  if (!loaded.ok) {
    return <UnavailableState message={publicShareDenialMessage()} />
  }

  return (
    <ProjectWorkReportView
      report={loaded.report}
      pdf={{
        endpoint: `/api/informe/${encodeURIComponent(token)}/pdf`,
        fileName: loaded.fileName,
      }}
    />
  )
}
