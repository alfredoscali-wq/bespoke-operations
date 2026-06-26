"use client"

import {
  AUDIT_ACTION_LABELS,
  AUDIT_MODULE_LABELS,
  AUDIT_SEVERITY_LABELS,
} from "@/lib/audit/audit-labels"
import type { HistorialUrlState } from "@/lib/audit/historial-query"
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

type AuditLogFiltersProps = {
  filters: HistorialUrlState
  onChange: (next: HistorialUrlState) => void
  onReset: () => void
}

export function AuditLogFilters({
  filters,
  onChange,
  onReset,
}: AuditLogFiltersProps) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Filtros</h2>
          <p className="text-xs text-muted-foreground">
            Combine criterios para acotar la bitácora operativa.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          Limpiar filtros
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="audit-from">Desde</Label>
          <Input
            id="audit-from"
            type="date"
            className="h-9 bg-background"
            value={filters.from?.slice(0, 10) ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                from: event.target.value
                  ? new Date(`${event.target.value}T00:00:00`).toISOString()
                  : undefined,
                page: 1,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-to">Hasta</Label>
          <Input
            id="audit-to"
            type="date"
            className="h-9 bg-background"
            value={filters.to?.slice(0, 10) ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                to: event.target.value
                  ? new Date(`${event.target.value}T23:59:59`).toISOString()
                  : undefined,
                page: 1,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-user">Usuario</Label>
          <Input
            id="audit-user"
            className="h-9 bg-background"
            placeholder="Nombre o ID de usuario"
            value={filters.search ?? ""}
            onChange={(event) =>
              onChange({ ...filters, search: event.target.value, page: 1 })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Módulo</Label>
          <Select
            value={filters.module ?? "all"}
            onValueChange={(value) =>
              onChange({
                ...filters,
                module: value === "all" ? undefined : (value as HistorialUrlState["module"]),
                page: 1,
              })
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(AUDIT_MODULE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
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
                page: 1,
              })
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Estado / severidad</Label>
          <Select
            value={filters.severity ?? "all"}
            onValueChange={(value) =>
              onChange({
                ...filters,
                severity:
                  value === "all"
                    ? undefined
                    : (value as HistorialUrlState["severity"]),
                page: 1,
              })
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(AUDIT_SEVERITY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-entity">Entidad</Label>
          <Input
            id="audit-entity"
            className="h-9 bg-background"
            placeholder="Etiqueta de entidad"
            value={filters.entityLabel ?? ""}
            onChange={(event) =>
              onChange({ ...filters, entityLabel: event.target.value, page: 1 })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-ot">Código OT</Label>
          <Input
            id="audit-ot"
            className="h-9 bg-background"
            placeholder="TSK-OT-001"
            value={filters.otCode ?? ""}
            onChange={(event) =>
              onChange({ ...filters, otCode: event.target.value, page: 1 })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-cliente">Cliente</Label>
          <Input
            id="audit-cliente"
            className="h-9 bg-background"
            placeholder="Nombre de cliente"
            value={filters.customerQuery ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                customerQuery: event.target.value,
                page: 1,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-obra">Obra</Label>
          <Input
            id="audit-obra"
            className="h-9 bg-background"
            placeholder="Código o nombre de obra"
            value={filters.projectQuery ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                projectQuery: event.target.value,
                page: 1,
              })
            }
          />
        </div>
      </div>
    </div>
  )
}
