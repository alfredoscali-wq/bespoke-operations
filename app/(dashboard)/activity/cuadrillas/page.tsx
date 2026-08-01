import { Suspense } from "react"

import { CrewsModule } from "@/components/activity/crews-module"
import { Skeleton } from "@/components/ui/skeleton"

function CuadrillasFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  )
}

export default function CuadrillasPage() {
  return (
    <Suspense fallback={<CuadrillasFallback />}>
      <CrewsModule />
    </Suspense>
  )
}
