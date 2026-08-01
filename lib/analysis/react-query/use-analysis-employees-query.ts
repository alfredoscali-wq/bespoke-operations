"use client"

import { useQuery } from "@tanstack/react-query"

import {
  listAnalysisEmployees,
  type AnalysisEmployee,
} from "@/lib/analysis/queries"
import {
  ANALYSIS_EMPLOYEES_GC_TIME_MS,
  ANALYSIS_EMPLOYEES_STALE_TIME_MS,
} from "@/lib/analysis/react-query/defaults"
import { analysisQueryKeys } from "@/lib/analysis/react-query/keys"

export type AnalysisEmployeesQueryResult = {
  employees: AnalysisEmployee[]
  errorMessage: string | null
}

async function fetchAnalysisEmployees(
  companyId: string
): Promise<AnalysisEmployeesQueryResult> {
  const result = await listAnalysisEmployees(companyId)
  if (result.error || !result.data) {
    return {
      employees: [],
      errorMessage: result.error?.message ?? "No se pudieron cargar empleados.",
    }
  }
  return { employees: result.data, errorMessage: null }
}

/**
 * Shared lean employees directory for Análisis screens (Sprint 16).
 * Explicit columns only — no SELECT *, no employee_types join.
 */
export function useAnalysisEmployeesQuery(
  companyId: string | null | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: analysisQueryKeys.employees(companyId ?? ""),
    queryFn: () => fetchAnalysisEmployees(companyId!),
    enabled: Boolean(enabled && companyId),
    staleTime: ANALYSIS_EMPLOYEES_STALE_TIME_MS,
    gcTime: ANALYSIS_EMPLOYEES_GC_TIME_MS,
  })
}
