import { Suspense } from "react"

import { SituationRoomModule } from "@/components/executive/situation-room-module"
import { Skeleton } from "@/components/ui/skeleton"

function SituationRoomFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<SituationRoomFallback />}>
      <SituationRoomModule />
    </Suspense>
  )
}
