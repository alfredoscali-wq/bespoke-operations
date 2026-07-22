import { Suspense } from "react"

import { ActivityViewerModule } from "@/components/activity/activity-viewer-module"
import { Skeleton } from "@/components/ui/skeleton"

function ActivityFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<ActivityFallback />}>
      <ActivityViewerModule />
    </Suspense>
  )
}
