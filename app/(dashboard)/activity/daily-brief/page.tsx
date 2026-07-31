import { Suspense } from "react"

import { ExecutiveDailyBriefModule } from "@/components/executive/executive-daily-brief-module"
import { Skeleton } from "@/components/ui/skeleton"

function DailyBriefFallback() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

export default function ExecutiveDailyBriefPage() {
  return (
    <Suspense fallback={<DailyBriefFallback />}>
      <ExecutiveDailyBriefModule />
    </Suspense>
  )
}
