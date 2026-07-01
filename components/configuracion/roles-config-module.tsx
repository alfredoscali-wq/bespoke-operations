"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronRight, Plus } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { RoleCreateSheet } from "@/components/configuracion/role-create-sheet"
import { RoleEditSheet } from "@/components/configuracion/role-edit-sheet"
import { useCompanyRoles } from "@/components/configuracion/use-company-roles"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { canManageRoles } from "@/lib/roles/role-utils"
import type { CompanyRole } from "@/lib/types/company-roles"

export function RolesConfigModule() {
  const { roles, isLoading, isSaving, error, createRole, updateRoleModules } =
    useCompanyRoles()
  const [createOpen, setCreateOpen] = useState(false)
  const [editRole, setEditRole] = useState<CompanyRole | null>(null)

  async function handleCreate(input: {
    name: string
    copyFromRoleId: string
  }) {
    const result = await createRole(input)
    if (!result.success) {
      throw new Error(result.message)
    }
  }

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina qué módulos puede visualizar cada rol de su empresa.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Nuevo Rol
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border bg-muted/20 px-6 py-16 text-center text-sm text-muted-foreground">
          Cargando roles...
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <ul className="divide-y">
            {roles.map((role) => (
              <li key={role.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/30"
                  onClick={() => setEditRole(role)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{role.name}</p>
                      {role.isSystem ? (
                        <Badge variant="secondary">Sistema</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {role.code}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <RoleCreateSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles}
        isSubmitting={isSaving}
        onSubmit={handleCreate}
      />

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
  const canManage = canManageRoles(
    sessionUser?.roleCode,
    sessionUser?.systemRole
  )

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
          Solo administradores pueden gestionar roles.
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
