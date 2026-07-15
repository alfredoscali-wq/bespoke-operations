"use client"

import { EMPLOYEE_REPORT_AREA_FILTER_OPTIONS } from "@/lib/reports/employee-individual"
import {
  formatEmployeeReportPeriodLabel,
  type EmployeeReportPeriod,
} from "@/lib/reports/employee-individual"
import { useEmployeeReports } from "@/components/reportes/empleado/employee-reports-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PERIOD_OPTIONS: EmployeeReportPeriod[] = [
  "hoy",
  "semana",
  "mes",
  "personalizado",
]

export function EmployeeReportFilters() {
  const {
    employeeId,
    setEmployeeId,
    areaFilter,
    setAreaFilter,
    supervisorFilter,
    setSupervisorFilter,
    period,
    setPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    employeeOptions,
    supervisorOptions,
    setActiveKpiKey,
  } = useEmployeeReports()

  return (
    <div className="space-y-3 print:hidden">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Empleado</p>
          <Select
            value={employeeId || undefined}
            onValueChange={(value) => {
              setEmployeeId(value)
              setActiveKpiKey(null)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar empleado" />
            </SelectTrigger>
            <SelectContent>
              {employeeOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Área</p>
          <Select
            value={areaFilter}
            onValueChange={(value) => {
              setAreaFilter(value as typeof areaFilter)
              setActiveKpiKey(null)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYEE_REPORT_AREA_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Supervisor (opcional)
          </p>
          <Select
            value={supervisorFilter}
            onValueChange={(value) => {
              setSupervisorFilter(value)
              setActiveKpiKey(null)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {supervisorOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Período</p>
          <div className="inline-flex flex-wrap rounded-lg border p-1">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={period === option ? "default" : "ghost"}
                onClick={() => {
                  setPeriod(option)
                  setActiveKpiKey(null)
                }}
              >
                {formatEmployeeReportPeriodLabel(option)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {period === "personalizado" ? (
        <div className="grid gap-3 sm:grid-cols-2 sm:max-w-lg">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Desde</p>
            <Input
              type="date"
              value={customStartDate}
              onChange={(event) => setCustomStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Hasta</p>
            <Input
              type="date"
              value={customEndDate}
              onChange={(event) => setCustomEndDate(event.target.value)}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
