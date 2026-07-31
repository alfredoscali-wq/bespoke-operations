"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Users } from "lucide-react"

import { EmployeeDailyReport } from "@/components/rrhh/employee-daily-report"
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
import {
  WORKFORCE_ACTIVITY_STATUS_LABELS,
  type WorkforceActivityStatus,
} from "@/lib/activity/workforce-activity-status"
import {
  mergeWorkforceRowsWithEmployees,
  type WorkforceMonitorRow,
} from "@/lib/activity/workforce-monitor"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SYSTEM_ROLE_LABELS } from "@/lib/employees/constants"
import { getEmployeeDisplayName } from "@/lib/employees/utils"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listEmployees } from "@/lib/supabase/employees.browser"
import type { Employee, SystemRole } from "@/lib/types/employees"
import { FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

const ALL_VALUE = "__all__"
const PAGE_SIZE = 25

type SortColumn =
  | "employee"
  | "area"
  | "role"
  | "firstEventAt"
  | "lastEventAt"
  | "eventCount"
  | "customers"
  | "requests"
  | "workOrders"
  | "attentions"
  | "commercialActivities"
  | "projects"
  | "settings"
  | "lastModule"
  | "activityStatus"

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
  return `${formatActivityTimelineTime(value)}`
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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  )

  const [areaFilter, setAreaFilter] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [employeeFilter, setEmployeeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"" | WorkforceActivityStatus>(
    ""
  )
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortState>({
    column: "eventCount",
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
        ? getEmployeeDisplayName(employee)
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
      if (
        opsAreaFilter &&
        !row.opsAreaIds.includes(opsAreaFilter)
      ) {
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
        case "role":
          return compareNullableString(
            left.roleLabel,
            right.roleLabel,
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
        case "eventCount":
          return compareNumber(left.eventCount, right.eventCount, direction)
        case "customers":
          return compareNumber(
            left.modules.customers,
            right.modules.customers,
            direction
          )
        case "requests":
          return compareNumber(
            left.modules.requests,
            right.modules.requests,
            direction
          )
        case "workOrders":
          return compareNumber(
            left.modules.workOrders,
            right.modules.workOrders,
            direction
          )
        case "attentions":
          return compareNumber(
            left.modules.attentions,
            right.modules.attentions,
            direction
          )
        case "commercialActivities":
          return compareNumber(
            left.modules.commercialActivities,
            right.modules.commercialActivities,
            direction
          )
        case "projects":
          return compareNumber(
            left.modules.projects,
            right.modules.projects,
            direction
          )
        case "settings":
          return compareNumber(
            left.modules.settings,
            right.modules.settings,
            direction
          )
        case "lastModule":
          return compareNullableString(
            left.lastModule,
            right.lastModule,
            direction
          )
        case "activityStatus":
          return compareNullableString(
            left.activityStatus,
            right.activityStatus,
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
        direction: column === "eventCount" ? "desc" : "asc",
      }
    })
    setPage(1)
  }

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId]
  )

  const openDailyReport = (employeeId: string) => {
    setSelectedEmployeeId(employeeId)
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">
          Workforce Monitor
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Solo administración, supervisión y gerencia pueden acceder a esta
          pantalla.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Users className="size-6 text-muted-foreground" />
            Workforce Monitor
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Supervisión de la jornada desde Activity Engine. Abrí la Producción
            de cualquier empleado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/activity">Sala de Situación</Link>
          </Button>
        </div>
      </div>

      {opsAreaFilter ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          Filtrado por área operacional:{" "}
          <span className="font-semibold">
            {getOperationsIntelligenceAreaLabel(opsAreaFilter)}
          </span>
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Filtros</h2>
            <p className="text-xs text-muted-foreground">
              {sortedRows.length} empleado{sortedRows.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            Limpiar
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-2">
            <Label htmlFor="workforce-date">Fecha</Label>
            <Input
              id="workforce-date"
              type="date"
              className="h-9 bg-background"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Área</Label>
            <Select
              value={areaFilter || ALL_VALUE}
              onValueChange={(value) => {
                setAreaFilter(value === ALL_VALUE ? "" : value)
                setPage(1)
              }}
            >
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
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

          <div className="space-y-2">
            <Label>Rol</Label>
            <Select
              value={roleFilter || ALL_VALUE}
              onValueChange={(value) => {
                setRoleFilter(value === ALL_VALUE ? "" : value)
                setPage(1)
              }}
            >
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
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

          <div className="space-y-2">
            <Label>Empleado</Label>
            <Select
              value={employeeFilter || ALL_VALUE}
              onValueChange={(value) => {
                setEmployeeFilter(value === ALL_VALUE ? "" : value)
                setPage(1)
              }}
            >
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
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
                      {getEmployeeDisplayName(employee)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Estado de actividad</Label>
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
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                {(
                  Object.keys(
                    WORKFORCE_ACTIVITY_STATUS_LABELS
                  ) as WorkforceActivityStatus[]
                ).map((status) => (
                  <SelectItem key={status} value={status}>
                    {WORKFORCE_ACTIVITY_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workforce-search">Buscador</Label>
            <Input
              id="workforce-search"
              className="h-9 bg-background"
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
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Jornada</h2>
          <p className="text-xs text-muted-foreground">
            {formatActivityTimelineDate(`${date}T12:00:00`) || date} · una fila
            por empleado · indicadores desde Activity Engine
          </p>
        </div>

        {error ? (
          <div className="px-4 py-6 text-sm text-destructive">{error}</div>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead
                  label="Empleado"
                  column="employee"
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
                  label="Rol"
                  column="role"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Primer evento"
                  column="firstEventAt"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Último evento"
                  column="lastEventAt"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Eventos"
                  column="eventCount"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Clientes"
                  column="customers"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Solicitudes"
                  column="requests"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="OT"
                  column="workOrders"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Atenciones"
                  column="attentions"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Actividades comerciales"
                  column="commercialActivities"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Obras"
                  column="projects"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Configuraciones"
                  column="settings"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Último módulo"
                  column="lastModule"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Estado"
                  column="activityStatus"
                  sort={sort}
                  onSort={toggleSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={15} className="h-28 text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Cargando Workforce Monitor…
                    </div>
                  </TableCell>
                </TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={15}
                    className="h-28 text-center text-sm text-muted-foreground"
                  >
                    No hay empleados para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => (
                  <TableRow
                    key={row.employeeId}
                    className="cursor-pointer"
                    onClick={() => openDailyReport(row.employeeId)}
                  >
                    <TableCell className="font-medium">
                      {row.employeeName}
                    </TableCell>
                    <TableCell>{row.area}</TableCell>
                    <TableCell>{row.roleLabel}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatStamp(row.firstEventAt)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatStamp(row.lastEventAt)}
                    </TableCell>
                    <TableCell className="tabular-nums font-semibold">
                      {row.eventCount}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.modules.customers}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.modules.requests}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.modules.workOrders}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.modules.attentions}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.modules.commercialActivities}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.modules.projects}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.modules.settings}
                    </TableCell>
                    <TableCell>{row.lastModule ?? "—"}</TableCell>
                    <TableCell>
                      <ActivityStatusBadge status={row.activityStatus} />
                    </TableCell>
                  </TableRow>
                ))
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

      <Sheet
        open={selectedEmployeeId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedEmployeeId(null)
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-3xl"
        >
          <SheetHeader>
            <SheetTitle>Producción</SheetTitle>
            <SheetDescription>
              {selectedEmployee
                ? getEmployeeDisplayName(selectedEmployee)
                : "Empleado"}{" "}
              · {formatActivityTimelineDate(`${date}T12:00:00`) || date}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 pb-6">
            {selectedEmployee ? (
              <EmployeeDailyReport
                key={`${selectedEmployee.id}:${date}`}
                employee={selectedEmployee}
                initialDate={date}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No se encontró el empleado seleccionado.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
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

function ActivityStatusBadge({
  status,
}: {
  status: WorkforceActivityStatus
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium",
        status === "sin_actividad" && "border-slate-200 bg-slate-50 text-slate-600",
        status === "baja_actividad" &&
          "border-amber-100 bg-amber-50 text-amber-800",
        status === "actividad_normal" &&
          "border-sky-100 bg-sky-50 text-sky-800",
        status === "alta_actividad" &&
          "border-emerald-100 bg-emerald-50 text-emerald-800"
      )}
    >
      {WORKFORCE_ACTIVITY_STATUS_LABELS[status]}
    </span>
  )
}
