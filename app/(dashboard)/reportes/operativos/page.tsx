import { Suspense } from "react"

import { ReportsModule } from "@/components/reportes/reports-module"
import { Skeleton } from "@/components/ui/skeleton"

function ReportesFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  )
}

export default function ReportesOperativosPage() {
  return (
    <Suspense fallback={<ReportesFallback />}>
      <ReportsModule />
    </Suspense>
  )
}
