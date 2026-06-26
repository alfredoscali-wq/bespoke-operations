"use client"

import { useMemo } from "react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { OperarioTaskCard } from "@/components/operario/operario-task-card"
import {
  OperarioCrewEmptyState,
  OperarioCrewStatusMessage,
} from "@/components/operario/operario-crew-status-message"
import { useOperario } from "@/components/operario/operario-provider"
import { groupOperarioHistoryTasks } from "@/lib/data/operario"
import type { Task } from "@/lib/types/tasks"

function TaskSection({
  title,
  tasks,
}: {
  title: string
  tasks: Task[]
}) {
  if (tasks.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="px-1 text-sm font-semibold text-foreground">{title}</h2>
      <div className="space-y-3">
        {tasks.map((task) => (
          <OperarioTaskCard key={task.id} task={task} />
        ))}
      </div>
    </section>
  )
}

export function OperarioTasksScreen() {
  const { tasks } = useTasks()
  const {
    workerCrewRef,
    crewStatus,
    assignedCrewNames,
    isCrewReady,
  } = useOperario()
  const hasCrew =
    crewStatus === "resolved" || crewStatus === "multiple"

  const grouped = useMemo(
    () =>
      hasCrew
        ? groupOperarioHistoryTasks(tasks, workerCrewRef)
        : {
            finalizadas: [],
            pendientesCierre: [],
            incidencias: [],
            canceladas: [],
            all: [],
          },
    [hasCrew, tasks, workerCrewRef]
  )

  return (
    <div className="space-y-6 px-4 pt-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Historial de Órdenes de Trabajo
        </h1>
        {isCrewReady && hasCrew ? (
          <p className="text-sm text-muted-foreground">
            Cuadrilla {workerCrewRef.name} · {grouped.all.length}{" "}
            {grouped.all.length === 1
              ? "registro en historial"
              : "registros en historial"}
          </p>
        ) : isCrewReady ? (
          <p className="text-sm text-muted-foreground">Sin cuadrilla asignada</p>
        ) : (
          <span className="inline-block h-4 w-48 animate-pulse rounded bg-muted" />
        )}
      </header>

      <OperarioCrewStatusMessage
        crewStatus={crewStatus}
        primaryCrewName={workerCrewRef.name}
        assignedCrewNames={assignedCrewNames}
      />

      {!isCrewReady || crewStatus === "loading" || crewStatus === "unassigned" ? (
        <OperarioCrewEmptyState crewStatus={crewStatus} />
      ) : grouped.all.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            No hay registros en tu historial operativo.
          </p>
        </div>
      ) : (
        <>
          <TaskSection title="Finalizadas" tasks={grouped.finalizadas} />
          <TaskSection
            title="Pendientes de cierre"
            tasks={grouped.pendientesCierre}
          />
          <TaskSection title="Incidencias" tasks={grouped.incidencias} />
          <TaskSection title="Canceladas" tasks={grouped.canceladas} />
        </>
      )}
    </div>
  )
}
