"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { RoleEditSheet } from "@/components/configuracion/role-edit-sheet"
import { useCompanyRoles } from "@/components/configuracion/use-company-roles"
import { Button } from "@/components/ui/button"
import { listFixedCompanyAreas } from "@/lib/roles/company-areas"
import { canManageCompanyAreasWeb } from "@/lib/roles/web-module-access"
import type { CompanyRole } from "@/lib/types/company-roles"

export function RolesConfigModule() {
  const { roles, isLoading, isSaving, error, updateRoleModules } =
    useCompanyRoles()
  const [editRole, setEditRole] = useState<CompanyRole | null>(null)

  const fixedAreas = useMemo(() => listFixedCompanyAreas(roles), [roles])

  async function handleSave(moduleVisibility: CompanyRole["moduleVisibility"]) {
    if (!editRole) {
      return
    }

    const result = await updateRoleModules(editRole, moduleVisibility)
    if (!result.success) {
      throw new Error(result.message)
    }
  }

  return (
    <div className="space-y-6" data-testid="company-areas-config">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Áreas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure qué pantallas puede utilizar cada Área de su empresa.
          </p>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border bg-muted/20 px-6 py-16 text-center text-sm text-muted-foreground">
          Cargando áreas...
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <ul className="divide-y">
            {fixedAreas.map((area) => (
              <li key={area.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/30"
                  data-testid={`company-area-item-${area.code}`}
                  onClick={() => setEditRole(area)}
                >
                  <div>
                    <p className="font-medium">{area.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {area.code}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <RoleEditSheet
        open={Boolean(editRole)}
        onOpenChange={(open) => {
          if (!open) {
            setEditRole(null)
          }
        }}
        role={editRole}
        isSubmitting={isSaving}
        onSubmit={handleSave}
      />
    </div>
  )
}

export function RoleAccessGuard({ children }: { children: React.ReactNode }) {
  const { sessionUser, isAuthReady } = useAuth()
  const canManage = canManageCompanyAreasWeb(sessionUser)

  if (!isAuthReady) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
        Verificando permisos...
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="rounded-xl border bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">Acceso restringido</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Solo administradores pueden gestionar áreas.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/configuracion">Volver a Configuración</Link>
        </Button>
      </div>
    )
  }

  return <>{children}</>
}

export function RolesConfigPage() {
  return (
    <RoleAccessGuard>
      <RolesConfigModule />
    </RoleAccessGuard>
  )
}
