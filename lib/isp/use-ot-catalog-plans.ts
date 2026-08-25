"use client"

import { useEffect, useState } from "react"

import type { IspOtPlanOption } from "@/lib/isp/catalog-types"
import {
  getPlanOptionsForTechnology,
  type WorkOrderTechnology,
} from "@/lib/tasks/commercial-plan"

export function legacyOtPlanOptions(
  technology: WorkOrderTechnology | ""
): IspOtPlanOption[] {
  if (technology !== "fiber" && technology !== "wireless") return []

  return getPlanOptionsForTechnology(technology).map((option) => ({
    catalogId: "",
    label: option.label,
    contractedPlanCode: option.value,
    technology,
    downloadSpeedMbps: null,
    monthlyPrice: null,
    allowedConnectionTypes: [],
    requiresConnection: true,
    isActive: true,
  }))
}

export function useOtCatalogPlans(
  technology: WorkOrderTechnology | "",
  includeId?: string | null
): {
  plans: IspOtPlanOption[]
  loading: boolean
  source: "catalog" | "fallback" | "empty"
} {
  const [plans, setPlans] = useState<IspOtPlanOption[]>([])
  const [loading, setLoading] = useState(Boolean(technology))
  const [source, setSource] = useState<"catalog" | "fallback" | "empty">(
    "empty"
  )

  useEffect(() => {
    if (technology !== "fiber" && technology !== "wireless") {
      setPlans([])
      setLoading(false)
      setSource("empty")
      return
    }

    const controller = new AbortController()
    const params = new URLSearchParams({ technology })
    if (includeId) params.set("includeId", includeId)

    setLoading(true)
    fetch(`/api/isp/catalog/ot-plans?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          success?: boolean
          plans?: IspOtPlanOption[]
        }
        if (body.success && Array.isArray(body.plans)) {
          setPlans(body.plans)
          setSource(body.plans.length > 0 ? "catalog" : "empty")
          return
        }
        setPlans(legacyOtPlanOptions(technology))
        setSource("fallback")
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return
        setPlans(legacyOtPlanOptions(technology))
        setSource("fallback")
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [includeId, technology])

  return { plans, loading, source }
}
