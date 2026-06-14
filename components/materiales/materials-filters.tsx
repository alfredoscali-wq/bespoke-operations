"use client"

import { Search, X } from "lucide-react"

import {
  MATERIAL_CATEGORY_OPTIONS,
  MATERIAL_STATUS_OPTIONS,
} from "@/lib/materials/constants"
import type { MaterialFilters } from "@/lib/types/materials"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type MaterialsFiltersBarProps = {
  filters: MaterialFilters
  onChange: (filters: MaterialFilters) => void
  resultCount: number
  warehouses: string[]
}

export function MaterialsFiltersBar({
  filters,
  onChange,
  resultCount,
  warehouses,
}: MaterialsFiltersBarProps) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.category !== "all" ||
    filters.status !== "all" ||
    filters.warehouse !== "all"

  function update<K extends keyof MaterialFilters>(
    key: K,
    value: MaterialFilters[K]
  ) {
    onChange({ ...filters, [key]: value })
  }

  function clearFilters() {
    onChange({
      search: "",
      category: "all",
      status: "all",
      warehouse: "all",
    })
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) => update("search", event.target.value)}
          placeholder="Buscar por código, material o fabricante..."
          className="h-9 bg-background pl-8"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          value={filters.category}
          onValueChange={(value) =>
            update("category", value as MaterialFilters["category"])
          }
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {MATERIAL_CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) =>
            update("status", value as MaterialFilters["status"])
          }
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {MATERIAL_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.warehouse}
          onValueChange={(value) => update("warehouse", value)}
        >
          <SelectTrigger className="h-9 w-full bg-background">
            <SelectValue placeholder="Almacén" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los almacenes</SelectItem>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse} value={warehouse}>
                {warehouse}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {resultCount}{" "}
          {resultCount === 1 ? "material encontrado" : "materiales encontrados"}
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
