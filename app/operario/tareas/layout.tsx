"use client"

import { TasksProvider } from "@/components/tareas/tasks-provider"

/**
 * Historial still uses the default TasksProvider (listTasks / fetchTasks)
 * until its dedicated 1000-row sprint. Nested so Hoy can keep its own
 * list scope without stripping finalizadas from this route.
 */
export default function OperarioTareasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <TasksProvider>{children}</TasksProvider>
}
