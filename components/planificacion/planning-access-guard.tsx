"use client"

import Link from "next/link"
import { useOperationalProfile } from "@/components/operations/operational-profile-provider"
import { profileCanAccessPlanificacion } from "@/lib/operations/operational-profile"
import { Button } from "@/components/ui/button"

export function PlanningAccessGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = useOperationalProfile()

  if (profileCanAccessPlanificacion(profile)) {
    return children
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-xl border bg-muted/20 px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-foreground">
        Acceso restringido
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Planificación Operativa está disponible únicamente para Supervisores y
        Administradores.
      </p>
      <Button asChild variant="outline">
        <Link href="/operations/calendar">Volver al Calendario Operativo</Link>
      </Button>
    </div>
  )
}
