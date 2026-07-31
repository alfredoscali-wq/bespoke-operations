"use client"

import {
  ACTIVITY_EVENT_ACTIONS,
  ACTIVITY_EVENT_TITLES,
} from "@/lib/activity/actions"
import {
  ACTIVITY_TIMELINE_ENTITY_TYPE_OPTIONS,
  ACTIVITY_TIMELINE_MODULE_OPTIONS,
  type ActivityTimelineVisibleFilters,
} from "@/lib/activity/activity-timeline-types"
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
import { FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"
import type { Employee } from "@/lib/types/employees"

export const ACTIVITY_TIMELINE_ALL_VALUE = "__all__"

export type ActivityTimelineDraftFilters = {
  employeeId: string
  module: string
  entityType: string
  action: string
  dateFrom: string
  dateTo: string
  search: string
}

export const EMPTY_ACTIVITY_TIMELINE_DRAFT: ActivityTimelineDraftFilters = {
  employeeId: "",
  module: "",
  entityType: "",
  action: "",
  dateFrom: "",
  dateTo: "",
  search: "",
}

const ACTION_OPTIONS = Object.values(ACTIVITY_EVENT_ACTIONS)
  .slice()
  .sort((a, b) => a.localeCompare(b, "es"))
  .map((value) => ({
    value,
    label: ACTIVITY_EVENT_TITLES[value] ?? value,
  }))

function employeeLabel(employee: Employee): string {
  const name = [employee.firstName, employee.lastName]
    .filter(Boolean)
    .join(" ")
    .trim()
  return name || employee.employeeCode || employee.id
}

type ActivityTimelineFiltersPanelProps = {
  draft: ActivityTimelineDraftFilters
  onChange: (next: ActivityTimelineDraftFilters) => void
  onClear: () => void
  visibleFilters: ActivityTimelineVisibleFilters
  companyLabel?: string
  employees?: Employee[]
  isLoading?: boolean
  layout?: "sidebar" | "inline"
  totalLabel?: string
}

export function ActivityTimelineFiltersPanel({
  draft,
  onChange,
  onClear,
  visibleFilters,
  companyLabel,
  employees = [],
  isLoading = false,
  layout = "sidebar",
  totalLabel,
}: ActivityTimelineFiltersPanelProps) {
  const patch = (partial: Partial<ActivityTimelineDraftFilters>) =>
    onChange({ ...draft, ...partial })

  const fields = (
    <>
      {visibleFilters.company ? (
        <div className="space-y-2">
          <Label htmlFor="timeline-company">Empresa</Label>
          <Input
            id="timeline-company"
            value={companyLabel ?? ""}
            disabled
            className="h-9 bg-muted/40"
          />
        </div>
      ) : null}

      {visibleFilters.employee ? (
        <div className="space-y-2">
          <Label>Empleado</Label>
          <Select
            value={draft.employeeId || ACTIVITY_TIMELINE_ALL_VALUE}
            onValueChange={(value) =>
              patch({
                employeeId:
                  value === ACTIVITY_TIMELINE_ALL_VALUE ? "" : value,
              })
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ACTIVITY_TIMELINE_ALL_VALUE}>Todos</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employeeLabel(employee)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {visibleFilters.module ? (
        <div className="space-y-2">
          <Label>Módulo</Label>
          <Select
            value={draft.module || ACTIVITY_TIMELINE_ALL_VALUE}
            onValueChange={(value) =>
              patch({
                module: value === ACTIVITY_TIMELINE_ALL_VALUE ? "" : value,
              })
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ACTIVITY_TIMELINE_ALL_VALUE}>Todos</SelectItem>
              {ACTIVITY_TIMELINE_MODULE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {visibleFilters.entityType ? (
        <div className="space-y-2">
          <Label>Tipo de entidad</Label>
          <Select
            value={draft.entityType || ACTIVITY_TIMELINE_ALL_VALUE}
            onValueChange={(value) =>
              patch({
                entityType:
                  value === ACTIVITY_TIMELINE_ALL_VALUE ? "" : value,
              })
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ACTIVITY_TIMELINE_ALL_VALUE}>Todos</SelectItem>
              {ACTIVITY_TIMELINE_ENTITY_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {visibleFilters.action ? (
        <div className="space-y-2">
          <Label>Acción</Label>
          <Select
            value={draft.action || ACTIVITY_TIMELINE_ALL_VALUE}
            onValueChange={(value) =>
              patch({
                action: value === ACTIVITY_TIMELINE_ALL_VALUE ? "" : value,
              })
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ACTIVITY_TIMELINE_ALL_VALUE}>Todas</SelectItem>
              {ACTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {visibleFilters.dateFrom ? (
        <div className="space-y-2">
          <Label htmlFor="timeline-from">Desde</Label>
          <Input
            id="timeline-from"
            type="date"
            className="h-9 bg-background"
            value={draft.dateFrom}
            onChange={(event) => patch({ dateFrom: event.target.value })}
          />
        </div>
      ) : null}

      {visibleFilters.dateTo ? (
        <div className="space-y-2">
          <Label htmlFor="timeline-to">Hasta</Label>
          <Input
            id="timeline-to"
            type="date"
            className="h-9 bg-background"
            value={draft.dateTo}
            onChange={(event) => patch({ dateTo: event.target.value })}
          />
        </div>
      ) : null}

      {visibleFilters.search ? (
        <div className="space-y-2">
          <Label htmlFor="timeline-search">Buscador</Label>
          <Input
            id="timeline-search"
            className="h-9 bg-background"
            placeholder="Título, descripción, acción…"
            value={draft.search}
            onChange={(event) => patch({ search: event.target.value })}
          />
        </div>
      ) : null}
    </>
  )

  if (layout === "inline") {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Filtros</h2>
            {totalLabel ? (
              <p className="text-xs text-muted-foreground">{totalLabel}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClear}
            disabled={isLoading}
          >
            Limpiar
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {fields}
        </div>
      </div>
    )
  }

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Filtros</h2>
        {totalLabel ? (
          <p className="text-xs text-muted-foreground">{totalLabel}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">{fields}</div>
      <div className="border-t p-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onClear}
          disabled={isLoading}
        >
          Limpiar filtros
        </Button>
      </div>
    </aside>
  )
}
