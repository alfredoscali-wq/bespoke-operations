"use client"

import { useMemo } from "react"

import { useEmployees } from "@/components/rrhh/employees-provider"
import {
  getEmployeeFullName,
  getSupervisorEmployees,
  resolveSupervisorDisplayName,
} from "@/lib/employees/utils"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ProjectSupervisorSelectProps = {
  id?: string
  label?: string
  value: string
  onValueChange: (supervisorName: string) => void
  disabled?: boolean
  showLegacyHint?: boolean
}

export function useProjectSupervisorOptions() {
  const { employees } = useEmployees()

  return useMemo(() => getSupervisorEmployees(employees), [employees])
}

export function ProjectSupervisorSelect({
  id = "supervisor",
  label = "Supervisor responsable",
  value,
  onValueChange,
  disabled = false,
  showLegacyHint = false,
}: ProjectSupervisorSelectProps) {
  const supervisorOptions = useProjectSupervisorOptions()

  const optionNames = useMemo(
    () =>
      supervisorOptions.map((employee) => resolveSupervisorDisplayName(employee)),
    [supervisorOptions]
  )

  const isLegacyValue =
    value.trim() !== "" && !optionNames.includes(value.trim())

  const selectDisabled = disabled || supervisorOptions.length === 0

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {showLegacyHint && isLegacyValue ? (
        <p className="text-xs text-amber-700">
          Supervisor actual: {value}. Seleccione un supervisor activo de RRHH.
        </p>
      ) : null}
      <Select
        value={value || undefined}
        onValueChange={onValueChange}
        disabled={selectDisabled}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue
            placeholder={
              supervisorOptions.length === 0
                ? "Sin supervisores disponibles"
                : "Seleccione supervisor"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {supervisorOptions.length === 0 ? (
            <SelectItem value="__none__" disabled>
              Sin supervisores disponibles
            </SelectItem>
          ) : (
            supervisorOptions.map((employee) => {
              const supervisorName = resolveSupervisorDisplayName(employee)
              return (
                <SelectItem key={employee.id} value={supervisorName}>
                  {employee.employeeCode} · {getEmployeeFullName(employee)}
                </SelectItem>
              )
            })
          )}
          {showLegacyHint && isLegacyValue ? (
            <SelectItem value={value} disabled>
              {value} (legacy)
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  )
}
