"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  Users,
} from "lucide-react"

import {
  formatActivityTimelineDate,
  formatActivityTimelineTime,
} from "@/lib/activity/activity-timeline-groups"
import { todayDateInputValue } from "@/lib/activity/employee-daily-report"
import { fetchWorkforceMonitor } from "@/lib/activity/fetch-workforce-monitor.client"
import {
  getOperationsIntelligenceAreaLabel,
  type OperationsIntelligenceAreaId,
  OPERATIONS_INTELLIGENCE_AREAS,
} from "@/lib/activity/operations-intelligence"
import type { WorkforceActivityStatus } from "@/lib/activity/workforce-activity-status"
import {
  mergeWorkforceRowsWithEmployees,
  type WorkforceMonitorRow,
} from "@/lib/activity/workforce-monitor"
import {
  buildJornadaHref,
  buildWorkforceProductionHighlights,
  buildWorkforceProductionNarrative,
  formatWorkforceActiveTime,
  resolveWorkforceExecutiveStatus,
  workforceProductionScore,
  WORKFORCE_STATUS_FILTER_LABELS,
} from "@/lib/activity/workforce-monitor-ux"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SYSTEM_ROLE_LABELS } from "@/lib/employees/constants"
import {
  getEmployeeDisplayName,
  getEmployeeFullName,
} from "@/lib/employees/utils"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listEmployees } from "@/lib/supabase/employees.browser"
import type { Employee, SystemRole } from "@/lib/types/employees"
import { moduleColorVar } from "@/lib/ui/module-colors"
import { FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

const ALL_VALUE = "__all__"
const PAGE_SIZE = 25

type SortColumn =
  | "employee"
  | "area"
  | "activityStatus"
  | "production"
  | "firstEventAt"
  | "lastEventAt"

type SortState = {
  column: SortColumn
  direction: "asc" | "desc"
}

type EnrichedRow = WorkforceMonitorRow & {
  employeeName: string
  area: string
  role: SystemRole | null
  roleLabel: string
  searchBlob: string
  productionScore: number
}

function canAccessWorkforce(systemRole: string | null | undefined): boolean {
  return (
    systemRole === "administrador" ||
    systemRole === "supervisor" ||
    systemRole === "administrativo"
  )
}

function isOpsAreaId(value: string | null): value is OperationsIntelligenceAreaId {
  return OPERATIONS_INTELLIGENCE_AREAS.some((area) => area.id === value)
}

function formatStamp(value: string | null): string {
  if (!value) return "—"
  return formatActivityTimelineTime(value)
}

function compareNullableString(
  left: string | null,
  right: string | null,
  direction: "asc" | "desc"
): number {
  const a = left ?? ""
  const b = right ?? ""
  const result = a.localeCompare(b, "es")
  return direction === "asc" ? result : -result
}

function compareNumber(
  left: number,
  right: number,
  direction: "asc" | "desc"
): number {
  return direction === "asc" ? left - right : right - left
}

function productionScore(row: WorkforceMonitorRow): number {
  return workforceProductionScore(row.production)
}

export function WorkforceMonitorModule() {
  const searchParams = useSearchParams()
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const allowed = canAccessWorkforce(sessionUser?.systemRole)

  const dateFromUrl = searchParams.get("date")?.trim() || ""
  const opsAreaFromUrl = searchParams.get("opsArea")?.trim() || ""

  const [date, setDate] = useState(
    () => dateFromUrl || todayDateInputValue()
  )
  const [opsAreaFilter, setOpsAreaFilter] = useState<
    "" | OperationsIntelligenceAreaId
  >(() => (isOpsAreaId(opsAreaFromUrl) ? opsAreaFromUrl : ""))
  const [employees, setEmployees] = useState<Employee[]>([])
  const [activityRows, setActivityRows] = useState<WorkforceMonitorRow[]>([])
  const [isLoading, setIsLoading] = useState(allowed)
  const [error, setError] = useState<string | null>(null)

  const [areaFilter, setAreaFilter] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [employeeFilter, setEmployeeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"" | WorkforceActivityStatus>(
    ""
  )
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortState>({
    column: "production",
    direction: "desc",
  })
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      if (dateFromUrl) setDate(dateFromUrl)
      if (isOpsAreaId(opsAreaFromUrl)) setOpsAreaFilter(opsAreaFromUrl)
    })()

    return () => {
      cancelled = true
    }
  }, [dateFromUrl, opsAreaFromUrl])

  useEffect(() => {
    if (!allowed || !isAuthReady || !companyId) return

    let cancelled = false

    void listEmployees(companyId).then((result) => {
      if (cancelled || !result.data) return
      setEmployees(result.data)
    })

    return () => {
      cancelled = true
    }
  }, [allowed, companyId, isAuthReady])

  useEffect(() => {
    if (!allowed) return

    let cancelled = false

    void (async () => {
      await Promise.resolve()
      if (cancelled) return

      setIsLoading(true)
      setError(null)

      const result = await fetchWorkforceMonitor(date)
      if (cancelled) return

      if (!result.success) {
        setError(result.message)
        setActivityRows([])
        setIsLoading(false)
        return
      }

      setActivityRows(result.data.rows)
      setIsLoading(false)
      setPage(1)
    })()

    return () => {
      cancelled = true
    }
  }, [allowed, date])

  const areaOptions = useMemo(() => {
    const values = new Set<string>()
    for (const employee of employees) {
      const area = employee.department?.trim()
      if (area) values.add(area)
    }
    return [...values].sort((a, b) => a.localeCompare(b, "es"))
  }, [employees])

  const enrichedRows = useMemo(() => {
    const employeeIds = employees.map((employee) => employee.id)
    const merged = mergeWorkforceRowsWithEmployees(employeeIds, activityRows)
    const employeeById = new Map(
      employees.map((employee) => [employee.id, employee])
    )

    return merged.map((row): EnrichedRow => {
      const employee = employeeById.get(row.employeeId)
      const employeeName = employee
        ? getEmployeeFullName(employee)
        : row.employeeId
      const area = employee?.department?.trim() || "—"
      const role = employee?.systemRole ?? null
      const roleLabel = role ? SYSTEM_ROLE_LABELS[role] : "—"
      return {
        ...row,
        employeeName,
        area,
        role,
        roleLabel,
        productionScore: productionScore(row),
        searchBlob: [
          employeeName,
          area,
          roleLabel,
          row.employeeId,
          row.lastModule ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("es"),
      }
    })
  }, [activityRows, employees])

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("es")

    return enrichedRows.filter((row) => {
      if (opsAreaFilter && !row.opsAreaIds.includes(opsAreaFilter)) {
        return false
      }
      if (areaFilter && row.area !== areaFilter) return false
      if (roleFilter && row.role !== roleFilter) return false
      if (employeeFilter && row.employeeId !== employeeFilter) return false
      if (statusFilter && row.activityStatus !== statusFilter) return false
      if (needle && !row.searchBlob.includes(needle)) return false
      return true
    })
  }, [
    areaFilter,
    employeeFilter,
    enrichedRows,
    opsAreaFilter,
    roleFilter,
    search,
    statusFilter,
  ])

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows]
    const { column, direction } = sort

    rows.sort((left, right) => {
      switch (column) {
        case "employee":
          return compareNullableString(
            left.employeeName,
            right.employeeName,
            direction
          )
        case "area":
          return compareNullableString(left.area, right.area, direction)
        case "activityStatus":
          return compareNullableString(
            left.activityStatus,
            right.activityStatus,
            direction
          )
        case "production":
          return compareNumber(
            left.productionScore,
            right.productionScore,
            direction
          )
        case "firstEventAt":
          return compareNullableString(
            left.firstEventAt,
            right.firstEventAt,
            direction
          )
        case "lastEventAt":
          return compareNullableString(
            left.lastEventAt,
            right.lastEventAt,
            direction
          )
        default:
          return 0
      }
    })

    return rows
  }, [filteredRows, sort])

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = sortedRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const clearFilters = () => {
    setAreaFilter("")
    setRoleFilter("")
    setEmployeeFilter("")
    setStatusFilter("")
    setOpsAreaFilter("")
    setSearch("")
    setPage(1)
  }

  const toggleSort = (column: SortColumn) => {
    setSort((prev) => {
      if (prev.column === column) {
        return {
          column,
          direction: prev.direction === "asc" ? "desc" : "asc",
        }
      }
      return {
        column,
        direction: column === "production" ? "desc" : "asc",
      }
    })
    setPage(1)
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border bg-card px-6 py-10 text-center shadow-sm">
        <Users
          className="mx-auto size-8"
          style={{ color: moduleColorVar("people") }}
        />
        <h2 className="mt-3 text-base font-semibold">Workforce Monitor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Solo administración, supervisión y gerencia pueden acceder a esta
          pantalla.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Users
              className="size-5 shrink-0"
              style={{ color: moduleColorVar("people") }}
              aria-hidden
            />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Workforce Monitor
            </h1>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Supervisión de la actividad y producción del personal durante la
            jornada.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link href={`/activity?date=${date}`}>Sala de Situación</Link>
        </Button>
      </header>

      {opsAreaFilter ? (
        <p className="text-sm text-muted-foreground">
          Área operacional:{" "}
          <span className="font-medium text-foreground">
            {getOperationsIntelligenceAreaLabel(opsAreaFilter)}
          </span>
        </p>
      ) : null}

      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {sortedRows.length} empleado{sortedRows.length === 1 ? "" : "s"}
            {" · "}
            {formatActivityTimelineDate(`${date}T12:00:00`) || date}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={clearFilters}
          >
            Limpiar
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1">
            <Label htmlFor="workforce-date" className="text-xs">
              Fecha
            </Label>
            <Input
              id="workforce-date"
              type="date"
              className="h-8 bg-background"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Área</Label>
            <Select
              value={areaFilter || ALL_VALUE}
              onValueChange={(value) => {
                setAreaFilter(value === ALL_VALUE ? "" : value)
                setPage(1)
              }}
            >
              <SelectTrigger className={cn(FILTER_SELECT_TRIGGER_CLASS, "h-8")}>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todas</SelectItem>
                {areaOptions.map((area) => (
                  <SelectItem key={area} value={area}>
                    {area}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Rol</Label>
            <Select
              value={roleFilter || ALL_VALUE}
              onValueChange={(value) => {
                setRoleFilter(value === ALL_VALUE ? "" : value)
                setPage(1)
              }}
            >
              <SelectTrigger className={cn(FILTER_SELECT_TRIGGER_CLASS, "h-8")}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                {(Object.keys(SYSTEM_ROLE_LABELS) as SystemRole[]).map(
                  (role) => (
                    <SelectItem key={role} value={role}>
                      {SYSTEM_ROLE_LABELS[role]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Empleado</Label>
            <Select
              value={employeeFilter || ALL_VALUE}
              onValueChange={(value) => {
                setEmployeeFilter(value === ALL_VALUE ? "" : value)
                setPage(1)
              }}
            >
              <SelectTrigger className={cn(FILTER_SELECT_TRIGGER_CLASS, "h-8")}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                {[...employees]
                  .sort((a, b) =>
                    getEmployeeDisplayName(a).localeCompare(
                      getEmployeeDisplayName(b),
                      "es"
                    )
                  )
                  .map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {getEmployeeFullName(employee)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select
              value={statusFilter || ALL_VALUE}
              onValueChange={(value) => {
                setStatusFilter(
                  value === ALL_VALUE
                    ? ""
                    : (value as WorkforceActivityStatus)
                )
                setPage(1)
              }}
            >
              <SelectTrigger className={cn(FILTER_SELECT_TRIGGER_CLASS, "h-8")}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                {(
                  Object.keys(
                    WORKFORCE_STATUS_FILTER_LABELS
                  ) as WorkforceActivityStatus[]
                ).map((status) => (
                  <SelectItem key={status} value={status}>
                    {WORKFORCE_STATUS_FILTER_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="workforce-search" className="text-xs">
              Buscador
            </Label>
            <Input
              id="workforce-search"
              className="h-8 bg-background"
              placeholder="Nombre, área, rol…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        {error ? (
          <div className="px-5 py-6 text-sm text-destructive">{error}</div>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHead
                  label="Empleado"
                  column="employee"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Estado"
                  column="activityStatus"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Área"
                  column="area"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Producción"
                  column="production"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Jornada"
                  column="lastEventAt"
                  sort={sort}
                  onSort={toggleSort}
                />
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Acción
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Cargando equipo…
                    </div>
                  </TableCell>
                </TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-28 text-center text-sm text-muted-foreground"
                  >
                    No hay empleados para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => {
                  const status = resolveWorkforceExecutiveStatus({
                    activityStatus: row.activityStatus,
                    eventCount: row.eventCount,
                    selectedDate: date,
                  })
                  const highlights = buildWorkforceProductionHighlights(
                    row.production
                  )
                  const narrative = buildWorkforceProductionNarrative(
                    row.production
                  )
                  const jornadaHref = buildJornadaHref(row.employeeId, date)

                  return (
                    <TableRow
                      key={row.employeeId}
                      className="hover:bg-muted/30"
                    >
                      <TableCell className="align-top py-3">
                        <p className="text-sm font-medium text-foreground">
                          {row.employeeName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.roleLabel}
                        </p>
                      </TableCell>

                      <TableCell className="align-top py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              status.dotClassName
                            )}
                            aria-hidden
                          />
                          <span className="text-sm text-foreground">
                            {status.label}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="align-top py-3 text-sm text-foreground">
                        {row.area}
                      </TableCell>

                      <TableCell className="align-top py-3">
                        {highlights.length === 0 ? (
                          <p className="text-sm text-muted-foreground">—</p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-sm font-medium tabular-nums text-foreground">
                              {highlights
                                .slice(0, 2)
                                .map((item) => item.text)
                                .join(" · ")}
                            </p>
                            {narrative ? (
                              <p className="max-w-xs text-xs leading-snug text-muted-foreground">
                                {narrative}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="align-top py-3">
                        <div className="space-y-0.5 text-sm tabular-nums">
                          <p className="text-foreground">
                            {formatStamp(row.firstEventAt)}
                          </p>
                          <p className="text-foreground">
                            {formatStamp(row.lastEventAt)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatWorkforceActiveTime(
                              row.firstEventAt,
                              row.lastEventAt
                            )}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="align-top py-3">
                        <Link
                          href={jornadaHref}
                          className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          Ver jornada
                          <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Página {currentPage} de {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= pageCount || isLoading}
              onClick={() =>
                setPage((prev) => Math.min(pageCount, prev + 1))
              }
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SortableHead({
  label,
  column,
  sort,
  onSort,
}: {
  label: string
  column: SortColumn
  sort: SortState
  onSort: (column: SortColumn) => void
}) {
  const active = sort.column === column
  const Icon = !active
    ? ArrowUpDown
    : sort.direction === "asc"
      ? ArrowUp
      : ArrowDown

  return (
    <TableHead>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 text-left text-xs font-medium",
          active ? "text-foreground" : "text-muted-foreground"
        )}
        onClick={() => onSort(column)}
      >
        {label}
        <Icon className="size-3.5 opacity-70" />
      </button>
    </TableHead>
  )
}
