"use client"

import { useEffect, useMemo, useState } from "react"

import {
  ProjectDesignTendidoOtTracesSummary,
  ProjectDesignTraceDetailCard,
} from "@/components/obras/design/project-design-trace-detail"
import { formatGainMeters, formatPlannedLengthMeters } from "@/lib/gps/distance"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { readProjectDesignSourceMetadata } from "@/lib/projects/design/ot-proposals"
import { buildTendidoOtTracesView } from "@/lib/projects/design/trace-detail"
import { listProjectDesign } from "@/lib/supabase/project-design.browser"
import type { ProjectDesignSnapshot } from "@/lib/types/project-design"
import type { Task } from "@/lib/types/tasks"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const EMPTY_SEGMENT_IDS: string[] = []

type ProjectDesignTendidoOtTracesSectionProps = {
  task: Task
}

export function ProjectDesignTendidoOtTracesSection({
  task,
}: ProjectDesignTendidoOtTracesSectionProps) {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [snapshot, setSnapshot] = useState<ProjectDesignSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const source = readProjectDesignSourceMetadata(task.taskMetadata)
  const segmentIds =
    source?.kind === "segments" ? source.segmentIds : EMPTY_SEGMENT_IDS
  const projectId = task.projectId?.trim() || ""
  const shouldLoad = Boolean(projectId && segmentIds.length > 0)

  useEffect(() => {
    if (!isAuthReady || !companyId || !shouldLoad) {
      return
    }

    let cancelled = false
    void listProjectDesign(companyId, projectId).then((result) => {
      if (cancelled) {
        return
      }
      setSnapshot(result.data)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, projectId, shouldLoad])

  const view = useMemo(
    () =>
      buildTendidoOtTracesView({
        snapshot: shouldLoad ? snapshot : null,
        segmentIds,
      }),
    [segmentIds, shouldLoad, snapshot]
  )

  if (source?.kind !== "segments") {
    return null
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Trazas de la OT</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando trazas del diseño…</p>
        ) : view.traces.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
            Esta OT no tiene trazas disponibles en el diseño actual.
          </p>
        ) : (
          <ul className="space-y-3">
            {view.traces.map((trace) => (
              <li key={trace.id} className="rounded-lg border bg-muted/20 px-3 py-2.5">
                <ProjectDesignTraceDetailCard detail={trace} compact />
              </li>
            ))}
          </ul>
        )}

        <ProjectDesignTendidoOtTracesSummary
          plannedLengthLabel={formatPlannedLengthMeters(view.plannedLengthM)}
          traceGainLabel={formatGainMeters(view.traceGainM)}
          plannedCableLabel={formatPlannedLengthMeters(view.plannedCableM)}
        />
      </CardContent>
    </Card>
  )
}
