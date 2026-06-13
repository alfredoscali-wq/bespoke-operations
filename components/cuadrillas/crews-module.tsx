"use client"

import { useMemo, useState } from "react"

import { CrewsFiltersBar } from "@/components/cuadrillas/crews-filters"
import { CrewsSummaryCards } from "@/components/cuadrillas/crews-summary-cards"
import { CrewsTable } from "@/components/cuadrillas/crews-table"
import { useOperationalData } from "@/components/cuadrillas/use-operational-data"
import {
  defaultCrewFilters,
  filterCrews,
  getCrewListItems,
  getCrewSpecialtyOptions,
  mockCrews,
} from "@/lib/data/crews"
import type { CrewFilters } from "@/lib/types/crews"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function CrewsModule() {
  const { tasks, projects, evidence } = useOperationalData()
  const [filters, setFilters] = useState<CrewFilters>(defaultCrewFilters)

  const listItems = useMemo(
    () => getCrewListItems(mockCrews, tasks, projects),
    [tasks, projects, evidence]
  )

  const specialties = useMemo(() => getCrewSpecialtyOptions(mockCrews), [])

  const filteredCrews = useMemo(
    () => filterCrews(listItems, filters),
    [listItems, filters]
  )

  return (
    <div className="space-y-6">
      <CrewsSummaryCards crews={mockCrews} tasks={tasks} projects={projects} />

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Equipos de trabajo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <CrewsFiltersBar
            filters={filters}
            onChange={setFilters}
            resultCount={filteredCrews.length}
            specialties={specialties}
          />
          <CrewsTable crews={filteredCrews} />
        </CardContent>
      </Card>
    </div>
  )
}
