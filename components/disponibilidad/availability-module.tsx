"use client"

import { useCallback, useMemo, useState } from "react"
import { Plus } from "lucide-react"

import { AvailabilityFormDialog } from "@/components/disponibilidad/availability-form-dialog"
import { useAvailability } from "@/components/disponibilidad/availability-provider"
import { AvailabilitySummaryCards } from "@/components/disponibilidad/availability-summary-cards"
import { AvailabilityTable } from "@/components/disponibilidad/availability-table"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { buildAvailabilityListItem } from "@/lib/availability/utils"
import { getEmployeeDisplayName } from "@/lib/employees/utils"
import type { CreateEmployeeAvailabilityInput } from "@/lib/types/availability"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function AvailabilityModule() {
  const { records, addRecord } = useAvailability()
  const { employees } = useEmployees()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const getEmployeeLabel = useCallback(
    (employeeId: string) => {
      const employee = employees.find((item) => item.id === employeeId)
      return {
        name: employee ? getEmployeeDisplayName(employee) : "Empleado desconocido",
        code: employee?.employeeCode ?? "—",
      }
    },
    [employees]
  )

  const listItems = useMemo(
    () =>
      records.map((record) => {
        const employee = getEmployeeLabel(record.employeeId)
        return buildAvailabilityListItem(
          record,
          employee.name,
          employee.code
        )
      }),
    [records, getEmployeeLabel]
  )

  const employeeIds = useMemo(
    () => employees.map((employee) => employee.id),
    [employees]
  )

  async function handleCreate(input: CreateEmployeeAvailabilityInput) {
    const result = await addRecord(input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo registrar la novedad.")
    }
    setFeedback("Novedad registrada correctamente.")
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {feedback && (
            <p className="text-sm text-emerald-700" role="status">
              {feedback}
            </p>
          )}
        </div>
        <Button
          size="sm"
          className="gap-1.5 self-start"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-4" />
          Nueva novedad
        </Button>
      </div>

      <AvailabilitySummaryCards records={records} employeeIds={employeeIds} />

      <Card className="shadow-sm">
        <CardHeader className="border-b px-6 py-5">
          <CardTitle className="text-base font-semibold">
            Registros de novedades
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-5">
          <AvailabilityTable items={listItems} />
        </CardContent>
      </Card>

      <AvailabilityFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode="create"
        onSubmit={handleCreate}
      />
    </div>
  )
}
