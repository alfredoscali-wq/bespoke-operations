"use client"

import Link from "next/link"

import { useAuth } from "@/components/auth/auth-provider"
import { IncidentTypesConfigModule } from "@/components/configuracion/incident-types-config-module"
import { Button } from "@/components/ui/button"
import { canViewIncidentTypes } from "@/lib/incident-types/incident-type-permissions"

export function IncidentTypeAccessGuard({
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

  if (!canViewIncidentTypes(sessionUser?.systemRole)) {
    return (
      <div className="rounded-xl border bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">Acceso restringido</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Solo administradores y supervisores pueden configurar los tipos de
          incidencia.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/configuracion">Volver a Configuración</Link>
        </Button>
      </div>
    )
  }

  return <>{children}</>
}

export function IncidentTypesConfigPage() {
  return (
    <IncidentTypeAccessGuard>
      <IncidentTypesConfigModule />
    </IncidentTypeAccessGuard>
  )
}
