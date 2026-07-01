"use client"

import Link from "next/link"

import { useAuth } from "@/components/auth/auth-provider"
import { WorkOrderTypesConfigModule } from "@/components/configuracion/work-order-types-config-module"
import { Button } from "@/components/ui/button"
import { canViewWorkOrderTypeChecklist } from "@/lib/work-order-types/checklist-permissions"

export function WorkOrderTypeChecklistAccessGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const { sessionUser, isAuthReady } = useAuth()

  if (!isAuthReady) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
        Verificando permisos...
      </div>
    )
  }

  if (!canViewWorkOrderTypeChecklist(sessionUser?.systemRole)) {
    return (
      <div className="rounded-xl border bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">Acceso restringido</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Solo administradores y supervisores pueden configurar el checklist operativo.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    )
  }

  return <>{children}</>
}

export function WorkOrderTypesConfigPage() {
  return (
    <WorkOrderTypeChecklistAccessGuard>
      <WorkOrderTypesConfigModule />
    </WorkOrderTypeChecklistAccessGuard>
  )
}
