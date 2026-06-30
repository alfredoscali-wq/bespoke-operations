"use client"

import { useMemo, useState } from "react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { OperarioTaskCard } from "@/components/operario/operario-task-card"
import {
  OperarioCrewEmptyState,
  OperarioCrewStatusMessage,
} from "@/components/operario/operario-crew-status-message"
import { useOperario } from "@/components/operario/operario-provider"
import {
  filterOperarioTodayTasksByJornadaFilter,
  getOperarioTodayTasks,
  summarizeOperarioTodayTasks,
  type OperarioJornadaFilter,
} from "@/lib/data/operario"
import { cn } from "@/lib/utils"

type JornadaFilterChip = {
  id: OperarioJornadaFilter
  label: string
  value: number
}

function OperarioJornadaFilters({
  chips,
  activeFilter,
  onFilterChange,
}: {
  chips: JornadaFilterChip[]
  activeFilter: OperarioJornadaFilter
  onFilterChange: (filter: OperarioJornadaFilter) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {chips.map((chip) => {
        const isActive = activeFilter === chip.id

        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onFilterChange(chip.id)}
            className={cn(
              "rounded-xl border px-2 py-2.5 text-center shadow-sm transition-colors",
              isActive
                ? "border-primary bg-primary/10 ring-2 ring-primary/25"
                : "border-border bg-card hover:bg-muted/40"
            )}
          >
            <span className="block text-[10px] leading-tight text-muted-foreground">
              {chip.label}
            </span>
            <span className="mt-1 block text-lg font-semibold tabular-nums text-foreground">
              {chip.value}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function OperarioHomeScreen() {
  const { tasks } = useTasks()
  const {
    identity,
    isIdentityReady,
    workerCrewRef,
    crewStatus,
    assignedCrewNames,
    isCrewReady,
  } = useOperario()
  const [activeFilter, setActiveFilter] = useState<OperarioJornadaFilter>("todas")
  const hasCrew =
    crewStatus === "resolved" || crewStatus === "multiple"

  const todayTasks = useMemo(
    () =>
      hasCrew ? getOperarioTodayTasks(tasks, workerCrewRef) : [],
    [hasCrew, tasks, workerCrewRef]
  )
  const summary = useMemo(
    () => summarizeOperarioTodayTasks(todayTasks),
    [todayTasks]
  )
  const filteredTasks = useMemo(
    () => filterOperarioTodayTasksByJornadaFilter(todayTasks, activeFilter),
    [todayTasks, activeFilter]
  )
  const filterChips = useMemo<JornadaFilterChip[]>(
    () => [
      { id: "todas", label: "Todas", value: summary.total },
      { id: "programadas", label: "Programadas", value: summary.programadas },
      { id: "en-curso", label: "En curso", value: summary.enCurso },
      {
        id: "pendientes-cierre",
        label: "Pend. de cierre",
        value: summary.pendientesCierre,
      },
      { id: "incidencias", label: "Incidencias", value: summary.incidencias },
    ],
    [summary]
  )

  return (
    <div className="space-y-5 px-4 pt-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isIdentityReady ? (
            <>Hola, {identity.displayName}</>
          ) : (
            <span className="inline-block h-8 w-48 animate-pulse rounded bg-muted" />
          )}
        </h1>
      </header>

      <OperarioCrewStatusMessage
        crewStatus={crewStatus}
        primaryCrewName={workerCrewRef.name}
        assignedCrewNames={assignedCrewNames}
      />

      {!isCrewReady || crewStatus === "loading" || crewStatus === "unassigned" ? (
        <OperarioCrewEmptyState crewStatus={crewStatus} />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Mi jornada
            </h2>
            <OperarioJornadaFilters
              chips={filterChips}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
          </section>

          <section className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                Mi jornada de hoy
              </h2>
              <p className="text-xs text-muted-foreground">
                Recorrido del día ordenado por prioridad de ejecución.
              </p>
            </div>

            {todayTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-12 text-center">
                <p className="text-sm font-medium text-foreground">
                  No tenés órdenes de trabajo programadas para hoy.
                </p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-12 text-center">
                <p className="text-sm font-medium text-foreground">
                  No hay órdenes de trabajo en esta categoría.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <OperarioTaskCard key={task.id} task={task} variant="jornada" />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
