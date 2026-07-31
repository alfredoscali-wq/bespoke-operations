import { Suspense } from "react"

import { DayActivityModule } from "@/components/activity/day-activity-module"
import { Skeleton } from "@/components/ui/skeleton"

function DayActivityFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

export default function DayActivityPage() {
  return (
    <Suspense fallback={<DayActivityFallback />}>
      <DayActivityModule />
    </Suspense>
  )
}
