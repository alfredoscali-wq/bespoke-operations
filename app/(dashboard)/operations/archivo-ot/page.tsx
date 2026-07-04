import { Suspense } from "react"

import { TasksModule } from "@/components/tareas/tasks-module"

function ArchivoOtPageFallback() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-full max-w-xl animate-pulse rounded-md bg-muted" />
      <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted/60" />
    </div>
  )
}

export default function ArchivoOtPage() {
  return (
    <Suspense fallback={<ArchivoOtPageFallback />}>
      <TasksModule mode="archive" />
    </Suspense>
  )
}
