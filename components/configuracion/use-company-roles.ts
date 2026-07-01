"use client"

import { useCallback, useEffect, useState } from "react"

import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  addCompanyRole,
  fetchCompanyRoles,
  saveCompanyRoleModules,
} from "@/lib/supabase/company-roles.browser"
import type { ModuleVisibilityMap } from "@/lib/roles/app-modules"
import type { CompanyRole } from "@/lib/types/company-roles"

export function useCompanyRoles() {
  const { companyId, isAuthReady } = useTenantCompanyId()
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
      } else {
        setRoles((current) =>
          current
            .map((item) => (item.id === role.id ? result.role : item))
            .sort((left, right) => left.sortOrder - right.sortOrder)
        )
      }

      setIsSaving(false)
      return result
    },
    []
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
