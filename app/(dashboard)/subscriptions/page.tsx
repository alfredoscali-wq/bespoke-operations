import { Suspense } from "react"

import { SubscriptionsModule } from "@/components/subscriptions/subscriptions-module"
import { KpiGridSkeleton } from "@/components/ui/kpi-grid-skeleton"

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<KpiGridSkeleton count={4} layout="standard" compact />}>
      <SubscriptionsModule />
    </Suspense>
  )
}
