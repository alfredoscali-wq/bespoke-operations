"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Download, FileSpreadsheet, Plus } from "lucide-react"

import { EmployeeFormDialog } from "@/components/rrhh/employee-form-dialog"
import { EmployeesImportDialog } from "@/components/rrhh/employees-import-dialog"
import { EmployeesFiltersBar } from "@/components/rrhh/employees-filters"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { EmployeesSummaryCards } from "@/components/rrhh/employees-summary-cards"
import { EmployeesTable } from "@/components/rrhh/employees-table"
import { useEmployeeTypes } from "@/components/configuracion/use-employee-types"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"
import { downloadEmployeeImportTemplate } from "@/lib/employees/employee-import/template"
import { buildEmployeeTypeFilterOptions } from "@/lib/employees/employee-type-form"
import {
  buildEmployeeListItems,
  defaultEmployeeFilters,
  filterEmployees,
  getDepartmentOptions,
} from "@/lib/employees/utils"
import { filterInternalEmployees } from "@/lib/contractors/employees"
import {
  employeeSummaryKeyToFilters,
  parseEmploymentStatusQuery,
  parseEmployeeProvisionQuery,
  parseSystemRoleQuery,
} from "@/lib/navigation/query-filters"
import type { EmployeeFilters, EmployeeSummary } from "@/lib/types/employees"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function EmployeesModule() {
  const { employees, addEmployee } = useEmployees()
  const { items: employeeTypes } = useEmployeeTypes()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<EmployeeFilters>(defaultEmployeeFilters)
  const [activeKpi, setActiveKpi] = useState<keyof EmployeeSummary | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isHydratingFilters, setIsHydratingFilters] = useState(true)

  useEffect(() => {
    const employmentStatus = parseEmploymentStatusQuery(
      searchParams.get("employmentStatus")
    )
    const systemRole = parseSystemRoleQuery(searchParams.get("systemRole"))
    const provision = parseEmployeeProvisionQuery(searchParams.get("provision"))
    const systemAccessParam = searchParams.get("systemAccess")

    setFilters((current) => ({
      ...current,
      employmentStatus,
      systemRole,
      provision,
      systemAccess:
        systemAccessParam === "with" || systemAccessParam === "without"
          ? systemAccessParam
          : current.systemAccess,
    }))
    setIsHydratingFilters(false)
  }, [searchParams])

  const listItems = useMemo(
    () => buildEmployeeListItems(filterInternalEmployees(employees)),
    [employees]
  )

  const departments = useMemo(
    () => getDepartmentOptions(filterInternalEmployees(employees)),
    [employees]
  )

  const employeeTypeFilterOptions = useMemo(
    () =>
      buildEmployeeTypeFilterOptions(
        employeeTypes,
        filterInternalEmployees(employees)
      ),
    [employeeTypes, employees]
  )

  const filteredEmployees = useMemo(
    () =>
      filterEmployees(listItems, filters, {
        employeeTypeCatalog: employeeTypes,
      }),
    [listItems, filters, employeeTypes]
  )

  function handleKpiClick(key: keyof EmployeeSummary) {
    const nextFilters = {
      ...defaultEmployeeFilters,
      ...employeeSummaryKeyToFilters(key),
    }
    setFilters(nextFilters)
    setActiveKpi(key)
  }

  async function handleCreateEmployee(
    input: Parameters<typeof addEmployee>[0]
  ) {
    const result = await addEmployee(input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo registrar al empleado.")
    }
    setFeedback("Empleado registrado correctamente.")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {feedback && (
            <p className="text-sm text-emerald-700" role="status">
              {feedback}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setImportOpen(true)}
          >
            <FileSpreadsheet className="size-4" />
            Importar empleados
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4" />
            Nuevo Empleado
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => downloadEmployeeImportTemplate()}
          >
            <Download className="size-4" />
            Exportar
          </Button>
        </div>
      </div>

      <EmployeesSummaryCards
        employees={filterInternalEmployees(employees)}
        activeKpi={activeKpi}
        onKpiClick={handleKpiClick}
      />

      <Card className="shadow-sm">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base">Personal registrado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          <EmployeesFiltersBar
            filters={filters}
            onChange={(next) => {
              setFilters(next)
              setActiveKpi(null)
            }}
            resultCount={filteredEmployees.length}
            departments={departments}
            employeeTypeOptions={employeeTypeFilterOptions}
          />
          {isHydratingFilters && employees.length === 0 ? (
            <TableRowsSkeleton rows={8} columns={6} />
          ) : (
            <EmployeesTable employees={filteredEmployees} />
          )}
        </CardContent>
      </Card>

      <EmployeeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="create"
        onSubmit={handleCreateEmployee}
      />

      <EmployeesImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={setFeedback}
      />
    </div>
  )
}
