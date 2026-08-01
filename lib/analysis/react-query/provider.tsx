"use client"

import { useState, type ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"

import { createAnalysisQueryClient } from "@/lib/analysis/react-query/query-client"

/**
 * Provides the Análisis React Query client (Sprint 15).
 * Safe to nest at dashboard shell — unused elsewhere until hooks run.
 */
export function AnalysisQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createAnalysisQueryClient())
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
