"use client"

import { Search, X } from "lucide-react"

import {
  defaultCustomerFilters,
  type CustomerFilters,
} from "@/lib/customers/customer-filters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
  const hasActiveFilters = filters.search !== ""

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) =>
            onChange({ ...filters, search: event.target.value })
          }
          placeholder="Buscar por nombre, N° cliente, DNI, teléfono, dirección, localidad o N° conexión"
          className="pl-9"
        />
      </div>

      {hasActiveFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded-full px-3 text-xs"
          onClick={() => onChange(defaultCustomerFilters)}
        >
          <X className="size-3.5" />
          Limpiar búsqueda
        </Button>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {resultCount}{" "}
        {resultCount === 1 ? "cliente encontrado" : "clientes encontrados"}
      </p>
    </div>
  )
}
