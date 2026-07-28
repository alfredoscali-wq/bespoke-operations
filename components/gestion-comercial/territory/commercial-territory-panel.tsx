"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { resolveCommercialResponsibleColor } from "@/lib/commercial/responsible-colors"
import type {
  CommercialMapAssignmentFilter,
  CommercialMapOpportunity,
} from "@/lib/types/commercial"
import { cn } from "@/lib/utils"

export type CommercialTerritoryCardOpportunity = CommercialMapOpportunity & {
  /** Optional next-step label when available from existing list fields. */
  nextActionLabel?: string | null
}

export type CommercialTerritoryFilters = {
  search: string
  assignment: CommercialMapAssignmentFilter
  assignedEmployeeId: string
  status: string
  priority: string
  source: string
}

type EmployeeOption = { id: string; label: string }

export type CommercialTerritoryLocationScope = "all" | "without"

type CommercialTerritoryPanelProps = {
  filters: CommercialTerritoryFilters
  onFiltersChange: (next: CommercialTerritoryFilters) => void
  opportunities: CommercialTerritoryCardOpportunity[]
  /** Filtered geolocated total (independent of viewport). */
  totalGeolocatedFilteredCount: number
  /** Geolocated opportunities inside the current map viewport. */
  visibleCount: number
  geolocatedCount: number
  withoutLocationCount: number
  locationScope: CommercialTerritoryLocationScope
  onLocationScopeChange: (scope: CommercialTerritoryLocationScope) => void
  selectedId: string | null
  selectedIds: string[]
  employeeOptions: EmployeeOption[]
  employeeNameById: Record<string, string>
  isLoading?: boolean
  onSelect: (id: string) => void
  onToggleSelect: (id: string, checked: boolean) => void
  onToggleSelectAll: (checked: boolean) => void
  onAssignResponsible: () => void
  assignEmployeeId: string
  onAssignEmployeeIdChange: (value: string) => void
  isAssigning?: boolean
}

function formatActivityAge(iso: string): string {
  const timestamp = new Date(iso).getTime()
  if (!Number.isFinite(timestamp)) return "—"
  const deltaMs = Date.now() - timestamp
  if (deltaMs < 0) return "hace un momento"
  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 1) return "hace un momento"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days} d`
  const months = Math.floor(days / 30)
  if (months < 12) return `hace ${months} mes${months === 1 ? "" : "es"}`
  const years = Math.floor(days / 365)
  return `hace ${years} año${years === 1 ? "" : "s"}`
}

export function CommercialTerritoryPanel({
  filters,
  onFiltersChange,
  opportunities,
  totalGeolocatedFilteredCount,
  visibleCount,
  geolocatedCount,
  withoutLocationCount,
  locationScope,
  onLocationScopeChange,
  selectedId,
  selectedIds,
  employeeOptions,
  employeeNameById,
  isLoading = false,
  onSelect,
  onToggleSelect,
  onToggleSelectAll,
  onAssignResponsible,
  assignEmployeeId,
  onAssignEmployeeIdChange,
  isAssigning = false,
}: CommercialTerritoryPanelProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const itemRefs = useRef(new Map<string, HTMLLIElement>())

  const allSelected =
    opportunities.length > 0 &&
    opportunities.every((entry) => selectedIds.includes(entry.id))

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
      <div className="grid shrink-0 grid-cols-2 gap-2 rounded-md border px-3 py-2 text-xs">
        <button
          type="button"
          className={cn(
            "rounded-md px-2 py-1.5 text-left transition-colors",
            locationScope === "all" ? "bg-muted" : "hover:bg-muted/60"
          )}
          onClick={() => onLocationScopeChange("all")}
        >
          <p className="text-muted-foreground">Geolocalizadas</p>
          <p className="text-sm font-semibold tabular-nums">{geolocatedCount}</p>
        </button>
        <button
          type="button"
          className={cn(
            "rounded-md px-2 py-1.5 text-left transition-colors",
            locationScope === "without" ? "bg-muted" : "hover:bg-muted/60"
          )}
          onClick={() => onLocationScopeChange("without")}
        >
          <p className="text-muted-foreground">Sin ubicación</p>
          <p className="text-sm font-semibold tabular-nums">
            {withoutLocationCount}
          </p>
        </button>
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

      {locationScope === "all" ? (
        <div className="shrink-0 space-y-0.5 px-0.5">
          <p className="text-sm font-medium tabular-nums">
            {isLoading
              ? "Cargando…"
              : `${totalGeolocatedFilteredCount} oportunidad${
                  totalGeolocatedFilteredCount === 1 ? "" : "es"
                }`}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {visibleCount} visible{visibleCount === 1 ? "" : "s"} en el mapa
          </p>
        </div>
      ) : (
        <p className="shrink-0 px-0.5 text-xs text-muted-foreground">
          {isLoading
            ? "Cargando…"
            : `${opportunities.length} oportunidad${
                opportunities.length === 1 ? "" : "es"
              } sin ubicación`}
        </p>
      )}

      <div className="flex shrink-0 items-center justify-end gap-2">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(value) => onToggleSelectAll(Boolean(value))}
          aria-label="Seleccionar todas"
        />
        <span className="text-xs text-muted-foreground">Selección</span>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex shrink-0 flex-col gap-2 rounded-md border p-2">
          <p className="text-xs text-muted-foreground">
            {selectedIds.length} seleccionada
            {selectedIds.length === 1 ? "" : "s"}
          </p>
          <Select
            value={assignEmployeeId || undefined}
            onValueChange={onAssignEmployeeIdChange}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Asignar responsable" />
            </SelectTrigger>
            <SelectContent>
              {employeeOptions.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            disabled={!assignEmployeeId || isAssigning}
            onClick={onAssignResponsible}
          >
            {isAssigning ? "Asignando…" : "Asignar Responsable"}
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-md border">
        {opportunities.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            {locationScope === "without"
              ? "No hay oportunidades pendientes de geolocalizar."
              : "No hay oportunidades geolocalizadas en el área visible."}
          </p>
        ) : (
          <ul className="divide-y">
            {opportunities.map((opportunity) => {
              const checked = selectedIds.includes(opportunity.id)
              const active = selectedId === opportunity.id
              const responsibleColor = resolveCommercialResponsibleColor(
                opportunity.assignedEmployeeId
              )
              const responsibleLabel = opportunity.assignedEmployeeId
                ? employeeNameById[opportunity.assignedEmployeeId] ||
                  "Responsable"
                : "Sin responsable"
              const companyLabel =
                opportunity.companyName.trim() ||
                opportunity.personName.trim() ||
                "—"

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
                  <div
                    className={cn(
                      "flex items-start gap-2 border-l-[3px] px-2 py-2.5 transition-colors",
                      active && "bg-muted/70"
                    )}
                    style={{ borderLeftColor: responsibleColor.hex }}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        onToggleSelect(opportunity.id, Boolean(value))
                      }
                      aria-label={`Seleccionar ${opportunity.code}`}
                      className="mt-1"
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onSelect(opportunity.id)}
                    >
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {opportunity.code}
                      </p>
                      <p className="truncate text-sm font-medium leading-snug">
                        {opportunity.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {companyLabel}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground"
                          style={{ backgroundColor: responsibleColor.soft }}
                        >
                          <span
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: responsibleColor.hex }}
                            aria-hidden
                          />
                          {responsibleLabel}
                        </span>
                        <span>
                          {COMMERCIAL_STATUS_LABELS[opportunity.status]}
                        </span>
                        <span>·</span>
                        <span>
                          {COMMERCIAL_PRIORITY_LABELS[opportunity.priority]}
                        </span>
                      </div>
                      {opportunity.nextActionLabel ? (
                        <p className="mt-1 truncate text-[11px] text-foreground/80">
                          Próxima: {opportunity.nextActionLabel}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Actividad {formatActivityAge(opportunity.updatedAt)}
                      </p>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
