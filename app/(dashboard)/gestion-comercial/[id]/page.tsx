import { Suspense } from "react"

import { CommercialDossierModule } from "@/components/gestion-comercial/commercial-dossier-module"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"

type GestionComercialDossierPageProps = {
  params: Promise<{ id: string }>
}

export default async function GestionComercialDossierPage({
  params,
}: GestionComercialDossierPageProps) {
  const { id } = await params

  return (
    <Suspense fallback={<TableRowsSkeleton rows={4} columns={3} />}>
      <CommercialDossierModule opportunityId={id} />
    </Suspense>
  )
}
