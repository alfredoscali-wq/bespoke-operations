"use client"

import { Search, X } from "lucide-react"

import { useCustomers } from "@/components/clientes/customers-provider"
import {
  CUSTOMER_SORT_OPTIONS,
  CUSTOMER_STATUS_FILTER_OPTIONS,
  defaultCustomerFilters,
  formatCustomerResultCount,
  hasCustomerListFilters,
  type CustomerFilters,
} from "@/lib/customers/customer-filters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  QuickFilterBar,
  QuickFilterField,
} from "@/components/ui/quick-filter-bar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"

type CustomersFiltersProps = {
  filters: CustomerFilters
  onChange: (filters: CustomerFilters) => void
  resultCount: number
}

export { defaultCustomerFilters }

function normalizeOptionalLocality(value: string): string | undefined {
  return value === "all" ? undefined : value
}

export function CustomersFilters({
  filters,
  onChange,
  resultCount,
}: CustomersFiltersProps) {
  const { localityOptions } = useCustomers()
  const hasActiveFilters =
    filters.search.trim() !== "" ||
    Boolean(filters.locality) ||
    filters.statusFilter !== "all" ||
    filters.sort !== defaultCustomerFilters.sort

  function update<K extends keyof CustomerFilters>(
    key: K,
    value: CustomerFilters[K]
  ) {
    onChange({ ...filters, [key]: value })
  }

  function clearFilters() {
    onChange({
      ...defaultCustomerFilters,
      quickFilter: filters.quickFilter,
    })
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) => update("search", event.target.value)}
          placeholder="Buscar por nombre, N° cliente, DNI, teléfono, dirección, localidad o N° conexión"
          className="pl-9"
        />
      </div>

      <QuickFilterBar>
        <QuickFilterField label="📍 Localidad">
          <Select
            value={filters.locality ?? "all"}
            onValueChange={(value) =>
              update("locality", normalizeOptionalLocality(value))
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {localityOptions.map((locality) => (
                <SelectItem key={locality} value={locality}>
                  {locality}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </QuickFilterField>

        <QuickFilterField label="👤 Estado">
          <Select
            value={filters.statusFilter}
            onValueChange={(value) =>
              update(
                "statusFilter",
                value as CustomerFilters["statusFilter"]
              )
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_STATUS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </QuickFilterField>

        <QuickFilterField label="↕ Ordenar">
          <Select
            value={filters.sort}
            onValueChange={(value) =>
              update("sort", value as CustomerFilters["sort"])
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </QuickFilterField>

        {hasActiveFilters ? (
          <QuickFilterField label="Acciones" className="min-w-[120px] flex-none">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full gap-1.5"
              onClick={clearFilters}
            >
              <X className="size-3.5" />
              Limpiar
            </Button>
          </QuickFilterField>
        ) : null}
      </QuickFilterBar>

      <p className="text-xs text-muted-foreground">
        {formatCustomerResultCount(
          resultCount,
          hasCustomerListFilters(filters)
        )}
      </p>
    </div>
  )
}
