"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Search } from "lucide-react"

import { CommercialEtiquetaBadge } from "@/components/gestion-comercial/commercial-etiqueta-badge"
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
import {
  COMMERCIAL_PRIORITY_CODES,
  COMMERCIAL_PRIORITY_LABELS,
  COMMERCIAL_SOURCE_FIELD_LABEL,
  COMMERCIAL_SOURCE_LABELS,
  COMMERCIAL_SOURCE_SELECT_CODES,
  COMMERCIAL_STATUS_CODES,
  COMMERCIAL_STATUS_LABELS,
} from "@/lib/commercial/catalogs"
import { resolveCommercialEtiquetaMapColor } from "@/lib/commercial/map-layers"
import type {
  CommercialMapAssignmentFilter,
  CommercialMapOpportunity,
} from "@/lib/types/commercial"
import { cn } from "@/lib/utils"

export type CommercialTerritoryCardOpportunity = CommercialMapOpportunity & {
  phone: string
}

export type CommercialTerritoryFilters = {
  search: string
  assignment: CommercialMapAssignmentFilter
  assignedEmployeeId: string
  status: string
  priority: string
  source: string
  /** Empty = all etiquetas. When set, only matching etiqueta ids. */
  etiquetaIds: string[]
}

type EmployeeOption = { id: string; label: string }

export type CommercialTerritoryLocationScope = "all" | "without"

type CommercialTerritoryPanelProps = {
  filters: CommercialTerritoryFilters
  onFiltersChange: (next: CommercialTerritoryFilters) => void
  opportunities: CommercialTerritoryCardOpportunity[]
  totalCount: number
  /** Geolocated opportunities inside the current map viewport. */
  visibleCount: number
  geolocatedCount: number
  withoutLocationCount: number
  locationScope: CommercialTerritoryLocationScope
  onLocationScopeChange: (scope: CommercialTerritoryLocationScope) => void
  selectedId: string | null
  employeeOptions: EmployeeOption[]
  isLoading?: boolean
  onSelect: (id: string) => void
}

export function CommercialTerritoryPanel({
  filters,
  onFiltersChange,
  opportunities,
  totalCount,
  visibleCount,
  geolocatedCount,
  withoutLocationCount,
  locationScope,
  onLocationScopeChange,
  selectedId,
  employeeOptions,
  isLoading = false,
  onSelect,
}: CommercialTerritoryPanelProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const itemRefs = useRef(new Map<string, HTMLLIElement>())

  function patch(partial: Partial<CommercialTerritoryFilters>) {
    onFiltersChange({ ...filters, ...partial })
  }

  useEffect(() => {
    if (!selectedId) return
    const node = itemRefs.current.get(selectedId)
    if (!node) return
    node.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [selectedId])

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="grid shrink-0 grid-cols-3 divide-x rounded-md border px-1 py-1.5 text-center">
        <div className="px-1">
          <p className="text-[10px] text-muted-foreground">Clientes</p>
          <p className="text-sm font-semibold tabular-nums">{totalCount}</p>
        </div>
        <button
          type="button"
          className={cn(
            "px-1 transition-colors hover:bg-muted/60",
            locationScope === "all" && "bg-muted/60"
          )}
          onClick={() => onLocationScopeChange("all")}
        >
          <p className="text-[10px] text-muted-foreground">Geolocalizados</p>
          <p className="text-sm font-semibold tabular-nums">{geolocatedCount}</p>
        </button>
        <div className="px-1">
          <p className="text-[10px] text-muted-foreground">Visibles</p>
          <p className="text-sm font-semibold tabular-nums">{visibleCount}</p>
        </div>
      </div>

      <div className="shrink-0 rounded-md border">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
        >
          <span>Filtros</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              filtersOpen ? "rotate-0" : "-rotate-90"
            )}
          />
        </button>

        {filtersOpen ? (
          <div className="space-y-2 border-t px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(event) => patch({ search: event.target.value })}
                placeholder="Código, nombre, empresa, teléfono"
                className="h-8 pl-8"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={locationScope === "all" ? "secondary" : "outline"}
                className="h-7 text-xs"
                onClick={() => onLocationScopeChange("all")}
              >
                En mapa
              </Button>
              <Button
                type="button"
                size="sm"
                variant={locationScope === "without" ? "secondary" : "outline"}
                className="h-7 text-xs"
                onClick={() => onLocationScopeChange("without")}
              >
                Sin ubicación ({withoutLocationCount})
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Asignación</Label>
                <Select
                  value={filters.assignment}
                  onValueChange={(value) =>
                    patch({
                      assignment: value as CommercialMapAssignmentFilter,
                    })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="assigned">Solo asignadas</SelectItem>
                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Responsable</Label>
                <Select
                  value={filters.assignedEmployeeId || "all"}
                  onValueChange={(value) =>
                    patch({
                      assignedEmployeeId: value === "all" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {employeeOptions.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(value) =>
                    patch({ status: value === "all" ? "" : value })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {COMMERCIAL_STATUS_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {COMMERCIAL_STATUS_LABELS[code]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Prioridad</Label>
                <Select
                  value={filters.priority || "all"}
                  onValueChange={(value) =>
                    patch({ priority: value === "all" ? "" : value })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {COMMERCIAL_PRIORITY_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {COMMERCIAL_PRIORITY_LABELS[code]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-xs">{COMMERCIAL_SOURCE_FIELD_LABEL}</Label>
                <Select
                  value={filters.source || "all"}
                  onValueChange={(value) =>
                    patch({ source: value === "all" ? "" : value })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {COMMERCIAL_SOURCE_SELECT_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {COMMERCIAL_SOURCE_LABELS[code]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <p className="shrink-0 px-0.5 text-xs text-muted-foreground">
          Cargando clientes…
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-md border">
        {opportunities.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            {locationScope === "without"
              ? "No hay clientes pendientes de geolocalizar."
              : "No hay clientes geolocalizados en el área visible."}
          </p>
        ) : (
          <ul className="divide-y">
            {opportunities.map((opportunity) => {
              const active = selectedId === opportunity.id
              const etiquetaColor = resolveCommercialEtiquetaMapColor(
                opportunity.etiquetaColor
              )
              const clientLabel =
                opportunity.personName.trim() || "Cliente"

              return (
                <li
                  key={opportunity.id}
                  ref={(node) => {
                    if (node) {
                      itemRefs.current.set(opportunity.id, node)
                    } else {
                      itemRefs.current.delete(opportunity.id)
                    }
                  }}
                >
                  <button
                    type="button"
                    className={cn(
                      "block w-full border-l-[3px] px-2.5 py-2 text-left transition-colors hover:bg-muted/40",
                      active && "bg-muted/70"
                    )}
                    style={{ borderLeftColor: etiquetaColor }}
                    onClick={() => onSelect(opportunity.id)}
                  >
                    <CommercialEtiquetaBadge
                      name={opportunity.etiquetaName}
                      color={opportunity.etiquetaColor}
                      className="mb-1 text-[10px]"
                    />
                    <p className="truncate text-sm font-medium leading-tight">
                      {clientLabel}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
                      {opportunity.phone || "—"}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
