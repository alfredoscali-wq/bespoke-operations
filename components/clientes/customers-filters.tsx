"use client"

import { Search, X } from "lucide-react"

import {
  defaultCustomerFilters,
  type CustomerFilters,
  type CustomerStatusFilter,
  type CustomerTechnologyFilter,
} from "@/lib/customers/customer-filters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type CustomersFiltersProps = {
  filters: CustomerFilters
  onChange: (filters: CustomerFilters) => void
  resultCount: number
}

export { defaultCustomerFilters }

export function CustomersFilters({
  filters,
  onChange,
  resultCount,
}: CustomersFiltersProps) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.technology !== "all"

  function update<K extends keyof CustomerFilters>(
    key: K,
    value: CustomerFilters[K]
  ) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder="Buscar por número, código externo, nombre, teléfono o dirección"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select
            value={filters.status}
            onValueChange={(value) =>
              update("status", value as CustomerStatusFilter)
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.technology}
            onValueChange={(value) =>
              update("technology", value as CustomerTechnologyFilter)
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tecnología" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="fiber">Fibra</SelectItem>
              <SelectItem value="wireless">Wireless</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => onChange(defaultCustomerFilters)}
            >
              <X className="size-4" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {resultCount}{" "}
        {resultCount === 1 ? "cliente encontrado" : "clientes encontrados"}
      </p>
    </div>
  )
}
