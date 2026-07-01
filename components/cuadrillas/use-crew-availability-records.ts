"use client"

import { useEffect, useState } from "react"

import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listEmployeeAvailabilities } from "@/lib/supabase/employee-availability.browser"
import type { EmployeeAvailability } from "@/lib/types/availability"

export function useCrewAvailabilityRecords() {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [records, setRecords] = useState<EmployeeAvailability[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!isAuthReady || !companyId) {
      setRecords([])
      setIsReady(isAuthReady)
      return
    }

    let cancelled = false
    setIsReady(false)

    void listEmployeeAvailabilities(companyId).then((result) => {
      if (cancelled) return
      setRecords(result.data ?? [])
      setIsReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady])

  return { records, isReady }
}
