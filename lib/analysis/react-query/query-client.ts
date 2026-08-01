"use client"

import { QueryClient } from "@tanstack/react-query"

import { ANALYSIS_QUERY_DEFAULTS } from "@/lib/analysis/react-query/defaults"

export function createAnalysisQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { ...ANALYSIS_QUERY_DEFAULTS },
    },
  })
}
