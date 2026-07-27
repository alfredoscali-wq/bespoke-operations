import { Suspense } from "react"

import { CommercialHomeModule } from "@/components/gestion-comercial/home/commercial-home-module"
import { Skeleton } from "@/components/ui/skeleton"

export default function GestionComercialHomePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      }
    >
      <CommercialHomeModule />
    </Suspense>
  )
}
