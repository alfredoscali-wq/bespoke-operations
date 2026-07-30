import { redirect } from "next/navigation"
import { Suspense } from "react"

import { CommercialPipelineModule } from "@/components/gestion-comercial/pipeline/commercial-pipeline-module"
import { Skeleton } from "@/components/ui/skeleton"
import { COMMERCIAL_PIPELINE_UI_ENABLED } from "@/lib/commercial/mvp-ui"

export default function GestionComercialPipelinePage() {
  // MVP: hide Pipeline UI without deleting the module or API.
  if (!COMMERCIAL_PIPELINE_UI_ENABLED) {
    redirect("/gestion-comercial/oportunidades")
  }

  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[420px] w-[280px] shrink-0" />
            ))}
          </div>
        </div>
      }
    >
      <CommercialPipelineModule />
    </Suspense>
  )
}
