import { Suspense } from "react"

import { ActivityTimelineModule } from "@/components/activity/activity-timeline-module"
import { Skeleton } from "@/components/ui/skeleton"

function ActivityTimelineFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid min-h-[520px] gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Skeleton className="h-[520px] w-full rounded-xl" />
        <Skeleton className="h-[520px] w-full rounded-xl" />
      </div>
    </div>
  )
}

export default function ActivityTimelinePage() {
  return (
    <Suspense fallback={<ActivityTimelineFallback />}>
      <ActivityTimelineModule />
    </Suspense>
  )
}
