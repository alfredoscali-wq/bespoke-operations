"use client"

import Link from "next/link"

import { useAuth } from "@/components/auth/auth-provider"
import { useOperationalProfile } from "@/components/operations/operational-profile-provider"
import { canAccessPlanningWebModule } from "@/lib/roles/web-module-access"
import { Button } from "@/components/ui/button"

export function PlanningAccessGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const { sessionUser } = useAuth()
  const { homePath } = useOperationalProfile()

  if (canAccessPlanningWebModule(sessionUser)) {
    return children
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-xl border bg-muted/20 px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-foreground">
        Acceso restringido
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Planificación Operativa no está habilitada para su Área.
      </p>
      <Button asChild variant="outline">
        <Link href={homePath}>Volver al inicio</Link>
      </Button>
    </div>
  )
}
