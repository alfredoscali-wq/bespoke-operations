"use client"

import {
  listActivityViewerActions,
  listActivityViewerAreas,
  listActivityViewerModules,
  listActivityViewerOrigins,
} from "@/lib/activity/activity-viewer-labels"
import type { ActivityViewerUrlState } from "@/lib/activity/activity-viewer-query"
import { FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"
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

type ActivityViewerFiltersProps = {
  filters: ActivityViewerUrlState
  onChange: (next: ActivityViewerUrlState) => void
  onReset: () => void
}

export function ActivityViewerFilters({
  filters,
  onChange,
  onReset,
}: ActivityViewerFiltersProps) {
  const modules = listActivityViewerModules()
  const origins = listActivityViewerOrigins()
  const areas = listActivityViewerAreas()
  const actions = listActivityViewerActions()

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Filtros</h2>
          <p className="text-xs text-muted-foreground">
            Combine criterios para validar eventos de Activity Engine.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          Limpiar filtros
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="activity-from">Fecha desde</Label>
          <Input
            id="activity-from"
            type="date"
            className="h-9 bg-background"
            value={filters.from?.slice(0, 10) ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                from: event.target.value
                  ? new Date(`${event.target.value}T00:00:00`).toISOString()
                  : undefined,
                offset: 0,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="activity-to">Fecha hasta</Label>
          <Input
            id="activity-to"
            type="date"
            className="h-9 bg-background"
            value={filters.to?.slice(0, 10) ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                to: event.target.value
                  ? new Date(`${event.target.value}T23:59:59`).toISOString()
                  : undefined,
                offset: 0,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="activity-user">Usuario</Label>
          <Input
            id="activity-user"
            className="h-9 bg-background"
            placeholder="Nombre o ID de empleado"
            value={filters.userSearch ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                userSearch: event.target.value || undefined,
                offset: 0,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Área</Label>
          <Select
            value={filters.area ?? "all"}
            onValueChange={(value) =>
              onChange({
                ...filters,
                area: value === "all" ? undefined : (value as typeof filters.area),
                offset: 0,
              })
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {areas.map((area) => (
                <SelectItem key={area.value} value={area.value}>
                  {area.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Módulo</Label>
          <Select
            value={filters.module ?? "all"}
            onValueChange={(value) =>
              onChange({
                ...filters,
                module:
                  value === "all" ? undefined : (value as typeof filters.module),
                offset: 0,
              })
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {modules.map((module) => (
                <SelectItem key={module.value} value={module.value}>
                  {module.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Acción</Label>
          <Select
            value={filters.action ?? "all"}
            onValueChange={(value) =>
              onChange({
                ...filters,
                action: value === "all" ? undefined : value,
                offset: 0,
              })
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {actions.map((action) => (
                <SelectItem key={action.value} value={action.value}>
                  {action.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Origen</Label>
          <Select
            value={filters.origin ?? "all"}
            onValueChange={(value) =>
              onChange({
                ...filters,
                origin:
                  value === "all" ? undefined : (value as typeof filters.origin),
                offset: 0,
              })
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {origins.map((origin) => (
                <SelectItem key={origin.value} value={origin.value}>
                  {origin.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
