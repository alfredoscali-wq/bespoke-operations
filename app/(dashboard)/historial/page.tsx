import { Suspense } from "react"

import { HistorialModule } from "@/components/historial/historial-module"
import { Skeleton } from "@/components/ui/skeleton"

function HistorialFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

export default function HistorialPage() {
  return (
    <Suspense fallback={<HistorialFallback />}>
      <HistorialModule />
    </Suspense>
  )
}
