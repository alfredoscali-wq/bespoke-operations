"use client"

import { Search } from "lucide-react"

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
  COMMERCIAL_SOURCE_CODES,
  COMMERCIAL_SOURCE_LABELS,
  COMMERCIAL_STATUS_CODES,
  COMMERCIAL_STATUS_LABELS,
} from "@/lib/commercial/catalogs"
import type {
  CommercialMapAssignmentFilter,
  CommercialMapOpportunity,
} from "@/lib/types/commercial"
import { cn } from "@/lib/utils"

export type CommercialTerritoryFilters = {
  search: string
  assignment: CommercialMapAssignmentFilter
  assignedEmployeeId: string
  status: string
  priority: string
  source: string
}

type EmployeeOption = { id: string; label: string }

type CommercialTerritoryPanelProps = {
  filters: CommercialTerritoryFilters
  onFiltersChange: (next: CommercialTerritoryFilters) => void
  opportunities: CommercialMapOpportunity[]
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

export function CommercialTerritoryPanel({
  filters,
  onFiltersChange,
  opportunities,
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
  const allSelected =
    opportunities.length > 0 &&
    opportunities.every((entry) => selectedIds.includes(entry.id))

  function patch(partial: Partial<CommercialTerritoryFilters>) {
    onFiltersChange({ ...filters, ...partial })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) => patch({ search: event.target.value })}
            placeholder="Código, nombre, empresa, teléfono"
            className="pl-8"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Asignación</Label>
            <Select
              value={filters.assignment}
              onValueChange={(value) =>
                patch({ assignment: value as CommercialMapAssignmentFilter })
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
            <Label className="text-xs">Origen</Label>
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
                {COMMERCIAL_SOURCE_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {COMMERCIAL_SOURCE_LABELS[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {isLoading
            ? "Cargando…"
            : `${opportunities.length} oportunidad${opportunities.length === 1 ? "" : "es"}`}
        </p>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(value) => onToggleSelectAll(Boolean(value))}
            aria-label="Seleccionar todas"
          />
          <span className="text-xs text-muted-foreground">Selección</span>
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-md border p-2">
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

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
        {opportunities.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            No hay oportunidades geolocalizadas en el área visible.
          </p>
        ) : (
          <ul className="divide-y">
            {opportunities.map((opportunity) => {
              const checked = selectedIds.includes(opportunity.id)
              const active = selectedId === opportunity.id
              return (
                <li key={opportunity.id}>
                  <div
                    className={cn(
                      "flex items-start gap-2 px-2 py-2",
                      active && "bg-muted/70"
                    )}
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
                      <p className="truncate text-sm font-medium">
                        {opportunity.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {opportunity.personName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {COMMERCIAL_STATUS_LABELS[opportunity.status]} ·{" "}
                        {opportunity.assignedEmployeeId
                          ? employeeNameById[opportunity.assignedEmployeeId] ||
                            "Asignada"
                          : "Sin asignar"}
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
