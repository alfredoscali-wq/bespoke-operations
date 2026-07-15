"use client"

import { Search, X } from "lucide-react"

import type {
  Task,
  TaskPriority,
  TaskSortDirection,
  TaskSortField,
  TaskStatus,
  TaskType,
} from "@/lib/types/tasks"
import type { CrewFilterOption } from "@/lib/tasks/crew-relation"
import { taskMatchesCrewFilter } from "@/lib/tasks/crew-relation"
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  TASK_TYPE_OPTIONS,
} from "@/lib/tasks/constants"
import { compareDateOnly } from "@/lib/dates/date-only"
import { compareTasksByDispatchRoute } from "@/lib/tasks/dispatch-order"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FILTER_SEARCH_INPUT_CLASS,
  FILTER_SELECT_TRIGGER_CLASS,
} from "@/lib/ui/visual-tokens"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type TaskFilters = {
  search: string
  status: TaskStatus | "all"
  type: TaskType | "all"
  priority: TaskPriority | "all"
  crew: string | "all"
  sortField: TaskSortField
  sortDirection: TaskSortDirection
}

export const defaultTaskFilters: TaskFilters = {
  search: "",
  status: "all",
  type: "all",
  priority: "all",
  crew: "all",
  sortField: "dueDate",
  sortDirection: "asc",
}

type TasksFiltersProps = {
  filters: TaskFilters
  onChange: (filters: TaskFilters) => void
  resultCount: number
  showSort?: boolean
  crewOptions?: CrewFilterOption[]
  operationalMode?: boolean
}

const sortOptions: { value: TaskSortField; label: string }[] = [
  { value: "dueDate", label: "Fecha límite" },
  { value: "priority", label: "Prioridad" },
  { value: "status", label: "Estado" },
  { value: "progress", label: "Progreso" },
  { value: "code", label: "Código" },
]

const operationalSortOptions: { value: TaskSortField; label: string }[] = [
  { value: "dueDate", label: "Fecha programada" },
  { value: "progress", label: "Progreso" },
  { value: "code", label: "Código" },
]

const priorityOrder: Record<TaskPriority, number> = {
  alta: 3,
  media: 2,
  baja: 1,
}

const statusOrder: Record<TaskStatus, number> = {
  programada: 1,
  asignada: 2,
  vencida: 3,
  "en-curso": 4,
  incidencia: 5,
  "pendiente-cierre": 6,
  finalizada: 7,
  "en-aprobacion": 8,
  cerrada: 7,
  cancelada: 9,
}

export function TasksFiltersBar({
  filters,
  onChange,
  resultCount,
  showSort = true,
  crewOptions = [],
  operationalMode = false,
}: TasksFiltersProps) {
  const visibleSortOptions = operationalMode ? operationalSortOptions : sortOptions

  const hasActiveFilters =
    filters.search !== "" ||
    (!operationalMode && filters.status !== "all") ||
    filters.type !== "all" ||
    filters.priority !== "all" ||
    filters.crew !== "all"

  function update<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder={
              operationalMode
                ? "Buscar por código, cliente o dirección..."
                : "Buscar por código, orden de trabajo u obra..."
            }
            className={FILTER_SEARCH_INPUT_CLASS}
          />
        </div>

        <div
          className={
            operationalMode
              ? "grid grid-cols-2 gap-2 sm:grid-cols-3 xl:w-auto xl:min-w-[480px]"
              : "grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-auto xl:min-w-[640px]"
          }
        >
          {!operationalMode && (
            <Select
              value={filters.status}
              onValueChange={(value) =>
                update("status", value as TaskFilters["status"])
              }
            >
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {TASK_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={filters.type}
            onValueChange={(value) =>
              update("type", value as TaskFilters["type"])
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {TASK_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.priority}
            onValueChange={(value) =>
              update("priority", value as TaskFilters["priority"])
            }
            disabled={operationalMode}
          >
            <SelectTrigger
              className={
                operationalMode
                  ? "hidden"
                  : FILTER_SELECT_TRIGGER_CLASS
              }
            >
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {TASK_PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.crew}
            onValueChange={(value) => update("crew", value)}
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Cuadrilla" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {crewOptions.map((crew) => (
                <SelectItem key={crew.id} value={crew.id}>
                  {crew.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {resultCount}{" "}
          {operationalMode
            ? resultCount === 1
              ? "orden encontrada"
              : "órdenes encontradas"
            : resultCount === 1
              ? "orden de trabajo encontrada"
              : "órdenes de trabajo encontradas"}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {showSort && (
            <>
              <Select
                value={filters.sortField}
                onValueChange={(value) =>
                  update("sortField", value as TaskSortField)
                }
              >
                <SelectTrigger className="h-8 w-[160px] bg-background text-xs">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  {visibleSortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.sortDirection}
                onValueChange={(value) =>
                  update("sortDirection", value as TaskSortDirection)
                }
              >
                <SelectTrigger className="h-8 w-[130px] bg-background text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascendente</SelectItem>
                  <SelectItem value="desc">Descendente</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onChange(defaultTaskFilters)}
            >
              <X className="size-3" />
              Limpiar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function taskMatchesAdminSearch(
  task: {
    code: string
    title: string
    projectCode: string
    projectName: string
    customerName?: string
    customerCompany?: string
    customerPhone?: string
    serviceAddress?: string
    locality?: string | null
    workOrderNumber?: string
    observationsForCrew?: string
    description?: string
    cancellationReason?: string
    cancellationObservation?: string
    rescheduleReason?: string
    rescheduleNotes?: string
  },
  query: string
): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  const values = [
    task.code,
    task.workOrderNumber,
    task.title,
    task.projectCode,
    task.projectName,
    task.customerName,
    task.customerCompany,
    task.serviceAddress,
    task.locality,
    task.customerPhone,
    task.observationsForCrew,
    task.description,
    task.cancellationReason,
    task.cancellationObservation,
    task.rescheduleReason,
    task.rescheduleNotes,
  ]

  const customerName = task.customerName?.trim()
  if (customerName) {
    values.push(customerName)
    values.push(customerName.split(/\s+/).join(" "))
    for (const part of customerName.split(/\s+/)) {
      values.push(part)
    }
  }

  return values.some((value) =>
    value?.trim().toLowerCase().includes(normalizedQuery)
  )
}

export function filterAdminTasks<
  T extends {
    code: string
    title: string
    projectCode: string
    projectName: string
    status: TaskStatus
    dueDate: string
    customerName?: string
    customerCompany?: string
    customerPhone?: string
    serviceAddress?: string
    locality?: string | null
    workOrderNumber?: string
  },
>(tasks: T[], search: string, status: TaskStatus | "all" = "all"): T[] {
  const filtered = tasks.filter((task) => {
    return (
      taskMatchesAdminSearch(task, search) &&
      (status === "all" || task.status === status)
    )
  })

  return [...filtered].sort(
    (a, b) => compareDateOnly(a.dueDate, b.dueDate) || a.code.localeCompare(b.code)
  )
}

export function filterAndSortTasks<
  T extends {
    code: string
    title: string
    projectCode: string
    projectName: string
    status: TaskStatus
    type: TaskType
    priority: TaskPriority
    crew: string
    crewId?: string
    dueDate: string
    progress: number
  },
>(
  tasks: T[],
  filters: TaskFilters,
  crews: Pick<{ id: string; name: string }, "id" | "name">[] = []
): T[] {
  const query = filters.search.trim().toLowerCase()

  const filtered = tasks.filter((task) => {
    const searchableTask = task as T & {
      customerName?: string
      serviceAddress?: string
      locality?: string
    }

    const matchesSearch =
      query === "" || taskMatchesAdminSearch(searchableTask, query)

    return (
      matchesSearch &&
      (filters.status === "all" || task.status === filters.status) &&
      (filters.type === "all" || task.type === filters.type) &&
      (filters.priority === "all" || task.priority === filters.priority) &&
      taskMatchesCrewFilter(task, filters.crew, crews)
    )
  })

  const direction = filters.sortDirection === "asc" ? 1 : -1

  return [...filtered].sort((a, b) => {
    switch (filters.sortField) {
      case "dueDate": {
        const byDate = direction * compareDateOnly(a.dueDate, b.dueDate)
        if (byDate !== 0) {
          return byDate
        }

        return (
          direction *
          compareTasksByDispatchRoute(a as unknown as Task, b as unknown as Task, crews)
        )
      }
      case "priority":
        return direction * (priorityOrder[a.priority] - priorityOrder[b.priority])
      case "status":
        return direction * (statusOrder[a.status] - statusOrder[b.status])
      case "progress":
        return direction * (a.progress - b.progress)
      case "code":
        return direction * a.code.localeCompare(b.code)
      default:
        return 0
    }
  })
}
