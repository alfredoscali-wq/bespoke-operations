"use client"

import { Search, X } from "lucide-react"

import { CREW_STATUS_OPTIONS } from "@/lib/crews/constants"
import type { CrewFilters } from "@/lib/types/crews"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type CrewsFiltersBarProps = {
  filters: CrewFilters
  onChange: (filters: CrewFilters) => void
  resultCount: number
  specialties: string[]
}

export function CrewsFiltersBar({
  filters,
  onChange,
  resultCount,
  specialties,
}: CrewsFiltersBarProps) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.specialty !== "all"

  function update<K extends keyof CrewFilters>(key: K, value: CrewFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  function clearFilters() {
    onChange({
      search: "",
      status: "all",
      specialty: "all",
    })
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) => update("search", event.target.value)}
          placeholder="Buscar por cuadrilla, especialidad, supervisor o integrante..."
          className="h-9 bg-background pl-8"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          value={filters.status}
          onValueChange={(value) =>
            update("status", value as CrewFilters["status"])
          }
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {CREW_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.specialty}
          onValueChange={(value) => update("specialty", value)}
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Especialidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las especialidades</SelectItem>
            {specialties.map((specialty) => (
              <SelectItem key={specialty} value={specialty}>
                {specialty}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {resultCount}{" "}
          {resultCount === 1 ? "cuadrilla encontrada" : "cuadrillas encontradas"}
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
