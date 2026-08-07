/**
 * Customer Service performance profiler — Sprint 27 / ATC Perf 1.0.
 */

export { isCustomerServicePerfEnabled, setCustomerServicePerfEnabledForTests } from "@/lib/customer-service/performance/enabled"

export type {
  CustomerServiceInboxLoadMetrics,
  CustomerServiceLookupMetric,
  CustomerServiceSeguimientoQueryMetric,
  CustomerServiceSourceQueryMetric,
} from "@/lib/customer-service/performance/types"

export type { CustomerServiceInboxSession } from "@/lib/customer-service/performance/session"

export {
  beginCustomerServiceInboxProfile,
  finishCustomerServiceInboxProfile,
  getActiveCustomerServiceInboxSession,
  getLastCustomerServiceInboxMetrics,
  logCustomerServiceNetworkSummary,
  measureCustomerServiceSourceQuery,
  recordCustomerServiceCustomerLookup,
  recordCustomerServiceRowsLoaded,
  recordCustomerServiceSeguimientoQuery,
  recordCustomerServiceSourceQuery,
  resetCustomerServicePerfForTests,
  withCustomerServiceSeguimientoTiming,
} from "@/lib/customer-service/performance/profiler"

export {
  getAtcClientPerfSnapshot,
  installAtcClientQueryInvalidationPatch,
  logAtcClientSummary,
  measureAtcClientSpan,
  measureAtcClientSpanSync,
  resetAtcClientPerfForTests,
  trackAtcQueryInvalidation,
} from "@/lib/customer-service/performance/client-profiler"

export {
  useAtcClientPerfBootstrap,
  useCustomerAtencionDetail,
  useCustomerSeguimientos,
  useSharedInbox,
} from "@/lib/customer-service/performance/client-hooks"

export type { AtcBreakdownAction, AtcBreakdownSnapshot } from "@/lib/customer-service/performance/breakdown"

export {
  beginAtcBreakdown,
  finalizeAtcBreakdown,
  getActiveAtcBreakdownAction,
  getLastAtcBreakdownSnapshot,
  measureAtcBreakdownPhase,
  recordAtcBreakdownPhase,
  resetAtcBreakdownForTests,
} from "@/lib/customer-service/performance/breakdown"

// Sprint 31.0.1 — do NOT re-export release-expired-breakdown from this barrel.
// It is server-only (node:async_hooks) and must be imported only from API/server files.
