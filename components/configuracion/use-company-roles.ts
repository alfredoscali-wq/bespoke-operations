"use client"

import { useCallback, useEffect, useState } from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { syncRoleMetadataClient } from "@/lib/auth/sync-employee-metadata.client"
import {
  addCompanyRole,
  fetchCompanyRoles,
  saveCompanyRoleModules,
} from "@/lib/supabase/company-roles.browser"
import type { ModuleVisibilityMap } from "@/lib/roles/app-modules"
import type { CompanyRole } from "@/lib/types/company-roles"

export function useCompanyRoles() {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const { sessionUser, refreshSession } = useAuth()
  const [roles, setRoles] = useState<CompanyRole[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!companyId) {
      setRoles([])
      return
    }

    setIsLoading(true)
    setError(null)

    const result = await fetchCompanyRoles(companyId)

    if (result.error || !result.data) {
      setError(result.error?.message ?? "No se pudieron cargar los roles.")
      setRoles([])
    } else {
      setRoles(result.data)
    }

    setIsLoading(false)
  }, [companyId])

  useEffect(() => {
    if (!isAuthReady) {
      return
    }

    void reload()
  }, [isAuthReady, reload])

  const createRole = useCallback(
    async (input: { name: string; copyFromRoleId: string }) => {
      if (!companyId) {
        return { success: false as const, message: "Empresa no disponible." }
      }

      setIsSaving(true)
      setError(null)

      const result = await addCompanyRole(
        companyId,
        input,
        roles.map((role) => role.code)
      )

      if (!result.success) {
        setError(result.message)
      } else {
        setRoles((current) =>
          [...current, result.role].sort(
            (left, right) => left.sortOrder - right.sortOrder
          )
        )
      }

      setIsSaving(false)
      return result
    },
    [companyId, roles]
  )

  const updateRoleModules = useCallback(
    async (role: CompanyRole, moduleVisibility: ModuleVisibilityMap) => {
      setIsSaving(true)
      setError(null)

      const result = await saveCompanyRoleModules(role, moduleVisibility)

      if (!result.success) {
        setError(result.message)
        setIsSaving(false)
        return result
      }

      const syncResult = await syncRoleMetadataClient(role.id)

      if (!syncResult.success) {
        const message = `La configuración se guardó, pero no se pudo sincronizar el acceso de los usuarios afectados: ${syncResult.message}`
        setError(message)
        setIsSaving(false)
        return { success: false as const, message }
      }

      if (sessionUser?.roleId === role.id) {
        await refreshSession()
      }

      setRoles((current) =>
        current
          .map((item) => (item.id === role.id ? result.role : item))
          .sort((left, right) => left.sortOrder - right.sortOrder)
      )

      setIsSaving(false)
      return result
    },
    [refreshSession, sessionUser?.roleId]
  )

  return {
    roles,
    isLoading: isLoading || !isAuthReady,
    isSaving,
    error,
    reload,
    createRole,
    updateRoleModules,
  }
}
