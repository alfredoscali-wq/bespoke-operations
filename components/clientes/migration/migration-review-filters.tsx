"use client"

import {
  MIGRATION_REVIEW_QUICK_FILTER_LABELS,
} from "@/lib/customers/commercial-migration/review-utils"
import type {
  MigrationReviewFilters,
  MigrationReviewQuickFilter,
} from "@/lib/customers/commercial-migration/review-types"
import { Input } from "@/components/ui/input"
import {
  QuickFilterBar,
  QuickFilterField,
} from "@/components/ui/quick-filter-bar"
import { cn } from "@/lib/utils"

type MigrationReviewFiltersBarProps = {
  filters: MigrationReviewFilters
  onChange: (filters: MigrationReviewFilters) => void
  resultCount: number
}

const QUICK_FILTERS: MigrationReviewQuickFilter[] = [
  "todos",
  "operativos",
  "activos",
  "revisar",
  "descartados",
  "duplicados",
  "sin-dni",
  "sin-direccion",
  "sin-localidad",
  "sin-telefono",
  "sin-email",
  "fibra",
  "wireless",
]

export function MigrationReviewFiltersBar({
  filters,
  onChange,
  resultCount,
}: MigrationReviewFiltersBarProps) {
  return (
    <div className="space-y-3">
      <QuickFilterBar>
        <QuickFilterField label="Buscar" className="min-w-[220px] flex-[2]">
          <Input
            value={filters.search}
            onChange={(event) =>
              onChange({ ...filters, search: event.target.value })
            }
            placeholder="Nombre, N° Cliente, DNI, dirección, localidad o N° conexión"
          />
        </QuickFilterField>
        <QuickFilterField label="Resultados" className="max-w-[120px] flex-none">
          <p className="flex h-9 items-center text-sm font-medium text-foreground">
            {resultCount}
          </p>
        </QuickFilterField>
      </QuickFilterBar>

      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((filter) => {
          const isActive = filters.quickFilter === filter
          return (
            <button
              key={filter}
              type="button"
              onClick={() => onChange({ ...filters, quickFilter: filter })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {MIGRATION_REVIEW_QUICK_FILTER_LABELS[filter]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
