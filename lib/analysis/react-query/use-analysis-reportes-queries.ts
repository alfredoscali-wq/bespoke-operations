"use client"

import { useQuery } from "@tanstack/react-query"

import {
  listAnalysisReportesCrews,
  listAnalysisReportesProjects,
  listAnalysisReportesTasks,
} from "@/lib/analysis/queries"
import {
  ANALYSIS_QUERY_DEFAULTS,
  ANALYSIS_REPORTES_STALE_TIME_MS,
} from "@/lib/analysis/react-query/defaults"
import { analysisQueryKeys } from "@/lib/analysis/react-query/keys"

const reportesQueryOptions = {
  staleTime: ANALYSIS_REPORTES_STALE_TIME_MS,
  gcTime: ANALYSIS_QUERY_DEFAULTS.gcTime,
  refetchOnWindowFocus: ANALYSIS_QUERY_DEFAULTS.refetchOnWindowFocus,
  refetchOnReconnect: ANALYSIS_QUERY_DEFAULTS.refetchOnReconnect,
  refetchOnMount: ANALYSIS_QUERY_DEFAULTS.refetchOnMount,
} as const

/**
 * Reportes Operativos — lean tasks (no SELECT *).
 */
export function useAnalysisReportesTasksQuery(
  companyId: string | null | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: analysisQueryKeys.reportesTasks(companyId ?? ""),
    queryFn: async () => {
      const result = await listAnalysisReportesTasks(companyId!)
      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "No se pudieron cargar tareas.")
      }
      return result.data
    },
    enabled: Boolean(enabled && companyId),
    ...reportesQueryOptions,
  })
}

export function useAnalysisReportesProjectsQuery(
  companyId: string | null | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: analysisQueryKeys.reportesProjects(companyId ?? ""),
    queryFn: async () => {
      const result = await listAnalysisReportesProjects(companyId!)
      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "No se pudieron cargar obras.")
      }
      return result.data
    },
    enabled: Boolean(enabled && companyId),
    ...reportesQueryOptions,
  })
}

export function useAnalysisReportesCrewsQuery(
  companyId: string | null | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: analysisQueryKeys.reportesCrews(companyId ?? ""),
    queryFn: async () => {
      const result = await listAnalysisReportesCrews(companyId!)
      if (result.error || !result.data) {
        throw new Error(
          result.error?.message ?? "No se pudieron cargar cuadrillas."
        )
      }
      return result.data
    },
    enabled: Boolean(enabled && companyId),
    ...reportesQueryOptions,
  })
}
