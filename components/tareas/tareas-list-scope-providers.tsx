"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, type ReactNode } from "react"

import { TasksModuleProviders } from "@/components/providers/tasks-module-providers"
import { toDateOnly } from "@/lib/availability/utils"
import {
  isDashboardKpiSource,
  resolveDashboardKpiDrilldownSpec,
} from "@/lib/tasks/dashboard-kpi-drilldown"

function TareasListScopeProviders({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const isDashboardKpi = isDashboardKpiSource(searchParams.get("source"))
  const dashboardKpiSpec = isDashboardKpi
    ? resolveDashboardKpiDrilldownSpec({
        kpi: searchParams.get("kpi"),
        status: searchParams.get("status"),
        scope: searchParams.get("scope"),
        today: toDateOnly(),
      })
    : null

  return (
    <TasksModuleProviders
      listScope={isDashboardKpi ? "dashboardKpiWorkOrders" : "activeWorkOrders"}
      dashboardKpiSpec={dashboardKpiSpec}
    >
      {children}
    </TasksModuleProviders>
  )
}

export function TareasListScopeProvidersBoundary({
  children,
}: {
  children: ReactNode
}) {
  return (
    <Suspense
      fallback={
        <TasksModuleProviders listScope="activeWorkOrders">
          {children}
        </TasksModuleProviders>
      }
    >
      <TareasListScopeProviders>{children}</TareasListScopeProviders>
    </Suspense>
  )
}
