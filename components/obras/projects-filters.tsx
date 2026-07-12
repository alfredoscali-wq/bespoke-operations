"use client"

import { useMemo } from "react"
import { Search, X } from "lucide-react"

import { useProjectSupervisorOptions } from "@/components/obras/project-supervisor-select"
import type { ProjectStatus, ProjectType } from "@/lib/types/projects"
import {
  getEmployeeFullName,
  resolveSupervisorDisplayName,
} from "@/lib/employees/utils"
import {
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
} from "@/lib/projects/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FILTER_SEARCH_INPUT_CLASS,
  FILTER_SELECT_TRIGGER_CLASS,
} from "@/lib/ui/visual-tokens"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type ProjectFilters = {
  search: string
  status: ProjectStatus | "all"
  type: ProjectType | "all"
  supervisor: string | "all"
  health: import("@/lib/projects/project-operational-metrics").ProjectHealth | "all"
}

type ProjectsFiltersProps = {
  filters: ProjectFilters
  onChange: (filters: ProjectFilters) => void
  resultCount: number
  operationalMode?: boolean
}

export const defaultProjectFilters: ProjectFilters = {
  search: "",
  status: "all",
  type: "all",
  supervisor: "all",
  health: "all",
}

export function ProjectsFilters({
  filters,
  onChange,
  resultCount,
  operationalMode = false,
}: ProjectsFiltersProps) {
  const supervisorOptions = useProjectSupervisorOptions()

  const supervisorFilterOptions = useMemo(
    () =>
      supervisorOptions.map((employee) => ({
        value: resolveSupervisorDisplayName(employee),
        label: `${employee.employeeCode} · ${getEmployeeFullName(employee)}`,
      })),
    [supervisorOptions]
  )

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.type !== "all" ||
    filters.supervisor !== "all"

  function update<K extends keyof ProjectFilters>(
    key: K,
    value: ProjectFilters[K]
  ) {
    onChange({ ...filters, [key]: value })
  }

  function clearFilters() {
    onChange(defaultProjectFilters)
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder="Buscar por código, nombre o cliente..."
            className={FILTER_SEARCH_INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[420px]">
          <Select
            value={filters.type}
            onValueChange={(value) =>
              update("type", value as ProjectFilters["type"])
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {PROJECT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="space-y-1">
            <Label htmlFor="filter-supervisor" className="sr-only">
              Supervisor
            </Label>
            <Select
              value={filters.supervisor}
              onValueChange={(value) => update("supervisor", value)}
              disabled={supervisorFilterOptions.length === 0}
            >
              <SelectTrigger
                id="filter-supervisor"
                className="h-9 w-full bg-background"
              >
                <SelectValue
                  placeholder={
                    supervisorFilterOptions.length === 0
                      ? "Sin supervisores"
                      : "Supervisor"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {supervisorFilterOptions.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    Sin supervisores
                  </SelectItem>
                ) : (
                  supervisorFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {!operationalMode ? (
            <Select
              value={filters.status}
              onValueChange={(value) =>
                update("status", value as ProjectFilters["status"])
              }
            >
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {PROJECT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {resultCount}{" "}
          {resultCount === 1 ? "obra encontrada" : "obras encontradas"}
        </span>
        {hasActiveFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={clearFilters}
          >
            <X className="size-3" />
            Limpiar filtros
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function filterProjects<
  T extends {
    code: string
    name: string
    client: string
    status: ProjectStatus
    type: ProjectType
    supervisor: string
  },
>(projects: T[], filters: ProjectFilters): T[] {
  const query = filters.search.trim().toLowerCase()

  return projects.filter((project) => {
    const matchesSearch =
      query === "" ||
      project.code.toLowerCase().includes(query) ||
      project.name.toLowerCase().includes(query) ||
      project.client.toLowerCase().includes(query)

    const matchesStatus =
      filters.status === "all" || project.status === filters.status

    const matchesType =
      filters.type === "all" || project.type === filters.type

    const matchesSupervisor =
      filters.supervisor === "all" ||
      project.supervisor === filters.supervisor

    return matchesSearch && matchesStatus && matchesType && matchesSupervisor
  })
}
