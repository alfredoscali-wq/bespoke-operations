"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  LogIn,
  ShieldAlert,
  Users,
} from "lucide-react"

import { AuditActionBadge } from "@/components/historial/audit-action-badge"
import { AuditLogDetailSheet } from "@/components/historial/audit-log-detail-sheet"
import { AuditLogFilters } from "@/components/historial/audit-log-filters"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import {
  formatAuditDisplayTimestamp,
  resolveAuditEntryDescription,
  resolveAuditStatusLabel,
} from "@/lib/audit/display-utils"
import {
  buildAuditExportUrl,
  fetchAuditLogs,
  fetchAuditStats,
} from "@/lib/audit/fetch-audit-logs.client"
import {
  applyHistorialKpiFilter,
  buildAuditEventsQueryParams,
  buildHistorialSearchParams,
  parseHistorialSearchParams,
  type HistorialUrlState,
} from "@/lib/audit/historial-query"
import {
  formatAuditEntityTypeLabel,
  formatAuditModuleLabel,
} from "@/lib/audit/audit-labels"
import type { AuditLogEntry, AuditLogStats } from "@/lib/audit/types"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const EMPTY_STATS: AuditLogStats = {
  eventsToday: 0,
  activeUsersToday: 0,
  tasksCreatedToday: 0,
  tasksFinishedToday: 0,
  criticalToday: 0,
  loginsToday: 0,
}

export function HistorialModule() {
  const isAdministrator = useIsSystemAdministrator()
  const router = useRouter()
  const searchParams = useSearchParams()

  const filters = useMemo(() => {
    const parsed = parseHistorialSearchParams(searchParams)
    return applyHistorialKpiFilter(parsed.kpi, parsed)
  }, [searchParams])

  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<AuditLogStats>(EMPTY_STATS)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / (filters.limit ?? 50)))

  const syncUrl = useCallback(
    (next: HistorialUrlState) => {
      const params = buildHistorialSearchParams(next)
      router.replace(`/historial?${params.toString()}`, { scroll: false })
    },
    [router]
  )

  useEffect(() => {
    let cancelled = false

    async function loadEntries() {
      setIsLoading(true)
      const result = await fetchAuditLogs(buildAuditEventsQueryParams(filters))

      if (cancelled) return

      if (!result.success) {
        setError(result.message)
        setEntries([])
        setTotal(0)
      } else {
        setError(null)
        setEntries(result.data.entries)
        setTotal(result.data.total)
      }

      setIsLoading(false)
    }

    void loadEntries()

    return () => {
      cancelled = true
    }
  }, [filters])

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      setIsLoadingStats(true)
      const result = await fetchAuditStats()

      if (cancelled) return

      if (result.success) {
        setStats(result.data)
      }

      setIsLoadingStats(false)
    }

    void loadStats()

    return () => {
      cancelled = true
    }
  }, [])

  if (!isAdministrator) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
          <CardDescription>
            El Log del Sistema está disponible solo para administradores.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  function handleFiltersChange(next: HistorialUrlState) {
    syncUrl(next)
  }

  function handleResetFilters() {
    syncUrl({ page: 1, limit: 50 })
  }

  function handleKpiClick(kpi: string) {
    if (filters.kpi === kpi) {
      syncUrl({ page: 1, limit: filters.limit ?? 50 })
      return
    }

    syncUrl(applyHistorialKpiFilter(kpi, { page: 1, limit: filters.limit ?? 50 }))
  }

  function openDetail(entry: AuditLogEntry) {
    setSelectedEntry(entry)
    setDetailOpen(true)
  }

  const exportParams = buildAuditEventsQueryParams(filters)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Log del Sistema
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Auditoría, trazabilidad y registro de eventos de la plataforma.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Download className="size-4" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={buildAuditExportUrl(exportParams, "csv")}>CSV</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={buildAuditExportUrl(exportParams, "xlsx")}>Excel</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={buildAuditExportUrl(exportParams, "pdf")}>PDF</a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <KpiCardGrid layout="wide">
        <FilterableKpiCard
          label="Eventos hoy"
          value={stats.eventsToday}
          icon={History}
          tone="blue"
          isLoading={isLoadingStats}
          isActive={filters.kpi === "events-today"}
          onClick={() => handleKpiClick("events-today")}
        />
        <FilterableKpiCard
          label="Usuarios activos"
          value={stats.activeUsersToday}
          icon={Users}
          tone="neutral"
          isLoading={isLoadingStats}
          isActive={filters.kpi === "active-users"}
          onClick={() => handleKpiClick("active-users")}
        />
        <FilterableKpiCard
          label="Órdenes de trabajo creadas hoy"
          value={stats.tasksCreatedToday}
          icon={Activity}
          tone="green"
          isLoading={isLoadingStats}
          isActive={filters.kpi === "tasks-created"}
          onClick={() => handleKpiClick("tasks-created")}
        />
        <FilterableKpiCard
          label="Órdenes de trabajo finalizadas hoy"
          value={stats.tasksFinishedToday}
          icon={Activity}
          tone="yellow"
          isLoading={isLoadingStats}
          isActive={filters.kpi === "tasks-finished"}
          onClick={() => handleKpiClick("tasks-finished")}
        />
        <FilterableKpiCard
          label="Errores"
          value={stats.criticalToday}
          icon={ShieldAlert}
          tone="red"
          isLoading={isLoadingStats}
          isActive={filters.kpi === "errors"}
          onClick={() => handleKpiClick("errors")}
        />
        <FilterableKpiCard
          label="Logins"
          value={stats.loginsToday}
          icon={LogIn}
          tone="violet"
          isLoading={isLoadingStats}
          isActive={filters.kpi === "logins"}
          onClick={() => handleKpiClick("logins")}
        />
      </KpiCardGrid>

      <AuditLogFilters
        filters={filters}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bitácora cronológica</CardTitle>
          <CardDescription>
            {total.toLocaleString("es-AR")} eventos encontrados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm">
                      Cargando log del sistema...
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm">
                      No hay eventos para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openDetail(entry)}
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatAuditDisplayTimestamp(entry.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">{entry.performedByName}</TableCell>
                      <TableCell className="text-sm">
                        {formatAuditModuleLabel(entry.module)}
                      </TableCell>
                      <TableCell>
                        <AuditActionBadge entry={entry} />
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-sm">
                        <div>{formatAuditEntityTypeLabel(entry.entityType)}</div>
                        {entry.entityLabel ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {entry.entityLabel}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate text-sm">
                        {resolveAuditEntryDescription(entry)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {resolveAuditStatusLabel(entry)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Página {filters.page ?? 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={(filters.page ?? 1) <= 1 || isLoading}
                onClick={() =>
                  handleFiltersChange({
                    ...filters,
                    page: Math.max((filters.page ?? 1) - 1, 1),
                  })
                }
              >
                <ChevronLeft className="size-4" />
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={(filters.page ?? 1) >= totalPages || isLoading}
                onClick={() =>
                  handleFiltersChange({
                    ...filters,
                    page: (filters.page ?? 1) + 1,
                  })
                }
              >
                Siguiente
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AuditLogDetailSheet
        entry={selectedEntry}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
