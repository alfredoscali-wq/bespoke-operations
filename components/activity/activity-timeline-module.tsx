"use client"

import Link from "next/link"
import { Radar } from "lucide-react"

import { EntityActivityTimeline } from "@/components/activity/entity-activity-timeline"
import { GLOBAL_TIMELINE_FILTERS } from "@/lib/activity/activity-timeline-types"
import { useIsSystemAdministrator } from "@/lib/auth/use-is-system-administrator"

export function ActivityTimelineModule() {
  const isAdministrator = useIsSystemAdministrator()

  if (!isAdministrator) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Activity Engine</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Solo los administradores pueden acceder al centro de auditoría.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[520px] flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Radar className="size-6 text-muted-foreground" />
          Timeline Global
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Auditoría técnica. Para la lectura de negocio usá{" "}
          <Link
            href="/activity/jornada"
            className="underline underline-offset-4"
          >
            Actividad de la Jornada
          </Link>
          .
        </p>
      </div>

      <EntityActivityTimeline
        scope={{ kind: "global" }}
        visibleFilters={GLOBAL_TIMELINE_FILTERS}
        layout="global"
        showStats
      />
    </div>
  )
}
