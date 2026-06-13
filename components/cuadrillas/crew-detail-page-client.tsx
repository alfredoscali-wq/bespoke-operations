"use client"

import { useMemo } from "react"
import { notFound } from "next/navigation"

import { CrewDetailView } from "@/components/cuadrillas/crew-detail-view"
import { useOperationalData } from "@/components/cuadrillas/use-operational-data"
import { getCrewById, getCrewDetail } from "@/lib/data/crews"

type CrewDetailPageClientProps = {
  id: string
}

export function CrewDetailPageClient({ id }: CrewDetailPageClientProps) {
  const { tasks, projects, evidence } = useOperationalData()
  const crew = getCrewById(id)

  const detail = useMemo(
    () => (crew ? getCrewDetail(crew, tasks, projects, evidence) : null),
    [crew, tasks, projects, evidence]
  )

  if (!crew || !detail) {
    notFound()
  }

  return <CrewDetailView crew={crew} detail={detail} />
}
