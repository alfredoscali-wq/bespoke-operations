"use client"

import { useCallback, useEffect, useState } from "react"

import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  addEmployeeType,
  fetchEmployeeTypes,
  fetchEmployeeTypeUsageCount,
  saveEmployeeType,
} from "@/lib/supabase/employee-types.browser"
import type {
  EmployeeTypeCatalog,
  EmployeeTypeCatalogInput,
} from "@/lib/types/employee-types"

export function useEmployeeTypes() {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [items, setItems] = useState<EmployeeTypeCatalog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!companyId) {
      setItems([])
      return
    }

    setIsLoading(true)
    setError(null)

    const result = await fetchEmployeeTypes(companyId)

    if (result.error || !result.data) {
      setError(result.error?.message ?? "No se pudieron cargar los tipos de empleado.")
      setItems([])
    } else {
      setItems(result.data)
    }

    setIsLoading(false)
  }, [companyId])

  useEffect(() => {
    if (!isAuthReady) {
      return
    }

    void reload()
  }, [isAuthReady, reload])

  const createItem = useCallback(
    async (input: EmployeeTypeCatalogInput) => {
      if (!companyId) {
        return { success: false as const, message: "Empresa no disponible." }
      }

      setIsSaving(true)
      setError(null)

      const result = await addEmployeeType(
        companyId,
        input,
        items.map((item) => item.code)
      )

      if (!result.success) {
        setError(result.message)
      } else {
        setItems((current) =>
          [...current, result.item].sort(
            (left, right) => left.sortOrder - right.sortOrder
          )
        )
      }

      setIsSaving(false)
      return result
    },
    [companyId, items]
  )

  const updateItem = useCallback(
    async (id: string, input: Partial<EmployeeTypeCatalogInput>) => {
      setIsSaving(true)
      setError(null)

      const result = await saveEmployeeType(id, input)

      if (!result.success) {
        setError(result.message)
      } else {
        setItems((current) =>
          current
            .map((item) => (item.id === id ? result.item : item))
            .sort((left, right) => left.sortOrder - right.sortOrder)
        )
      }

      setIsSaving(false)
      return result
    },
    []
  )

  const getUsageCount = useCallback(
    async (employeeTypeId: string) => {
      if (!companyId) {
        return { success: false as const, message: "Empresa no disponible." }
      }

      return fetchEmployeeTypeUsageCount(companyId, employeeTypeId)
    },
    [companyId]
  )

  return {
    items,
    isLoading,
    isSaving,
    error,
    reload,
    createItem,
    updateItem,
    getUsageCount,
  }
}
