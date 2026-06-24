"use client"

import { Search, X } from "lucide-react"

import {
  EMPLOYMENT_STATUS_OPTIONS,
  SYSTEM_ACCESS_FILTER_OPTIONS,
  SYSTEM_ROLE_FILTER_OPTIONS,
} from "@/lib/employees/constants"
import { defaultEmployeeFilters } from "@/lib/employees/utils"
import type { EmployeeFilters } from "@/lib/types/employees"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type EmployeesFiltersBarProps = {
  filters: EmployeeFilters
  onChange: (filters: EmployeeFilters) => void
  resultCount: number
  departments: string[]
}

export function EmployeesFiltersBar({
  filters,
  onChange,
  resultCount,
  departments,
}: EmployeesFiltersBarProps) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.employmentStatus !== "all" ||
    filters.department !== "all" ||
    filters.systemRole !== "all" ||
    filters.systemAccess !== "all"

  function update<K extends keyof EmployeeFilters>(
    key: K,
    value: EmployeeFilters[K]
  ) {
    onChange({ ...filters, [key]: value })
  }

  function clearFilters() {
    onChange(defaultEmployeeFilters)
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) => update("search", event.target.value)}
          placeholder="Buscar por código, nombre, apellido, DNI, email o cargo..."
          className="h-9 bg-background pl-8"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          value={filters.employmentStatus}
          onValueChange={(value) =>
            update("employmentStatus", value as EmployeeFilters["employmentStatus"])
          }
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Estado laboral" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.department}
          onValueChange={(value) => update("department", value)}
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los departamentos</SelectItem>
            {departments.map((department) => (
              <SelectItem key={department} value={department}>
                {department}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.systemRole}
          onValueChange={(value) =>
            update("systemRole", value as EmployeeFilters["systemRole"])
          }
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Rol del sistema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            {SYSTEM_ROLE_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.systemAccess}
          onValueChange={(value) =>
            update("systemAccess", value as EmployeeFilters["systemAccess"])
          }
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Acceso al sistema" />
          </SelectTrigger>
          <SelectContent>
            {SYSTEM_ACCESS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {resultCount}{" "}
          {resultCount === 1 ? "empleado encontrado" : "empleados encontrados"}
        </span>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={clearFilters}
          >
            <X className="size-3" />
            Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  )
}
