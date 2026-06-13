"use client"

import { useEffect, useMemo, useState } from "react"
import { LayoutGrid, List } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { TasksSummaryCards } from "@/components/tareas/tasks-summary-cards"
import {
  TasksFiltersBar,
  defaultTaskFilters,
  filterAndSortTasks,
} from "@/components/tareas/tasks-filters"
import { TasksKanban } from "@/components/tareas/tasks-kanban"
import { TasksListTable } from "@/components/tareas/tasks-list-table"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type ViewMode = "kanban" | "list"

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") {
    return "kanban"
  }

  return window.matchMedia("(max-width: 1023px)").matches ? "list" : "kanban"
}

export function TasksModule() {
  const { tasks } = useTasks()
  const [view, setView] = useState<ViewMode>("kanban")
  const [viewInitialized, setViewInitialized] = useState(false)
  const [filters, setFilters] = useState(defaultTaskFilters)

  useEffect(() => {
    setView(getInitialViewMode())
    setViewInitialized(true)
  }, [])

  const filteredTasks = useMemo(
    () => filterAndSortTasks(tasks, filters),
    [tasks, filters]
  )

  if (!viewInitialized) {
    return null
  }

  return (
    <div className="space-y-6">
      <TasksSummaryCards tasks={tasks} />

      <Card className="shadow-sm">
        <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            {view === "kanban" ? "Tablero Kanban" : "Listado de tareas"}
          </CardTitle>

          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            <Button
              variant={view === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 px-2.5"
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="size-3.5" />
              Kanban
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 px-2.5"
              onClick={() => setView("list")}
            >
              <List className="size-3.5" />
              Lista
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <TasksFiltersBar
            filters={filters}
            onChange={setFilters}
            resultCount={filteredTasks.length}
            showSort={view === "list"}
          />

          {view === "kanban" ? (
            <TasksKanban tasks={filteredTasks} />
          ) : (
            <TasksListTable tasks={filteredTasks} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
