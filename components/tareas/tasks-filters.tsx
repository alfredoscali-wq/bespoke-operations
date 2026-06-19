"use client"

import { Search, X } from "lucide-react"

import type {
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
}

const sortOptions: { value: TaskSortField; label: string }[] = [
  { value: "dueDate", label: "Fecha límite" },
  { value: "priority", label: "Prioridad" },
  { value: "status", label: "Estado" },
  { value: "progress", label: "Progreso" },
  { value: "code", label: "Código" },
]

const priorityOrder: Record<TaskPriority, number> = {
  alta: 3,
  media: 2,
  baja: 1,
}

const statusOrder: Record<TaskStatus, number> = {
  pendiente: 1,
  asignada: 2,
  "en-curso": 3,
  finalizada: 4,
  "en-aprobacion": 5,
  cerrada: 6,
  cancelada: 7,
}

export function TasksFiltersBar({
  filters,
  onChange,
  resultCount,
  showSort = true,
  crewOptions = [],
}: TasksFiltersProps) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
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
            placeholder="Buscar por código, tarea o proyecto..."
            className="h-9 bg-background pl-8"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-auto xl:min-w-[640px]">
          <Select
            value={filters.status}
            onValueChange={(value) =>
              update("status", value as TaskFilters["status"])
            }
          >
            <SelectTrigger className="h-9 w-full bg-background">
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

          <Select
            value={filters.type}
            onValueChange={(value) =>
              update("type", value as TaskFilters["type"])
            }
          >
            <SelectTrigger className="h-9 w-full bg-background">
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
          >
            <SelectTrigger className="h-9 w-full bg-background">
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
            <SelectTrigger className="h-9 w-full bg-background">
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
          {resultCount === 1 ? "tarea encontrada" : "tareas encontradas"}
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
                  {sortOptions.map((option) => (
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
    const matchesSearch =
      query === "" ||
      task.code.toLowerCase().includes(query) ||
      task.title.toLowerCase().includes(query) ||
      task.projectCode.toLowerCase().includes(query) ||
      task.projectName.toLowerCase().includes(query)

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
      case "dueDate":
        return (
          direction *
          (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        )
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
