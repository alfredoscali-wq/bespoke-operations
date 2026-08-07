"use client"

/**
 * Named ATC client hooks — Sprint 27.1 / 27.3.
 * Thin wrappers over AtencionClienteProvider with browser timing.
 * No UX or business-logic changes.
 */

import { useCallback, useEffect } from "react"
import { QueryClient } from "@tanstack/react-query"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  installAtcClientQueryInvalidationPatch,
  measureAtcClientSpan,
} from "@/lib/customer-service/performance/client-profiler"
import type { SharedInboxQuery } from "@/lib/customer-atenciones/shared-inbox"
import type { CustomerAtencion } from "@/lib/types/customer-atenciones"

/** Ensure RQ invalidation patch is installed once on the client. */
export function useAtcClientPerfBootstrap(): void {
  useEffect(() => {
    installAtcClientQueryInvalidationPatch(QueryClient)
  }, [])
}

/**
 * Shared inbox client surface + timed loadSharedInbox.
 * Sprint 27.3: depend on the stable provider callback, never the whole ctx object.
 */
export function useSharedInbox() {
  useAtcClientPerfBootstrap()
  const ctx = useAtencionCliente()
  const {
    loadSharedInbox: loadSharedInboxFromContext,
    refreshSharedInbox,
    sharedInboxQuery,
    sharedInboxRows,
    sharedInboxKpis,
    sharedInboxOperationalCounts,
    sharedInboxWorkTrayCounts,
    sharedInboxStatusFilterCounts,
    sharedInboxHistoricalDaySummary,
    isSharedInboxLoading,
    isSharedInboxDashboardLoading,
  } = ctx

  const loadSharedInbox = useCallback(
    async (
      query: SharedInboxQuery,
      options?: { mode?: "full" | "fast" }
    ) => {
      // loadSharedInbox already records Inbox Load in the provider;
      // this hook is the official client entry point for the same path.
      if (process.env.NODE_ENV === "development") {
        console.log(
          "[ATC ReleaseExpired]",
          "caller",
          "useSharedInbox.loadSharedInbox(wrapper)",
          typeof window !== "undefined" ? window.location.pathname : "(ssr)",
          Date.now(),
          options?.mode ?? "full"
        )
      }
      return loadSharedInboxFromContext(query, options)
    },
    [loadSharedInboxFromContext]
  )

  return {
    query: sharedInboxQuery,
    rows: sharedInboxRows,
    kpis: sharedInboxKpis,
    operationalCounts: sharedInboxOperationalCounts,
    workTrayCounts: sharedInboxWorkTrayCounts,
    statusFilterCounts: sharedInboxStatusFilterCounts,
    historicalDaySummary: sharedInboxHistoricalDaySummary,
    isLoading: isSharedInboxLoading,
    isDashboardLoading: isSharedInboxDashboardLoading,
    loadSharedInbox,
    refreshSharedInbox,
  }
}

/**
 * Seguimientos client surface + timed fetch.
 */
export function useCustomerSeguimientos() {
  useAtcClientPerfBootstrap()
  const ctx = useAtencionCliente()

  return {
    pendingSeguimientos: ctx.pendingSeguimientos,
    fetchSeguimientoById: ctx.fetchSeguimientoById,
    completeSeguimiento: ctx.completeSeguimiento,
    completeSeguimientoWithFollowUp: ctx.completeSeguimientoWithFollowUp,
  }
}

/**
 * Atención detail refresh — timed client entry for refreshAtencion.
 */
export function useCustomerAtencionDetail() {
  useAtcClientPerfBootstrap()
  const ctx = useAtencionCliente()
  const { refreshAtencionById, fetchAtencionById } = ctx

  const refreshAtencion = useCallback(
    async (id: string): Promise<CustomerAtencion | null> => {
      return measureAtcClientSpan(
        "detailLoad",
        () => refreshAtencionById(id),
        { reason: "refreshAtencion" }
      )
    },
    [refreshAtencionById]
  )

  return {
    refreshAtencion,
    refreshAtencionById: refreshAtencion,
    fetchAtencionById,
  }
}
