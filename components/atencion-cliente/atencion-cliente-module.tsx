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
import { EquipoSection } from "@/components/atencion-cliente/equipo-section"
import { MisRetencionesSection } from "@/components/atencion-cliente/mis-retenciones-section"
import { RetencionesAsignadasSection } from "@/components/atencion-cliente/retenciones-asignadas-section"
import { MiRecuperoSection } from "@/components/atencion-cliente/mi-recupero-section"
import { MiJornadaSection } from "@/components/atencion-cliente/mi-jornada-section"
import { RecuperoFormDialog } from "@/components/atencion-cliente/recupero-form-dialog"
import { RetencionAssignDialog } from "@/components/atencion-cliente/retencion-assign-dialog"
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
    canAssignRetencion,
    canViewAssignedRetenciones,
    canViewEquipoReport,
  } = useAtencionCliente()
  const [moduleView, setModuleView] = useState<"personal" | "equipo">("personal")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [recuperoFormOpen, setRecuperoFormOpen] = useState(false)
  const [assignRetencionOpen, setAssignRetencionOpen] = useState(false)
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
            Nueva atención, recupero, retenciones, seguimientos y actividad del día.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canAssignRetencion ? (
            <Button size="lg" variant="outline" onClick={() => setAssignRetencionOpen(true)}>
              Asignar Retención
            </Button>
          ) : null}
          <Button
            size="lg"
            variant="outline"
            onClick={() => setRecuperoFormOpen(true)}
          >
            <Plus className="mr-2 size-4" />
            Nueva Gestión de Recupero
          </Button>
          <Button size="lg" onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 size-4" />
            Nueva Atención
          </Button>
        </div>
      </div>

      {canViewEquipoReport ? (
        <div className="inline-flex rounded-lg border p-1">
          <Button
            type="button"
            size="sm"
            variant={moduleView === "personal" ? "default" : "ghost"}
            onClick={() => setModuleView("personal")}
          >
            Mi panel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={moduleView === "equipo" ? "default" : "ghost"}
            onClick={() => setModuleView("equipo")}
          >
            Equipo
          </Button>
        </div>
      ) : null}

      {moduleView === "equipo" && canViewEquipoReport ? (
        <EquipoSection />
      ) : (
        <>
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

      {canViewAssignedRetenciones ? <RetencionesAsignadasSection /> : null}

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
          <MisRetencionesSection
            highlighted={dashboardFilter === "retenciones_activas"}
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
          <MiRecuperoSection highlighted={dashboardFilter === "mi_recupero"} />
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
      <RecuperoFormDialog
        open={recuperoFormOpen}
        onOpenChange={setRecuperoFormOpen}
      />
      <RetencionAssignDialog
        open={assignRetencionOpen}
        onOpenChange={setAssignRetencionOpen}
      />
        </>
      )}
    </div>
  )
}
