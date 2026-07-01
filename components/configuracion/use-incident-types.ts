"use client"

import { useCallback, useEffect, useState } from "react"

import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  addIncidentType,
  fetchIncidentTypeUsageCount,
  fetchIncidentTypes,
  removeIncidentType,
  saveIncidentType,
} from "@/lib/supabase/incident-types.browser"
import type { IncidentType, IncidentTypeInput } from "@/lib/types/incident-types"

export function useIncidentTypes() {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [items, setItems] = useState<IncidentType[]>([])
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

    const result = await fetchIncidentTypes(companyId)

    if (result.error || !result.data) {
      setError(result.error?.message ?? "No se pudieron cargar los tipos de incidencia.")
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
    async (input: IncidentTypeInput) => {
      if (!companyId) {
        return { success: false as const, message: "Empresa no disponible." }
      }

      setIsSaving(true)
      setError(null)

      const result = await addIncidentType(
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
    async (id: string, input: Partial<IncidentTypeInput>) => {
      setIsSaving(true)
      setError(null)

      const result = await saveIncidentType(id, input)

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

  const deleteItem = useCallback(
    async (id: string) => {
      setIsSaving(true)
      setError(null)

      const result = await removeIncidentType(id)

      if (!result.success) {
        setError(result.message)
      } else {
        setItems((current) => current.filter((item) => item.id !== id))
      }

      setIsSaving(false)
      return result
    },
    []
  )

  const getUsageCount = useCallback(
    async (code: string) => {
      if (!companyId) {
        return { success: false as const, message: "Empresa no disponible." }
      }

      return fetchIncidentTypeUsageCount(companyId, code)
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
    deleteItem,
    getUsageCount,
  }
}
