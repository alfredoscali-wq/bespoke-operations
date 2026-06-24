"use client"

import { useMemo, useState } from "react"
import { Download, FileSpreadsheet, Plus } from "lucide-react"

import { EmployeeFormDialog } from "@/components/rrhh/employee-form-dialog"
import { EmployeesImportDialog } from "@/components/rrhh/employees-import-dialog"
import { EmployeesFiltersBar } from "@/components/rrhh/employees-filters"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { EmployeesSummaryCards } from "@/components/rrhh/employees-summary-cards"
import { EmployeesTable } from "@/components/rrhh/employees-table"
import { downloadEmployeeImportTemplate } from "@/lib/employees/employee-import/template"
import {
  buildEmployeeListItems,
  defaultEmployeeFilters,
  filterEmployees,
  getDepartmentOptions,
} from "@/lib/employees/utils"
import type { EmployeeFilters } from "@/lib/types/employees"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function EmployeesModule() {
  const { employees, addEmployee } = useEmployees()
  const [filters, setFilters] = useState<EmployeeFilters>(defaultEmployeeFilters)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const listItems = useMemo(
    () => buildEmployeeListItems(employees),
    [employees]
  )

  const departments = useMemo(
    () => getDepartmentOptions(employees),
    [employees]
  )

  const filteredEmployees = useMemo(
    () => filterEmployees(listItems, filters),
    [listItems, filters]
  )

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
            Nuevo empleado
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

      <EmployeesSummaryCards employees={employees} />

      <Card className="shadow-sm">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base">Personal registrado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          <EmployeesFiltersBar
            filters={filters}
            onChange={setFilters}
            resultCount={filteredEmployees.length}
            departments={departments}
          />
          <EmployeesTable employees={filteredEmployees} />
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
