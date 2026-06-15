"use client"

import { Search, X } from "lucide-react"

import {
  EVIDENCE_CATEGORY_OPTIONS,
  EVIDENCE_CREWS,
  EVIDENCE_FILE_TYPE_OPTIONS,
  EVIDENCE_WORKERS,
} from "@/lib/evidence/constants"
import type { EvidenceFilters } from "@/lib/types/evidence"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type EvidenceFiltersBarProps = {
  filters: EvidenceFilters
  onChange: (filters: EvidenceFilters) => void
  resultCount: number
  projects: { id: string; code: string; name: string }[]
  tasks: { id: string; code: string; title: string }[]
}

export function EvidenceFiltersBar({
  filters,
  onChange,
  resultCount,
  projects,
  tasks,
}: EvidenceFiltersBarProps) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.projectId !== "all" ||
    filters.taskId !== "all" ||
    filters.crew !== "all" ||
    filters.worker !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.fileType !== "all" ||
    filters.evidenceType !== "all" ||
    filters.includeVoided

  function update<K extends keyof EvidenceFilters>(
    key: K,
    value: EvidenceFilters[K]
  ) {
    onChange({ ...filters, [key]: value })
  }

  function clearFilters() {
    onChange({
      search: "",
      projectId: "all",
      taskId: "all",
      crew: "all",
      worker: "all",
      dateFrom: "",
      dateTo: "",
      fileType: "all",
      evidenceType: "all",
      includeVoided: false,
    })
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) => update("search", event.target.value)}
          placeholder="Buscar por archivo, proyecto, tarea u operario..."
          className="h-9 bg-background pl-8"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Select
          value={filters.projectId}
          onValueChange={(value) => update("projectId", value)}
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Proyecto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {projects
              .filter((project) => project.id !== "")
              .map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.taskId}
          onValueChange={(value) => update("taskId", value)}
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Tarea" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las tareas</SelectItem>
            {tasks
              .filter((task) => task.id !== "")
              .map((task) => (
              <SelectItem key={task.id} value={task.id}>
                {task.code}
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
            <SelectItem value="all">Todas las cuadrillas</SelectItem>
            {EVIDENCE_CREWS.map((crew) => (
              <SelectItem key={crew} value={crew}>
                {crew}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.worker}
          onValueChange={(value) => update("worker", value)}
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Operario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los operarios</SelectItem>
            {EVIDENCE_WORKERS.map((worker) => (
              <SelectItem key={worker} value={worker}>
                {worker}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.fileType}
          onValueChange={(value) =>
            update("fileType", value as EvidenceFilters["fileType"])
          }
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Tipo de archivo" />
          </SelectTrigger>
          <SelectContent>
            {EVIDENCE_FILE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.evidenceType}
          onValueChange={(value) =>
            update("evidenceType", value as EvidenceFilters["evidenceType"])
          }
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Tipo de evidencia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos de evidencia</SelectItem>
            {EVIDENCE_CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Desde</Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => update("dateFrom", event.target.value)}
              className="h-9 bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Hasta</Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(event) => update("dateTo", event.target.value)}
              className="h-9 bg-background"
            />
          </div>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={filters.includeVoided}
          onChange={(event) => update("includeVoided", event.target.checked)}
          className="size-4 rounded border border-input accent-primary"
        />
        Mostrar evidencias anuladas
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {resultCount}{" "}
          {resultCount === 1 ? "evidencia encontrada" : "evidencias encontradas"}
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
