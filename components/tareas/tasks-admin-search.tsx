"use client"

import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { FILTER_SEARCH_INPUT_CLASS } from "@/lib/ui/visual-tokens"

type TasksAdminSearchProps = {
  value: string
  onChange: (value: string) => void
  totalCount: number
  resultCount: number
  hasActiveFilter: boolean
}

function formatWorkOrderCountLabel(count: number, hasActiveFilter: boolean): string {
  if (hasActiveFilter) {
    if (count === 1) {
      return "1 Orden encontrada"
    }

    return `${count} Órdenes encontradas`
  }

  if (count === 1) {
    return "1 Orden de Trabajo"
  }

  return `${count} Órdenes de Trabajo`
}

export function TasksAdminSearch({
  value,
  onChange,
  totalCount,
  resultCount,
  hasActiveFilter,
}: TasksAdminSearchProps) {
  const count = hasActiveFilter ? resultCount : totalCount

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Buscar por cliente, código, dirección o teléfono..."
          className={FILTER_SEARCH_INPUT_CLASS}
          aria-label="Buscar órdenes de trabajo"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {formatWorkOrderCountLabel(count, hasActiveFilter)}
      </p>
    </div>
  )
}
