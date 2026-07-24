"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Radar } from "lucide-react"

import { ActivityEmployeeView } from "@/components/activity/activity-employee-view"
import { ActivityExecutiveDashboard } from "@/components/activity/activity-executive-dashboard"
import { ActivityViewerDetailSheet } from "@/components/activity/activity-viewer-detail-sheet"
import { ActivityViewerFilters } from "@/components/activity/activity-viewer-filters"
import {
  formatActivityActionLabel,
  formatActivityDisplayTimestamp,
  formatActivityEntityTypeLabel,
  formatActivityModuleLabel,
  formatActivityOriginLabel,
} from "@/lib/activity/activity-viewer-labels"
import {
  resolveActivityQuickRange,
  type ActivityQuickRange,
} from "@/lib/activity/employee-activity-view"
import {
  ACTIVITY_VIEWER_PAGE_SIZE,
  type ActivityViewerEntry,
} from "@/lib/activity/activity-viewer-types"
import {
  buildActivityViewerSearchParams,
  parseActivityViewerSearchParams,
  type ActivityViewerUrlState,
} from "@/lib/activity/activity-viewer-query"
import { fetchActivityViewerEvents } from "@/lib/activity/fetch-activity-viewer.client"
import { useIsSystemAdministrator } from "@/lib/auth/use-is-system-administrator"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** Existing API caps at 200; used when focusing an employee timeline. */
const EMPLOYEE_VIEW_PAGE_SIZE = 200
const EMPLOYEE_VIEW_MAX_ENTRIES = 1000

export function ActivityViewerModule() {
  const isAdministrator = useIsSystemAdministrator()
  const router = useRouter()
  const searchParams = useSearchParams()

  const filters = useMemo(
    () => parseActivityViewerSearchParams(searchParams),
    [searchParams]
  )

  const [entries, setEntries] = useState<ActivityViewerEntry[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(() => isAdministrator)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<ActivityViewerEntry | null>(
    null
  )
  const [detailOpen, setDetailOpen] = useState(false)

  const listFilterKey = useMemo(
    () =>
      buildActivityViewerSearchParams({
        from: filters.from,
        to: filters.to,
        userSearch: filters.userSearch,
        employeeId: filters.employeeId,
        area: filters.area,
        module: filters.module,
        action: filters.action,
        origin: filters.origin,
        limit: filters.employeeId
          ? EMPLOYEE_VIEW_PAGE_SIZE
          : (filters.limit ?? ACTIVITY_VIEWER_PAGE_SIZE),
        offset: 0,
      }).toString(),
    [filters]
  )

  const pageLimit = filters.employeeId
    ? EMPLOYEE_VIEW_PAGE_SIZE
    : (filters.limit ?? ACTIVITY_VIEWER_PAGE_SIZE)

  const syncUrl = useCallback(
    (next: ActivityViewerUrlState) => {
      const params = buildActivityViewerSearchParams(next)
      const query = params.toString()
      router.replace(query ? `/activity?${query}` : "/activity")
    },
    [router]
  )

  useEffect(() => {
    if (!isAdministrator) {
      return
    }

    let cancelled = false

    async function loadEntries() {
      setIsLoading(true)
      setError(null)

      const params = buildActivityViewerSearchParams({
        ...filters,
        offset: 0,
        limit: pageLimit,
      })
      const result = await fetchActivityViewerEvents(params)

      if (cancelled) return

      if (!result.success) {
        setError(result.message)
        setEntries([])
        setTotal(0)
        setHasMore(false)
        setIsLoading(false)
        return
      }

      let nextEntries = result.data.entries
      let nextTotal = result.data.total
      let nextHasMore = result.data.hasMore

      // For employee timeline/metrics, page through existing API (no backend change).
      if (filters.employeeId) {
        while (
          nextHasMore &&
          nextEntries.length < EMPLOYEE_VIEW_MAX_ENTRIES &&
          !cancelled
        ) {
          const moreParams = buildActivityViewerSearchParams({
            ...filters,
            offset: nextEntries.length,
            limit: pageLimit,
          })
          const more = await fetchActivityViewerEvents(moreParams)
          if (!more.success) {
            setError(more.message)
            break
          }
          nextEntries = [...nextEntries, ...more.data.entries]
          nextTotal = more.data.total
          nextHasMore = more.data.hasMore
        }
      }

      if (cancelled) return

      setEntries(nextEntries)
      setTotal(nextTotal)
      setHasMore(nextHasMore && !filters.employeeId)
      setIsLoading(false)
    }

    void loadEntries()

    return () => {
      cancelled = true
    }
  }, [listFilterKey, filters, isAdministrator, pageLimit])

  if (!isAdministrator) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
          <CardDescription>
            Activity Engine Viewer está disponible solo para administradores.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  function handleFiltersChange(next: ActivityViewerUrlState) {
    syncUrl({ ...next, offset: 0 })
  }

  function handleResetFilters() {
    syncUrl({ offset: 0, limit: ACTIVITY_VIEWER_PAGE_SIZE })
  }

  function handleEmployeeChange(employeeId: string | undefined) {
    syncUrl({
      ...filters,
      employeeId,
      offset: 0,
    })
  }

  function handleQuickRangeChange(range: ActivityQuickRange) {
    const { from, to } = resolveActivityQuickRange(range)
    syncUrl({
      ...filters,
      from,
      to,
      offset: 0,
    })
  }

  async function handleLoadMore() {
    if (isLoadingMore || !hasMore || filters.employeeId) return

    setIsLoadingMore(true)
    const nextOffset = entries.length
    const params = buildActivityViewerSearchParams({
      ...filters,
      offset: nextOffset,
      limit: pageLimit,
    })
    const result = await fetchActivityViewerEvents(params)
    setIsLoadingMore(false)

    if (!result.success) {
      setError(result.message)
      return
    }

    setEntries((current) => [...current, ...result.data.entries])
    setTotal(result.data.total)
    setHasMore(result.data.hasMore)
  }

  function openDetail(entry: ActivityViewerEntry) {
    setSelectedEntry(entry)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Activity Engine
        </h1>
        <p className="text-sm text-muted-foreground">
          Dashboard ejecutivo y visor de solo lectura sobre eventos ya
          registrados en producción.
        </p>
      </div>

      <ActivityExecutiveDashboard
        entries={entries}
        isLoading={isLoading}
        onSelectEntry={openDetail}
      />

      <ActivityEmployeeView
        employeeId={filters.employeeId}
        from={filters.from}
        to={filters.to}
        entries={entries}
        isLoading={isLoading}
        onEmployeeChange={handleEmployeeChange}
        onQuickRangeChange={handleQuickRangeChange}
        onSelectEntry={openDetail}
      />

      <ActivityViewerFilters
        filters={filters}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radar className="size-4" />
              Eventos
            </CardTitle>
            <CardDescription>
              {total} registro{total === 1 ? "" : "s"} · ordenados por fecha
              descendente
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Origen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Cargando eventos...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-sm text-muted-foreground"
                    >
                      No hay eventos para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(entry)}
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatActivityDisplayTimestamp(entry.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">{entry.userName}</TableCell>
                      <TableCell className="text-sm">{entry.areaLabel}</TableCell>
                      <TableCell className="text-sm">
                        {formatActivityModuleLabel(String(entry.module))}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatActivityActionLabel(String(entry.action))}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-0.5">
                          <p>
                            {formatActivityEntityTypeLabel(
                              String(entry.entityType)
                            )}
                          </p>
                          {entry.entityId ? (
                            <p className="font-mono text-xs text-muted-foreground">
                              {entry.entityId}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm">
                        {entry.detail || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatActivityOriginLabel(String(entry.origin))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {hasMore ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleLoadMore()}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  "Cargar más"
                )}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ActivityViewerDetailSheet
        entry={selectedEntry}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
