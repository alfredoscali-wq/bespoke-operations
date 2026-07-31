"use client"

import { EntityProductionView } from "@/components/executive/entity-production-view"
import { CREW_TIMELINE_FILTERS } from "@/lib/activity/activity-timeline-types"

type CrewActivityTabProps = {
  crewId: string
  crewName?: string
}

/** Producción de cuadrilla (misma estructura ejecutiva). */
export function CrewActivityTab({ crewId, crewName }: CrewActivityTabProps) {
  return (
    <EntityProductionView
      timelineScope={{
        kind: "entity",
        entityType: "crew",
        entityId: crewId,
      }}
      timelineFilters={CREW_TIMELINE_FILTERS}
      title="Producción"
      subtitle="Resumen → Producción → Detalle → Timeline"
      entityLabel={crewName}
    />
  )
}
