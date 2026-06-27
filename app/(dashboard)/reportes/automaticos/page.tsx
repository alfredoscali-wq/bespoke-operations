import { Suspense } from "react"

import { AutomaticReportsModule } from "@/components/reportes/automatic/automatic-reports-module"

export default function ReportesAutomaticosPage() {
  return (
    <Suspense fallback={null}>
      <AutomaticReportsModule />
    </Suspense>
  )
}
