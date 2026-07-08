"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { AtencionClienteSummary } from "@/components/atencion-cliente/atencion-cliente-summary"
import { AtencionFormDialog } from "@/components/atencion-cliente/atencion-form-dialog"
import { AtencionesList } from "@/components/atencion-cliente/atenciones-list"
import {
  MiAgendaSection,
  MiAgendaViewToggle,
} from "@/components/atencion-cliente/mi-agenda-section"
import { MiJornadaSection } from "@/components/atencion-cliente/mi-jornada-section"
import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { DEFAULT_ATENCION_PAGE_SIZE } from "@/lib/customer-atenciones/atencion-list"
import type { AtencionClienteDashboardFilter } from "@/lib/customer-seguimientos/kpis"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FILTER_CLEAR_BUTTON_CLASS } from "@/lib/ui/visual-tokens"

const SEARCH_DEBOUNCE_MS = 300

export function AtencionClienteModule() {
  const {
    isReady,
    isListLoading,
    listPage,
    loadAtencionPage,
    refreshDashboard,
  } = useAtencionCliente()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [agendaView, setAgendaView] = useState<"hoy" | "semana">("hoy")
  const [dashboardFilter, setDashboardFilter] =
    useState<AtencionClienteDashboardFilter>("none")

  useEffect(() => {
    void refreshDashboard()
  }, [refreshDashboard])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  useEffect(() => {
    void loadAtencionPage({
      page,
      pageSize: DEFAULT_ATENCION_PAGE_SIZE,
      search: debouncedSearch,
    })
  }, [debouncedSearch, loadAtencionPage, page])

  const items = listPage?.items ?? []
  const totalResults = listPage?.total ?? 0
  const pageSize = listPage?.pageSize ?? DEFAULT_ATENCION_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize))
  const hasActiveFilter = dashboardFilter !== "none"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Atención al Cliente
          </h1>
          <p className="text-sm text-muted-foreground">
            Nueva atención, seguimientos y actividad del día.
          </p>
        </div>
        <Button size="lg" onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 size-4" />
          Nueva Atención
        </Button>
      </div>

      <AtencionClienteSummary
        dashboardFilter={dashboardFilter}
        onDashboardFilterChange={setDashboardFilter}
      />

      {hasActiveFilter ? (
        <div className="flex items-center justify-end">
          <button
            type="button"
            className={FILTER_CLEAR_BUTTON_CLASS}
            onClick={() => setDashboardFilter("none")}
          >
            Quitar filtro
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              Lo que tengo que hacer
            </p>
            <MiAgendaViewToggle view={agendaView} onViewChange={setAgendaView} />
          </div>
          <MiAgendaSection
            view={agendaView}
            highlighted={dashboardFilter === "agenda_seguimientos"}
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            Lo que ya hice
          </p>
          <MiJornadaSection
            dashboardFilter={dashboardFilter}
            highlighted={
              dashboardFilter === "jornada_atenciones" ||
              dashboardFilter === "jornada_resueltas"
            }
          />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Registro general de atenciones</CardTitle>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cliente"
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          {!isReady || isListLoading ? (
            <TableRowsSkeleton rows={8} columns={6} />
          ) : (
            <>
              <AtencionesList items={items} />
              {totalResults > pageSize ? (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {totalResults.toLocaleString("es-AR")} atenciones
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {page} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((current) => Math.min(totalPages, current + 1))
                      }
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <AtencionFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
