"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  PlayCircle,
  Radio,
  Timer,
} from "lucide-react"

import {
  ACTIVITY_QUICK_RANGE_OPTIONS,
  buildEmployeeActivitySummary,
  describeEmployeeTimelineEntry,
  formatEmployeeActivityLastSeen,
  groupEmployeeActivityByDay,
  matchActivityQuickRange,
  resolveActivityQuickRange,
  type ActivityQuickRange,
} from "@/lib/activity/employee-activity-view"
import type { ActivityViewerEntry } from "@/lib/activity/activity-viewer-types"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listEmployees } from "@/lib/supabase/employees.browser"
import { FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type EmployeeOption = {
  id: string
  label: string
}

type ActivityEmployeeViewProps = {
  employeeId?: string
  from?: string
  to?: string
  entries: ActivityViewerEntry[]
  isLoading: boolean
  onEmployeeChange: (employeeId: string | undefined) => void
  onQuickRangeChange: (range: ActivityQuickRange) => void
  onSelectEntry: (entry: ActivityViewerEntry) => void
}

export function ActivityEmployeeView({
  employeeId,
  from,
  to,
  entries,
  isLoading,
  onEmployeeChange,
  onQuickRangeChange,
  onSelectEntry,
}: ActivityEmployeeViewProps) {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false)

  const activeRange = useMemo(
    () => matchActivityQuickRange(from, to),
    [from, to]
  )

  const employeeEntries = useMemo(() => {
    if (!employeeId) return []
    return entries.filter((entry) => entry.employeeId === employeeId)
  }, [entries, employeeId])

  const summary = useMemo(
    () => buildEmployeeActivitySummary(employeeEntries),
    [employeeEntries]
  )

  const dayGroups = useMemo(
    () => groupEmployeeActivityByDay(employeeEntries),
    [employeeEntries]
  )

  const selectedEmployeeLabel = useMemo(() => {
    if (!employeeId) return null
    return (
      employees.find((item) => item.id === employeeId)?.label ??
      employeeEntries[0]?.userName ??
      employeeId
    )
  }, [employeeId, employees, employeeEntries])

  useEffect(() => {
    if (!isAuthReady || !companyId) return

    let cancelled = false

    async function loadEmployees() {
      setIsLoadingEmployees(true)
      const result = await listEmployees(companyId)
      if (cancelled) return

      if (result.data) {
        setEmployees(
          result.data
            .map((employee) => ({
              id: employee.id,
              label:
                `${employee.lastName}, ${employee.firstName}`.trim() ||
                employee.employeeCode ||
                employee.id,
            }))
            .sort((a, b) => a.label.localeCompare(b.label, "es"))
        )
      } else {
        setEmployees([])
      }

      setIsLoadingEmployees(false)
    }

    void loadEmployees()

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-base">Actividad por empleado</CardTitle>
            <CardDescription>
              Timeline y resumen calculados a partir de los eventos ya
              registrados.
            </CardDescription>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label>Empleado</Label>
              <Select
                value={employeeId ?? "none"}
                onValueChange={(value) =>
                  onEmployeeChange(value === "none" ? undefined : value)
                }
                disabled={isLoadingEmployees}
              >
                <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                  <SelectValue
                    placeholder={
                      isLoadingEmployees
                        ? "Cargando empleados..."
                        : "Seleccionar empleado"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin empleado</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rango rápido</Label>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_QUICK_RANGE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={activeRange === option.value ? "default" : "outline"}
                    onClick={() => onQuickRangeChange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {employeeId ? (
        <>
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              Resumen de{" "}
              <span className="font-medium text-foreground">
                {selectedEmployeeLabel}
              </span>
            </p>
            <KpiCardGrid layout="wide" className="xl:grid-cols-4 2xl:grid-cols-7">
              <FilterableKpiCard
                label="Eventos registrados"
                value={summary.eventsRegistered}
                icon={Radio}
                compact
                isLoading={isLoading}
                disabled
              />
              <FilterableKpiCard
                label="OT creadas"
                value={summary.tasksCreated}
                icon={ClipboardList}
                compact
                isLoading={isLoading}
                disabled
              />
              <FilterableKpiCard
                label="OT programadas"
                value={summary.tasksScheduled}
                icon={CalendarDays}
                compact
                isLoading={isLoading}
                disabled
              />
              <FilterableKpiCard
                label="OT iniciadas"
                value={summary.tasksStarted}
                icon={PlayCircle}
                compact
                isLoading={isLoading}
                disabled
              />
              <FilterableKpiCard
                label="OT finalizadas"
                value={summary.tasksFinished}
                icon={CheckCircle2}
                compact
                isLoading={isLoading}
                disabled
              />
              <FilterableKpiCard
                label="Consultas atendidas"
                value={summary.consultationsAttended}
                icon={MessageSquare}
                compact
                isLoading={isLoading}
                disabled
              />
              <FilterableKpiCard
                label="Última actividad"
                value={formatEmployeeActivityLastSeen(summary.lastActivityAt)}
                icon={Timer}
                compact
                isLoading={isLoading}
                disabled
              />
            </KpiCardGrid>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
              <CardDescription>
                Eventos agrupados por día, en orden cronológico.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Cargando actividad del empleado...
                </p>
              ) : dayGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay eventos para este empleado en el rango seleccionado.
                </p>
              ) : (
                <div className="space-y-8">
                  {dayGroups.map((group) => (
                    <section key={group.dayKey} className="space-y-3">
                      <h3 className="text-sm font-semibold capitalize tracking-tight text-foreground">
                        {group.label}
                      </h3>
                      <ol className="relative space-y-0 border-l border-border pl-5">
                        {group.entries.map((entry, index) => {
                          const description =
                            describeEmployeeTimelineEntry(entry)
                          const isLast = index === group.entries.length - 1

                          return (
                            <li
                              key={entry.id}
                              className={cn(
                                "relative pb-5",
                                isLast ? "pb-0" : null
                              )}
                            >
                              <span className="absolute top-1.5 -left-[1.41rem] size-2.5 rounded-full bg-primary ring-4 ring-background" />
                              <button
                                type="button"
                                className="w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
                                onClick={() => onSelectEntry(entry)}
                              >
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                  <p className="text-sm font-medium text-foreground">
                                    {description.title}
                                  </p>
                                  <p className="font-mono text-xs text-muted-foreground">
                                    {description.timeLabel}
                                  </p>
                                </div>
                                {description.subtitle ? (
                                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                    {description.subtitle}
                                  </p>
                                ) : null}
                              </button>
                            </li>
                          )
                        })}
                      </ol>
                    </section>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Seleccioná un empleado para ver su resumen y timeline de
              actividad.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
