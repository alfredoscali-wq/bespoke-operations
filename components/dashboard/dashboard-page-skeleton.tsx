"use client"

import { KpiGridSkeleton } from "@/components/ui/kpi-grid-skeleton"

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-8">
      <KpiGridSkeleton count={6} layout="triple" />
      <KpiGridSkeleton count={4} layout="standard" />
      <KpiGridSkeleton count={4} layout="standard" />
      <KpiGridSkeleton count={6} layout="wide" />
    </div>
  )
}
