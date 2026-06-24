"use client"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { OperarioTaskCard } from "@/components/operario/operario-task-card"
import { useOperario } from "@/components/operario/operario-provider"
import { groupWorkerTasks, resolveWorkerCrewRef } from "@/lib/data/operario"
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
  const { crewName } = useOperario()
  const { crews } = useCrews()
  const workerCrew = resolveWorkerCrewRef(crewName, crews)
  const grouped = groupWorkerTasks(tasks, workerCrew)

  return (
    <div className="space-y-6 px-4 pt-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Tareas
        </h1>
        <p className="text-sm text-muted-foreground">
          {grouped.all.length} tareas asignadas
        </p>
      </header>

      {grouped.all.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-12 text-center text-sm text-muted-foreground">
          No tienes tareas asignadas
        </div>
      ) : (
        <>
          <TaskSection title="Pendientes" tasks={grouped.pendientes} />
          <TaskSection title="En Curso" tasks={grouped.enCurso} />
          <TaskSection title="Finalizadas" tasks={grouped.finalizadas} />
        </>
      )}
    </div>
  )
}
