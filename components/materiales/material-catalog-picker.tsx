"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import {
  filterCatalogOptions,
  type MaterialCatalogOption,
} from "@/lib/materials/catalog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type MaterialCatalogPickerProps = {
  options: MaterialCatalogOption[]
  value: string | null
  onChange: (materialId: string) => void
  disabled?: boolean
  lockedLabel?: string | null
}

export function MaterialCatalogPicker({
  options,
  value,
  onChange,
  disabled = false,
  lockedLabel,
}: MaterialCatalogPickerProps) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(
    () => filterCatalogOptions(options, search),
    [options, search]
  )

  const selected = options.find((option) => option.id === value)

  if (disabled && lockedLabel) {
    return (
      <div className="space-y-2">
        <Label>Material</Label>
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          {lockedLabel}
        </div>
        <p className="text-xs text-muted-foreground">
          Material seleccionado desde el inventario.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>Material</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, nombre o fabricante..."
          className="pl-9"
          disabled={disabled}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Seleccione un material del catálogo. No se puede crear uno nuevo desde
        aquí.
      </p>
      <div className="max-h-48 overflow-y-auto rounded-lg border">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            No hay materiales que coincidan con la búsqueda.
          </p>
        ) : (
          filtered.map((option) => {
            const isSelected = option.id === value
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(option.id)}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/50",
                  isSelected && "bg-primary/5"
                )}
              >
                <span className="font-mono text-xs text-primary">
                  {option.code}
                </span>
                <span className="font-medium">{option.name}</span>
                {option.manufacturer ? (
                  <span className="text-xs text-muted-foreground">
                    {option.manufacturer}
                  </span>
                ) : null}
              </button>
            )
          })
        )}
      </div>
      {selected ? (
        <p className="text-xs text-muted-foreground">
          Seleccionado: {selected.code} — {selected.name}
        </p>
      ) : null}
    </div>
  )
}
