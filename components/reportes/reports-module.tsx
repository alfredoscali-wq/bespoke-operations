"use client"

import { ReportsCrewProductivity } from "@/components/reportes/reports-crew-productivity"
import { ReportsCrewRanking } from "@/components/reportes/reports-crew-ranking"
import { ReportsFilters } from "@/components/reportes/reports-filters"
import { ReportsLocalities } from "@/components/reportes/reports-localities"
import { ReportsOldestPending } from "@/components/reportes/reports-oldest-pending"
import { ReportsProvider } from "@/components/reportes/reports-provider"
import { ReportsServiceTypes } from "@/components/reportes/reports-service-types"
import { ReportsSummaryCards } from "@/components/reportes/reports-summary-cards"

export function ReportsModule() {
  return (
    <ReportsProvider>
      <div className="space-y-8">
        <ReportsFilters />
        <ReportsSummaryCards />
        <ReportsCrewProductivity />
        <ReportsCrewRanking />
        <ReportsServiceTypes />
        <ReportsLocalities />
        <ReportsOldestPending />
      </div>
    </ReportsProvider>
  )
}
