import { Suspense } from "react"

import { TasksModule } from "@/components/tareas/tasks-module"

function TasksPageFallback() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <div className="h-8 w-44 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-36 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted/60" />
    </div>
  )
}

export default function TareasPage() {
  return (
    <Suspense fallback={<TasksPageFallback />}>
      <TasksModule />
    </Suspense>
  )
}
