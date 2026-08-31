"use client"

import { Search, X } from "lucide-react"

import { useSubscriptions } from "@/components/subscriptions/subscriptions-provider"
import { Badge } from "@/components/ui/badge"
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
import { ISP_COMMERCIAL_STATUSES } from "@/lib/isp/constants"
import { ISP_COMMERCIAL_STATUS_LABELS } from "@/lib/isp/labels"
import {
  commercialOptionsForPlan,
  hasTvDeskListFilters,
  type TvListStatusFilter,
  type TvSelectedCommercialFilter,
  type TvSelectedPlanFilter,
} from "@/lib/subscriptions/tv-plans"
import { FILTER_CLEAR_BUTTON_CLASS, FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"

export function TvSubscribersFilters() {
  const {
    plans,
    commercialOptions,
    selectedPlan,
    selectedCommercialId,
    statusFilter,
    search,
    setSelectedPlanFilter,
    setSelectedCommercialId,
    setStatusFilter,
    setSearch,
    clearFilters,
  } = useSubscriptions()

  const visibleCommercial = commercialOptionsForPlan(
    commercialOptions,
    selectedPlan
  )
  const selectedPlanName =
    selectedPlan === "all"
      ? null
      : plans.find((plan) => plan.id === selectedPlan)?.name ?? null
  const selectedCommercialName =
    selectedCommercialId === "all"
      ? null
      : visibleCommercial.find((option) => option.id === selectedCommercialId)
          ?.name ?? null
  const hasFilters = hasTvDeskListFilters({
    selectedPlan,
    selectedCommercialId,
    status: statusFilter,
    search,
  })

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre, DNI, teléfono o N° de abonado"
          className="pl-8"
        />
      </div>

      <QuickFilterBar>
        <QuickFilterField label="Plan TV">
          <Select
            value={selectedPlan}
            onValueChange={(value) =>
              setSelectedPlanFilter(value as TvSelectedPlanFilter)
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </QuickFilterField>
        <QuickFilterField label="Estado">
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as TvListStatusFilter)
            }
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ISP_COMMERCIAL_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {ISP_COMMERCIAL_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </QuickFilterField>
        {visibleCommercial.length > 0 ? (
          <QuickFilterField label="Abono / Servicio">
            <Select
              value={selectedCommercialId}
              onValueChange={(value) =>
                setSelectedCommercialId(value as TvSelectedCommercialFilter)
              }
            >
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {visibleCommercial.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </QuickFilterField>
        ) : null}
        {hasFilters ? (
          <div className="flex items-end pb-1">
            <button
              type="button"
              className={FILTER_CLEAR_BUTTON_CLASS}
              onClick={clearFilters}
            >
              Limpiar filtros
            </button>
          </div>
        ) : null}
      </QuickFilterBar>

      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">Filtro activo:</p>
          {selectedPlanName ? (
            <FilterChip
              label={selectedPlanName}
              onRemove={() => setSelectedPlanFilter("all")}
            />
          ) : null}
          {statusFilter !== "all" ? (
            <FilterChip
              label={ISP_COMMERCIAL_STATUS_LABELS[statusFilter]}
              onRemove={() => setStatusFilter("all")}
            />
          ) : null}
          {selectedCommercialName ? (
            <FilterChip
              label={selectedCommercialName}
              onRemove={() => setSelectedCommercialId("all")}
            />
          ) : null}
          {search.trim() ? (
            <FilterChip
              label={search.trim()}
              onRemove={() => setSearch("")}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1">
      {label}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-4 rounded-full"
        onClick={onRemove}
        aria-label={`Quitar filtro ${label}`}
      >
        <X className="size-3" />
      </Button>
    </Badge>
  )
}
