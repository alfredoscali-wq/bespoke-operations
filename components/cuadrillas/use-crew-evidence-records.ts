"use client"

import { useEffect, useState } from "react"

import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listEvidences } from "@/lib/supabase/evidences.browser"
import type { EvidenceRecord } from "@/lib/types/evidence"

export function useCrewEvidenceRecords() {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!isAuthReady || !companyId) {
      setEvidence([])
      setIsReady(isAuthReady)
      return
    }

    let cancelled = false
    setIsReady(false)

    void listEvidences(companyId).then((result) => {
      if (cancelled) return
      setEvidence(result.data ?? [])
      setIsReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady])

  return { evidence, isReady }
}
