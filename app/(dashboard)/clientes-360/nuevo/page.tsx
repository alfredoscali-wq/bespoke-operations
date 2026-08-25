import { Suspense } from "react"

import { IspOnboardingWizard } from "@/components/isp/isp-onboarding-wizard"

export default function NuevoCliente360Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando alta...</p>}>
      <IspOnboardingWizard />
    </Suspense>
  )
}
