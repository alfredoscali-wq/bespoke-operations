"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { ActivityTimelineFeed } from "@/components/activity/activity-timeline-feed"
import {
  ActivityTimelineFiltersPanel,
  EMPTY_ACTIVITY_TIMELINE_DRAFT,
  type ActivityTimelineDraftFilters,
} from "@/components/activity/activity-timeline-filters-panel"
import { ActivityTimelineStatsHeader } from "@/components/activity/activity-timeline-stats-header"
import {
  toTimelineDateFromInput,
  toTimelineDateToInput,
} from "@/lib/activity/activity-timeline-groups"
import {
  ACTIVITY_TIMELINE_PAGE_SIZE,
  type ActivityTimelineEvent,
  type ActivityTimelineFilters,
  type ActivityTimelineScope,
  type ActivityTimelineStats,
  type ActivityTimelineVisibleFilters,
} from "@/lib/activity/activity-timeline-types"
import {
  fetchActivityTimeline,
  scopeToTimelineFilters,
} from "@/lib/activity/fetch-activity-timeline.client"
import { isDemoTenantCompanyId } from "@/lib/operations/tenant-scope"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  BESPOKE_DEMO_COMPANY_NAME,
  BESPOKE_PRODUCTION_COMPANY_NAME,
} from "@/lib/supabase/company.constants"
import { listEmployees } from "@/lib/supabase/employees.browser"
import type { Employee } from "@/lib/types/employees"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 300

const EMPTY_STATS: ActivityTimelineStats = {
  total: 0,
  firstEventAt: null,
  lastEventAt: null,
}

function companyDisplayLabel(companyId: string): string {
  if (isDemoTenantCompanyId(companyId)) {
    return `${BESPOKE_DEMO_COMPANY_NAME} (${companyId})`
  }
  return `${BESPOKE_PRODUCTION_COMPANY_NAME} (${companyId})`
}

function draftToQueryFilters(
  draft: ActivityTimelineDraftFilters,
  scope: ActivityTimelineScope,
  offset: number,
  includeStats: boolean,
  order: "ASC" | "DESC"
): ActivityTimelineFilters & { includeStats?: boolean } {
  const scoped = scopeToTimelineFilters(scope)
  return {
    ...scoped,
    // User-selected filters only override when the filter is not locked by scope.
    employeeId:
      scope.kind === "employee"
        ? scope.employeeId
        : draft.employeeId || scoped.employeeId,
    module:
      scope.kind === "entity" && scope.module
        ? scope.module
        : draft.module || scoped.module,
    entityType:
      scope.kind === "entity"
        ? scope.entityType
        : draft.entityType || scoped.entityType,
    entityId: scoped.entityId,
    action: draft.action || undefined,
    dateFrom: toTimelineDateFromInput(draft.dateFrom),
    dateTo: toTimelineDateToInput(draft.dateTo),
    search: draft.search.trim() || undefined,
    limit: ACTIVITY_TIMELINE_PAGE_SIZE,
    offset,
    order,
    includeStats,
  }
}

export type EntityActivityTimelineProps = {
  scope: ActivityTimelineScope
  visibleFilters: ActivityTimelineVisibleFilters
  layout?: "global" | "embedded"
  showStats?: boolean
  className?: string
  feedClassName?: string
  enabled?: boolean
  order?: "ASC" | "DESC"
  groupByDay?: boolean
  showInterEventGaps?: boolean
  /** YYYY-MM-DD — locks the day range and seeds date filters. */
  lockedDate?: string
  onItemsChange?: (
    items: ActivityTimelineEvent[],
    stats: ActivityTimelineStats
  ) => void
}

function draftWithLockedDate(
  draft: ActivityTimelineDraftFilters,
  lockedDate?: string
): ActivityTimelineDraftFilters {
  if (!lockedDate) return draft
  return {
    ...draft,
    dateFrom: lockedDate,
    dateTo: lockedDate,
  }
}

export function EntityActivityTimeline({
  scope,
  visibleFilters,
  layout = "embedded",
  showStats = true,
  className,
  feedClassName,
  enabled = true,
  order = "DESC",
  groupByDay = true,
  showInterEventGaps = false,
  lockedDate,
  onItemsChange,
}: EntityActivityTimelineProps) {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const needsEmployees = Boolean(visibleFilters.employee)

  const initialDraft = draftWithLockedDate(
    EMPTY_ACTIVITY_TIMELINE_DRAFT,
    lockedDate
  )

  const [draft, setDraft] = useState<ActivityTimelineDraftFilters>(initialDraft)
  const [applied, setApplied] =
    useState<ActivityTimelineDraftFilters>(initialDraft)
  const [items, setItems] = useState<ActivityTimelineEvent[]>([])
  const [stats, setStats] = useState<ActivityTimelineStats>(EMPTY_STATS)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(enabled)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])

  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const appliedRef = useRef(applied)
  const itemsLengthRef = useRef(0)
  const hasMoreRef = useRef(false)
  const loadingMoreRef = useRef(false)
  const scopeRef = useRef(scope)
  const orderRef = useRef(order)
  const onItemsChangeRef = useRef(onItemsChange)

  useEffect(() => {
    appliedRef.current = applied
  }, [applied])

  useEffect(() => {
    itemsLengthRef.current = items.length
  }, [items.length])

  useEffect(() => {
    hasMoreRef.current = hasMore
  }, [hasMore])

  useEffect(() => {
    loadingMoreRef.current = isLoadingMore
  }, [isLoadingMore])

  useEffect(() => {
    scopeRef.current = scope
  }, [scope])

  useEffect(() => {
    orderRef.current = order
  }, [order])

  useEffect(() => {
    onItemsChangeRef.current = onItemsChange
  }, [onItemsChange])

  const scopeKey = useMemo(() => JSON.stringify(scope), [scope])

  const filterKey = useMemo(
    () =>
      JSON.stringify(
        draftToQueryFilters(
          applied,
          scope,
          0,
          Boolean(showStats),
          order
        )
      ),
    [applied, scope, showStats, order]
  )

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setApplied(
        draftWithLockedDate(
          {
            ...draft,
            search: draft.search.trim(),
          },
          lockedDate
        )
      )
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(handle)
  }, [draft, lockedDate])

  useEffect(() => {
    if (!enabled || !needsEmployees || !isAuthReady || !companyId) return

    let cancelled = false

    void listEmployees(companyId).then((result) => {
      if (cancelled || !result.data) return
      const sorted = [...result.data].sort((a, b) => {
        const left = [a.firstName, a.lastName].filter(Boolean).join(" ")
        const right = [b.firstName, b.lastName].filter(Boolean).join(" ")
        return left.localeCompare(right, "es")
      })
      setEmployees(sorted)
    })

    return () => {
      cancelled = true
    }
  }, [companyId, enabled, isAuthReady, needsEmployees])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function loadFirstPage() {
      setIsLoading(true)
      setError(null)

      const result = await fetchActivityTimeline(
        draftToQueryFilters(
          appliedRef.current,
          scopeRef.current,
          0,
          Boolean(showStats),
          orderRef.current
        )
      )

      if (cancelled) return

      if (!result.success) {
        setError(result.message)
        setItems([])
        setStats(EMPTY_STATS)
        setHasMore(false)
        setIsLoading(false)
        onItemsChangeRef.current?.([], EMPTY_STATS)
        return
      }

      setItems(result.data.items)
      setStats(result.data.stats)
      setHasMore(result.data.hasMore)
      setIsLoading(false)
      onItemsChangeRef.current?.(result.data.items, result.data.stats)
    }

    void loadFirstPage()

    return () => {
      cancelled = true
    }
  }, [enabled, filterKey, scopeKey, showStats])

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMoreRef.current || !hasMoreRef.current) return

    setIsLoadingMore(true)
    loadingMoreRef.current = true

    const result = await fetchActivityTimeline(
      draftToQueryFilters(
        appliedRef.current,
        scopeRef.current,
        itemsLengthRef.current,
        false,
        orderRef.current
      )
    )

    if (!result.success) {
      setError(result.message)
      setIsLoadingMore(false)
      loadingMoreRef.current = false
      return
    }

    setItems((prev) => {
      const seen = new Set(prev.map((item) => item.id))
      const appended = result.data.items.filter((item) => !seen.has(item.id))
      const next = [...prev, ...appended]
      onItemsChangeRef.current?.(next, {
        ...result.data.stats,
        total: result.data.total,
      })
      return next
    })
    setHasMore(result.data.hasMore)
    setIsLoadingMore(false)
    loadingMoreRef.current = false
  }, [enabled])

  useEffect(() => {
    if (!enabled || isLoading) return

    const root = scrollRootRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore()
        }
      },
      { root, rootMargin: "120px", threshold: 0 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [enabled, isLoading, loadMore, hasMore, items.length])

  const clearFilters = () => {
    const cleared = draftWithLockedDate(
      EMPTY_ACTIVITY_TIMELINE_DRAFT,
      lockedDate
    )
    setDraft(cleared)
    setApplied(cleared)
  }

  const effectiveVisibleFilters = {
    ...visibleFilters,
    ...(lockedDate
      ? { dateFrom: false, dateTo: false }
      : null),
  }

  const totalLabel = `${stats.total} evento${stats.total === 1 ? "" : "s"}`
  const filtersPanel = (
    <ActivityTimelineFiltersPanel
      draft={draft}
      onChange={(next) => setDraft(draftWithLockedDate(next, lockedDate))}
      onClear={clearFilters}
      visibleFilters={effectiveVisibleFilters}
      companyLabel={companyDisplayLabel(companyId)}
      employees={employees}
      isLoading={isLoading}
      layout={layout === "global" ? "sidebar" : "inline"}
      totalLabel={totalLabel}
    />
  )

  const feed = (
    <ActivityTimelineFeed
      items={items}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      error={error}
      scrollRootRef={scrollRootRef}
      sentinelRef={sentinelRef}
      groupByDay={groupByDay}
      showInterEventGaps={showInterEventGaps}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto px-4 py-4",
        feedClassName
      )}
    />
  )

  if (layout === "global") {
    return (
      <div className={cn("grid min-h-0 flex-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]", className)}>
        {filtersPanel}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Timeline</h2>
            <p className="text-xs text-muted-foreground">
              Más reciente primero · scroll infinito
            </p>
          </div>
          {showStats ? (
            <div className="border-b px-4 py-3">
              <ActivityTimelineStatsHeader stats={stats} isLoading={isLoading} />
            </div>
          ) : null}
          {feed}
        </section>
      </div>
    )
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-4", className)}>
      {showStats ? (
        <ActivityTimelineStatsHeader stats={stats} isLoading={isLoading} />
      ) : null}
      {filtersPanel}
      <section className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Timeline</h2>
          <p className="text-xs text-muted-foreground">
            Más reciente primero · scroll infinito
          </p>
        </div>
        {feed}
      </section>
    </div>
  )
}
