import { Suspense } from "react"

import { ExecutiveCenterModule } from "@/components/activity/executive-center-module"
import { Skeleton } from "@/components/ui/skeleton"

function ExecutiveCenterFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

export default function ExecutiveCenterPage() {
  return (
    <Suspense fallback={<ExecutiveCenterFallback />}>
      <ExecutiveCenterModule />
    </Suspense>
  )
}
