"use client"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { OperarioTaskCard } from "@/components/operario/operario-task-card"
import { useOperario } from "@/components/operario/operario-provider"
import { getTodayWorkerTasks, resolveWorkerCrewRef } from "@/lib/data/operario"

export function OperarioHomeScreen() {
  const { tasks } = useTasks()
  const { identity, isIdentityReady, crewName } = useOperario()
  const { crews } = useCrews()
  const workerCrew = resolveWorkerCrewRef(crewName, crews)
  const todayTasks = getTodayWorkerTasks(tasks, workerCrew)

  return (
    <div className="space-y-5 px-4 pt-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isIdentityReady ? (
            <>Hola {identity.displayName}</>
          ) : (
            <span className="inline-block h-8 w-48 animate-pulse rounded bg-muted" />
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          Tienes {todayTasks.length}{" "}
          {todayTasks.length === 1 ? "tarea asignada" : "tareas asignadas"} para
          hoy
        </p>
      </header>

      {todayTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            Sin tareas para hoy
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Revisa la pestaña Tareas para ver tu historial.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {todayTasks.map((task) => (
            <OperarioTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
