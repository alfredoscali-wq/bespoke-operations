"use client"

import { useMemo } from "react"
import { notFound } from "next/navigation"

import { CrewDetailView } from "@/components/cuadrillas/crew-detail-view"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useCrewEvidenceRecords } from "@/components/cuadrillas/use-crew-evidence-records"
import { useOperationalData } from "@/components/cuadrillas/use-operational-data"
import { getCrewDetail } from "@/lib/crews/utils"

type CrewDetailPageClientProps = {
  id: string
}

export function CrewDetailPageClient({ id }: CrewDetailPageClientProps) {
  const { getCrew } = useCrews()
  const { tasks, projects } = useOperationalData()
  const { evidence } = useCrewEvidenceRecords()
  const crew = getCrew(id)

  const detail = useMemo(
    () => (crew ? getCrewDetail(crew, tasks, projects, evidence) : null),
    [crew, tasks, projects, evidence]
  )

  if (!crew || !detail) {
    notFound()
  }

  return <CrewDetailView crew={crew} detail={detail} />
}
