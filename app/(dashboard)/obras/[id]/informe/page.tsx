import { notFound, redirect } from "next/navigation"

import { ProjectWorkReportView } from "@/components/obras/project-work-report-view"
import { getSessionUser } from "@/lib/auth/session"
import { LOGIN_PATH } from "@/lib/auth/routes"
import { canAccessObrasModuleForStart } from "@/lib/projects/obra-task-insert-integrity"
import { loadProjectWorkReport } from "@/lib/projects/work-report/load-report.server"
import { parseProjectWorkReportOptionsFromSearch } from "@/lib/projects/work-report/options"
import { createClient } from "@/lib/supabase/server"

import "@/components/obras/project-work-report-print.css"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type InformePageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ scope?: string | string[]; ids?: string | string[] }>
}

export default async function ProjectWorkReportPage({
  params,
  searchParams,
}: InformePageProps) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    redirect(LOGIN_PATH)
  }

  if (!canAccessObrasModuleForStart(sessionUser)) {
    notFound()
  }

  const companyId = sessionUser.companyId?.trim() ?? ""
  if (!companyId) {
    notFound()
  }

  const { id } = await params
  const query = await searchParams
  const options = parseProjectWorkReportOptionsFromSearch(query)

  const client = await createClient()
  const loaded = await loadProjectWorkReport({
    client,
    companyId,
    projectId: id,
    options,
    photoMode: "signed-url",
  })

  if (!loaded.ok) {
    notFound()
  }

  return (
    <div className="p-4 sm:p-6">
      <ProjectWorkReportView
        report={loaded.report}
        backHref={`/obras/${id}`}
        pdf={{
          endpoint: `/api/projects/${id}/work-report`,
          body: options,
          fileName: loaded.fileName,
        }}
      />
    </div>
  )
}
