import { Suspense } from "react"

import { WorkforceMonitorModule } from "@/components/activity/workforce-monitor-module"
import { Skeleton } from "@/components/ui/skeleton"

function WorkforceMonitorFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  )
}

export default function WorkforceMonitorPage() {
  return (
    <Suspense fallback={<WorkforceMonitorFallback />}>
      <WorkforceMonitorModule />
    </Suspense>
  )
}
