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
import {
  ABNET_TV_PADRON_STATUSES,
  type AbnetTvKind,
} from "@/lib/subscriptions/abnet-tv-padron"
import { FILTER_CLEAR_BUTTON_CLASS, FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"

export function TvSubscribersFilters() {
  const {
    tvKind,
    jubiladoOnly,
    statusFilter,
    duplicatesOnly,
    search,
    setTvKind,
    setJubiladoOnly,
    setStatusFilter,
    setDuplicatesOnly,
    setSearch,
    clearFilters,
  } = useSubscriptions()

  const hasFilters =
    tvKind !== "all" ||
    jubiladoOnly ||
    statusFilter !== "all" ||
    duplicatesOnly ||
    search.trim() !== ""
  const tvLabel =
    tvKind === "basica"
      ? "TV Básica"
      : tvKind === "full"
        ? "TV Full"
        : tvKind === "pack"
          ? "TV Básica + Pack Fútbol"
          : tvKind === "other"
            ? "Otro TV"
            : null

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por N° Cliente, nombre, CLI, plan o nodo"
          className="pl-8"
        />
      </div>
      <QuickFilterBar>
        <QuickFilterField label="TV">
          <Select
            value={tvKind}
            onValueChange={(value) => setTvKind(value as "all" | AbnetTvKind)}
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="basica">TV Básica</SelectItem>
              <SelectItem value="full">TV Full</SelectItem>
              <SelectItem value="pack">TV Básica + Pack Fútbol</SelectItem>
              <SelectItem value="other">Otro valor</SelectItem>
            </SelectContent>
          </Select>
        </QuickFilterField>
        <QuickFilterField label="Estado">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ABNET_TV_PADRON_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </QuickFilterField>
        <QuickFilterField label="Condición">
          <Select
            value={jubiladoOnly ? "jubilado" : "all"}
            onValueChange={(value) => setJubiladoOnly(value === "jubilado")}
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="jubilado">Jubilados</SelectItem>
            </SelectContent>
          </Select>
        </QuickFilterField>
        <QuickFilterField label="Filas">
          <Select
            value={duplicatesOnly ? "duplicates" : "all"}
            onValueChange={(value) => setDuplicatesOnly(value === "duplicates")}
          >
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="duplicates">N° con varias filas</SelectItem>
            </SelectContent>
          </Select>
        </QuickFilterField>
        {hasFilters ? (
          <div className="flex items-end pb-1">
            <button type="button" className={FILTER_CLEAR_BUTTON_CLASS} onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        ) : null}
      </QuickFilterBar>
      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">Filtro activo:</p>
          {tvLabel ? (
            <FilterChip label={tvLabel} onRemove={() => setTvKind("all")} />
          ) : null}
          {jubiladoOnly ? (
            <FilterChip label="Jubilados" onRemove={() => setJubiladoOnly(false)} />
          ) : null}
          {statusFilter !== "all" ? (
            <FilterChip label={statusFilter} onRemove={() => setStatusFilter("all")} />
          ) : null}
          {duplicatesOnly ? (
            <FilterChip
              label="Varias filas"
              onRemove={() => setDuplicatesOnly(false)}
            />
          ) : null}
          {search.trim() ? (
            <FilterChip label={search.trim()} onRemove={() => setSearch("")} />
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
