"use client"

import { useCallback, useEffect, useState } from "react"

import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  addWorkOrderTypeChecklistItem,
  fetchWorkOrderTypeChecklistItems,
  removeWorkOrderTypeChecklistItem,
  saveWorkOrderTypeChecklistItem,
  saveWorkOrderTypeChecklistOrder,
} from "@/lib/supabase/work-order-type-checklist.browser"
import type { WorkOrderTypeChecklistItem } from "@/lib/types/work-order-type-checklist"
import type { WorkOrderServiceType } from "@/lib/tasks/work-order"
import {
  buildChecklistReorderUpdates,
  reorderChecklistItemsById,
} from "@/lib/work-order-types/checklist-reorder"

export function useWorkOrderTypeChecklist(serviceType: WorkOrderServiceType | null) {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [items, setItems] = useState<WorkOrderTypeChecklistItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!serviceType || !companyId) {
      setItems([])
      return
    }

    setIsLoading(true)
    setError(null)

    const result = await fetchWorkOrderTypeChecklistItems(companyId, serviceType)

    if (result.error || !result.data) {
      setError(result.error?.message ?? "No se pudo cargar el checklist.")
      setItems([])
    } else {
      setItems(result.data)
    }

    setIsLoading(false)
  }, [companyId, serviceType])

  useEffect(() => {
    if (!isAuthReady) {
      return
    }

    void reload()
  }, [isAuthReady, reload])

  const addItem = useCallback(async () => {
    if (!serviceType || !companyId) {
      return
    }

    setIsSaving(true)
    setError(null)

    const result = await addWorkOrderTypeChecklistItem(companyId, serviceType, {
      title: "Nuevo ítem",
      required: false,
      requiresPhoto: false,
    })

    if (!result.success) {
      setError(result.message)
    } else {
      setItems((current) =>
        [...current, result.item].sort((left, right) => left.sortOrder - right.sortOrder)
      )
    }

    setIsSaving(false)
  }, [companyId, serviceType])

  const updateItem = useCallback(
    async (
      id: string,
      patch: Partial<Pick<WorkOrderTypeChecklistItem, "title" | "required" | "requiresPhoto">>
    ) => {
      setIsSaving(true)
      setError(null)

      const result = await saveWorkOrderTypeChecklistItem(id, patch)

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
    },
    []
  )

  const deleteItem = useCallback(async (id: string) => {
    setIsSaving(true)
    setError(null)

    const result = await removeWorkOrderTypeChecklistItem(id)

    if (!result.success) {
      setError(result.message)
    } else {
      setItems((current) => current.filter((item) => item.id !== id))
      await reload()
    }

    setIsSaving(false)
  }, [reload])

  const reorderItems = useCallback(
    async (draggedId: string, targetId: string) => {
      const nextItems = reorderChecklistItemsById(items, draggedId, targetId)
      const updates = buildChecklistReorderUpdates(items, nextItems.map((item) => item.id))

      if (updates.length === 0) {
        return
      }

      setItems(nextItems)
      setIsSaving(true)
      setError(null)

      const result = await saveWorkOrderTypeChecklistOrder(updates)

      if (!result.success) {
        setError(result.message)
        await reload()
      }

      setIsSaving(false)
    },
    [items, reload]
  )

  return {
    items,
    isLoading: isLoading || !isAuthReady,
    isSaving,
    error,
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
    reload,
  }
}
