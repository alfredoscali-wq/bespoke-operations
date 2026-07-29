"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  BarChart3,
  Eye,
  FolderOpen,
  Inbox,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { CommercialModuleHero } from "@/components/gestion-comercial/commercial-module-hero"
import { CommercialEtiquetaBadge } from "@/components/gestion-comercial/commercial-etiqueta-badge"
import { CommercialNewOpportunityDrawer } from "@/components/gestion-comercial/commercial-new-opportunity-drawer"
import { CommercialOpportunityDrawer } from "@/components/gestion-comercial/commercial-opportunity-drawer"
import {
  CommercialProvider,
  useCommercialOpportunities,
  useCommercialPeople,
  useDeleteOpportunity,
} from "@/components/gestion-comercial/commercial-provider"
import {
  CommercialEmptyState,
  CommercialSectionCard,
} from "@/components/gestion-comercial/commercial-ui"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  COMMERCIAL_STATUS_LABELS,
} from "@/lib/commercial/catalogs"
import { resolveCommercialActorEmployeeId } from "@/lib/commercial/module-access"
import {
  buildCommercialOpportunitiesHref,
  COMMERCIAL_OPEN_STATUSES,
  COMMERCIAL_OPPORTUNITY_LIST_VIEW_LABELS,
  filterOpportunitiesByListView,
  isCommercialOpportunityListView,
  type CommercialOpportunityListView,
} from "@/lib/commercial/opportunity-list-views"
import { buildCommercialDossierHref } from "@/lib/commercial/dossier-navigation"
import {
  enrichOpportunityWithEtiqueta,
  indexCommercialEtiquetasById,
} from "@/lib/commercial/etiqueta-display"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listCommercialEtiquetasBrowser } from "@/lib/supabase/commercial-etiquetas.browser"
import type { CommercialOpportunityListItem } from "@/lib/types/commercial"
import type { CommercialEtiqueta } from "@/lib/types/commercial-etiquetas"
import type { CommercialPipelineCard } from "@/lib/types/commercial-pipeline"

type OpportunityScope = "all" | "mine"

function CommercialModuleContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const { data: opportunities, isLoading } = useCommercialOpportunities()
  const { data: people } = useCommercialPeople()
  const { mutateAsync: deleteOpportunity } = useDeleteOpportunity()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scope, setScope] = useState<OpportunityScope>("all")
  const [etiquetaFilterIds, setEtiquetaFilterIds] = useState<string[]>([])
  const [etiquetas, setEtiquetas] = useState<CommercialEtiqueta[]>([])
  const [editingOpportunity, setEditingOpportunity] =
    useState<CommercialOpportunityListItem | null>(null)
  const [deletingOpportunity, setDeletingOpportunity] =
    useState<CommercialOpportunityListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [inactiveOpportunityIds, setInactiveOpportunityIds] = useState<
    Set<string>
  >(new Set())
  const [isInactiveLoading, setIsInactiveLoading] = useState(false)

  useEffect(() => {
    if (!isAuthReady || !companyId) return
    let cancelled = false
    void listCommercialEtiquetasBrowser(companyId, { activeOnly: true }).then(
      (result) => {
        if (cancelled) return
        setEtiquetas(result.data ?? [])
      }
    )
    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady])

  const listView = useMemo((): CommercialOpportunityListView | null => {
    const raw = searchParams.get("view")
    return isCommercialOpportunityListView(raw) ? raw : null
  }, [searchParams])

  const actorEmployeeId = useMemo(
    () =>
      sessionUser ? resolveCommercialActorEmployeeId(sessionUser) : null,
    [sessionUser]
  )

  const etiquetasById = useMemo(
    () => indexCommercialEtiquetasById(etiquetas),
    [etiquetas]
  )

  const enrichedOpportunities = useMemo(
    () =>
      opportunities.map((entry) =>
        enrichOpportunityWithEtiqueta(entry, etiquetasById)
      ),
    [etiquetasById, opportunities]
  )

  const kpiCounts = useMemo(() => {
    const scoped =
      scope === "mine" && actorEmployeeId
        ? enrichedOpportunities.filter(
            (opportunity) => opportunity.assignedEmployeeId === actorEmployeeId
          )
        : enrichedOpportunities
    return {
      active: scoped.filter((entry) =>
        COMMERCIAL_OPEN_STATUSES.includes(entry.status)
      ).length,
      nueva: scoped.filter((entry) => entry.status === "nueva").length,
      won: scoped.filter((entry) => entry.status === "ganada").length,
      lost: scoped.filter((entry) => entry.status === "perdida").length,
    }
  }, [actorEmployeeId, enrichedOpportunities, scope])

  useEffect(() => {
    if (listView !== "inactive_7d") {
      setInactiveOpportunityIds(new Set())
      setIsInactiveLoading(false)
      return
    }

    let cancelled = false
    setIsInactiveLoading(true)
    void (async () => {
      try {
        const response = await fetch("/api/gestion-comercial/pipeline")
        const payload = (await response.json().catch(() => null)) as {
          success?: boolean
          cards?: CommercialPipelineCard[]
        } | null
        if (cancelled) return
        if (!response.ok || !payload?.success || !payload.cards) {
          setInactiveOpportunityIds(new Set())
          return
        }
        const ids = new Set(
          payload.cards
            .filter((card) => card.daysSinceLastActivity >= 7)
            .map((card) => card.id)
        )
        setInactiveOpportunityIds(ids)
      } finally {
        if (!cancelled) setIsInactiveLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [listView])

  const visibleOpportunities = useMemo(() => {
    const scoped =
      scope === "mine" && actorEmployeeId
        ? enrichedOpportunities.filter(
            (opportunity) => opportunity.assignedEmployeeId === actorEmployeeId
          )
        : enrichedOpportunities

    const byView = filterOpportunitiesByListView(scoped, listView, {
      inactiveOpportunityIds,
    })

    if (etiquetaFilterIds.length === 0) return byView
    const selected = new Set(etiquetaFilterIds)
    return byView.filter(
      (entry) => entry.etiquetaId != null && selected.has(entry.etiquetaId)
    )
  }, [
    actorEmployeeId,
    enrichedOpportunities,
    etiquetaFilterIds,
    inactiveOpportunityIds,
    listView,
    scope,
  ])

  function toggleEtiquetaFilter(id: string) {
    setEtiquetaFilterIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id]
    )
  }

  function clearListView() {
    router.push("/gestion-comercial/oportunidades")
  }

  function openDossier(opportunityId: string) {
    router.push(buildCommercialDossierHref(opportunityId, "oportunidades"))
  }

  function handleCreated(opportunity: CommercialOpportunityListItem) {
    router.push(buildCommercialDossierHref(opportunity.id, "oportunidades"))
  }

  async function handleDelete() {
    if (!deletingOpportunity) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteOpportunity(deletingOpportunity.id)
      if (!result.success) {
        setDeleteError(result.message ?? "No se pudo eliminar el cliente.")
        return
      }
      setDeletingOpportunity(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const tableLoading =
    isLoading || (listView === "inactive_7d" && isInactiveLoading)

  return (
    <div className="space-y-4">
      <CommercialModuleHero
        active="oportunidades"
        title="Clientes"
        description="Listado de clientes."
        onNewOpportunity={() => setDrawerOpen(true)}
      >
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <FilterableKpiCard
            compact
            label="Clientes activos"
            value={kpiCounts.active}
            icon={BarChart3}
            tone="violet"
            href={buildCommercialOpportunitiesHref("active")}
            isActive={listView === "active"}
          />
          <FilterableKpiCard
            compact
            label="Nuevas"
            value={kpiCounts.nueva}
            icon={Inbox}
            tone="blue"
            href={buildCommercialOpportunitiesHref("nueva")}
            isActive={listView === "nueva"}
          />
          <FilterableKpiCard
            compact
            label="Ganadas"
            value={kpiCounts.won}
            icon={Sparkles}
            tone="green"
            href={buildCommercialOpportunitiesHref("won")}
            isActive={listView === "won"}
          />
          <FilterableKpiCard
            compact
            label="Perdidas"
            value={kpiCounts.lost}
            icon={AlertTriangle}
            tone="red"
            href={buildCommercialOpportunitiesHref("lost")}
            isActive={listView === "lost"}
          />
        </div>
      </CommercialModuleHero>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-9"
          variant={scope === "all" ? "default" : "outline"}
          onClick={() => setScope("all")}
        >
          Todas
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-9"
          variant={scope === "mine" ? "default" : "outline"}
          onClick={() => setScope("mine")}
          disabled={!actorEmployeeId}
        >
          Mías
        </Button>
        {listView ? (
          <div className="ml-auto flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs">
            <span className="text-muted-foreground">Filtro:</span>
            <span className="font-medium">
              {COMMERCIAL_OPPORTUNITY_LIST_VIEW_LABELS[listView]}
            </span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="size-6"
              aria-label="Quitar filtro"
              onClick={clearListView}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>

      {etiquetas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            Etiquetas
          </span>
          {etiquetas.map((etiqueta) => {
            const checked = etiquetaFilterIds.includes(etiqueta.id)
            return (
              <label
                key={etiqueta.id}
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleEtiquetaFilter(etiqueta.id)}
                  aria-label={etiqueta.name}
                />
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: etiqueta.color }}
                  aria-hidden
                />
                <span>{etiqueta.name}</span>
              </label>
            )
          })}
          {etiquetaFilterIds.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setEtiquetaFilterIds([])}
            >
              Limpiar
            </Button>
          ) : null}
        </div>
      ) : null}

      <CommercialSectionCard
        title="Listado"
        description={`${visibleOpportunities.length} cliente${visibleOpportunities.length === 1 ? "" : "s"}`}
        icon={FolderOpen}
        accent="slate"
      >
        {tableLoading ? (
          <TableRowsSkeleton columns={6} rows={4} />
        ) : visibleOpportunities.length === 0 ? (
          <CommercialEmptyState
            icon={Inbox}
            title={
              listView || etiquetaFilterIds.length > 0
                ? "No hay clientes para este filtro."
                : scope === "mine"
                  ? "No tenés clientes asignados."
                  : "Todavía no hay clientes."
            }
            description={
              listView || etiquetaFilterIds.length > 0
                ? "Probá otro filtro o quitá el filtro activo."
                : "Creá un nuevo cliente para empezar."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[120px] text-right">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleOpportunities.map((opportunity) => (
                  <TableRow
                    key={opportunity.id}
                    data-opportunity-id={opportunity.id}
                  >
                    <TableCell className="font-medium tabular-nums">
                      {opportunity.code}
                    </TableCell>
                    <TableCell>{opportunity.title}</TableCell>
                    <TableCell>{opportunity.personDisplayName}</TableCell>
                    <TableCell>
                      <CommercialEtiquetaBadge
                        name={opportunity.etiquetaName}
                        color={opportunity.etiquetaColor}
                      />
                    </TableCell>
                    <TableCell>
                      {COMMERCIAL_STATUS_LABELS[opportunity.status]}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Ver ficha del cliente"
                          onClick={() => openDossier(opportunity.id)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar"
                          onClick={() => setEditingOpportunity(opportunity)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          aria-label="Eliminar"
                          onClick={() => {
                            setDeleteError(null)
                            setDeletingOpportunity(opportunity)
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CommercialSectionCard>

      <CommercialNewOpportunityDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        people={people}
        onCreated={handleCreated}
      />

      <CommercialOpportunityDrawer
        open={Boolean(editingOpportunity)}
        onOpenChange={(open) => {
          if (!open) setEditingOpportunity(null)
        }}
        opportunity={editingOpportunity}
      />

      <Dialog
        open={Boolean(deletingOpportunity)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeletingOpportunity(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Eliminar cliente</DialogTitle>
            <DialogDescription>
              {deletingOpportunity
                ? `El cliente ${deletingOpportunity.code} se eliminará y dejará de aparecer en la bandeja.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => setDeletingOpportunity(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-9"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function CommercialModule() {
  return (
    <EmployeesProvider>
      <CommercialProvider>
        <CommercialModuleContent />
      </CommercialProvider>
    </EmployeesProvider>
  )
}
