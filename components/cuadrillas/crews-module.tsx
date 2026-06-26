"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { CrewFormDialog } from "@/components/cuadrillas/crew-form-dialog"
import { CrewsFiltersBar } from "@/components/cuadrillas/crews-filters"
import { CrewsSummaryCards } from "@/components/cuadrillas/crews-summary-cards"
import { CrewsTable } from "@/components/cuadrillas/crews-table"
import { useOperationalData } from "@/components/cuadrillas/use-operational-data"
import {
  defaultCrewFilters,
  filterCrews,
  getCrewListItems,
  getSupervisorOptions,
} from "@/lib/crews/utils"
import type { CrewFilters } from "@/lib/types/crews"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function CrewsModule() {
  const { crews, addCrew } = useCrews()
  const { getEmployee } = useEmployees()
  const { tasks, projects } = useOperationalData()
  const [filters, setFilters] = useState<CrewFilters>(defaultCrewFilters)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const listItems = useMemo(
    () => getCrewListItems(crews, tasks, projects),
    [crews, tasks, projects]
  )

  const supervisors = useMemo(
    () => getSupervisorOptions(crews, getEmployee),
    [crews, getEmployee]
  )

  const filteredCrews = useMemo(
    () => filterCrews(listItems, filters, getEmployee),
    [listItems, filters, getEmployee]
  )

  async function handleCreateCrew(input: Parameters<typeof addCrew>[0]) {
    const result = await addCrew(input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo crear la cuadrilla.")
    }
    setFeedback("Cuadrilla creada correctamente.")
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {feedback && (
            <p className="text-sm text-emerald-700" role="status">
              {feedback}
            </p>
          )}
        </div>
        <Button size="sm" className="gap-1.5 self-start" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Nueva Cuadrilla
        </Button>
      </div>

      <CrewsSummaryCards crews={crews} tasks={tasks} projects={projects} />

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Equipos de trabajo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <CrewsFiltersBar
            filters={filters}
            onChange={setFilters}
            resultCount={filteredCrews.length}
            supervisors={supervisors}
          />
          <CrewsTable crews={filteredCrews} />
        </CardContent>
      </Card>

      <CrewFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="create"
        onSubmit={handleCreateCrew}
      />
    </div>
  )
}
