"use client"

import Link from "next/link"

import { useAuth } from "@/components/auth/auth-provider"
import { WorkOrderTypesConfigModule } from "@/components/configuracion/work-order-types-config-module"
import { Button } from "@/components/ui/button"
import { canAccessSettingsConfigWebModule } from "@/lib/roles/web-module-access"

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

  if (!canAccessSettingsConfigWebModule(sessionUser)) {
    return (
      <div className="rounded-xl border bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">Acceso restringido</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Configuración no está habilitada para su Área.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/configuracion">Volver a Configuración</Link>
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
