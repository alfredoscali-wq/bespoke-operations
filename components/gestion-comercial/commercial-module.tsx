"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, Pencil, Plus, Trash2, X } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { CommercialNewOpportunityDrawer } from "@/components/gestion-comercial/commercial-new-opportunity-drawer"
import { CommercialOpportunityDrawer } from "@/components/gestion-comercial/commercial-opportunity-drawer"
import {
  CommercialProvider,
  useCommercialOpportunities,
  useCommercialPeople,
  useDeleteOpportunity,
} from "@/components/gestion-comercial/commercial-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  COMMERCIAL_PRIORITY_LABELS,
  COMMERCIAL_STATUS_LABELS,
} from "@/lib/commercial/catalogs"
import { resolveCommercialActorEmployeeId } from "@/lib/commercial/module-access"
import {
  COMMERCIAL_OPPORTUNITY_LIST_VIEW_LABELS,
  filterOpportunitiesByListView,
  isCommercialOpportunityListView,
  type CommercialOpportunityListView,
} from "@/lib/commercial/opportunity-list-views"
import type { CommercialOpportunityListItem } from "@/lib/types/commercial"
import type { CommercialPipelineCard } from "@/lib/types/commercial-pipeline"

type OpportunityScope = "all" | "mine"

function CommercialModuleContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { sessionUser } = useAuth()
  const { data: opportunities, isLoading } = useCommercialOpportunities()
  const { data: people } = useCommercialPeople()
  const { mutateAsync: deleteOpportunity } = useDeleteOpportunity()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scope, setScope] = useState<OpportunityScope>("all")
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

  const listView = useMemo((): CommercialOpportunityListView | null => {
    const raw = searchParams.get("view")
    return isCommercialOpportunityListView(raw) ? raw : null
  }, [searchParams])

  const actorEmployeeId = useMemo(
    () =>
      sessionUser ? resolveCommercialActorEmployeeId(sessionUser) : null,
    [sessionUser]
  )

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
        ? opportunities.filter(
            (opportunity) => opportunity.assignedEmployeeId === actorEmployeeId
          )
        : opportunities

    return filterOpportunitiesByListView(scoped, listView, {
      inactiveOpportunityIds,
    })
  }, [
    actorEmployeeId,
    inactiveOpportunityIds,
    listView,
    opportunities,
    scope,
  ])

  function clearListView() {
    router.push("/gestion-comercial/oportunidades")
  }

  function openDossier(opportunityId: string) {
    router.push(`/gestion-comercial/${opportunityId}`)
  }

  function handleCreated(opportunity: CommercialOpportunityListItem) {
    router.push(`/gestion-comercial/${opportunity.id}`)
  }

  async function handleDelete() {
    if (!deletingOpportunity) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteOpportunity(deletingOpportunity.id)
      if (!result.success) {
        setDeleteError(result.message ?? "No se pudo eliminar la oportunidad.")
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Oportunidades
          </h1>
          <p className="text-sm text-muted-foreground">
            Listado de oportunidades comerciales.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/gestion-comercial")}
          >
            Inicio
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/gestion-comercial/pipeline")}
          >
            Pipeline
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/gestion-comercial/mapa")}
          >
            Territorio
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => setDrawerOpen(true)}
          >
            <Plus className="size-4" />
            Nueva Oportunidad
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={scope === "all" ? "default" : "outline"}
          onClick={() => setScope("all")}
        >
          Todas
        </Button>
        <Button
          type="button"
          size="sm"
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

      <div className="rounded-lg border">
        {tableLoading ? (
          <div className="p-4">
            <TableRowsSkeleton columns={6} rows={4} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Persona</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead className="w-[120px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleOpportunities.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    {listView
                      ? "No hay oportunidades para este filtro."
                      : scope === "mine"
                        ? "No tenés oportunidades asignadas como responsable."
                        : "Todavía no existen oportunidades comerciales."}
                  </TableCell>
                </TableRow>
              ) : (
                visibleOpportunities.map((opportunity) => (
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
                      {COMMERCIAL_STATUS_LABELS[opportunity.status]}
                    </TableCell>
                    <TableCell>
                      {COMMERCIAL_PRIORITY_LABELS[opportunity.priority]}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Ver detalle"
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
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

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
            <DialogTitle>Eliminar oportunidad</DialogTitle>
            <DialogDescription>
              {deletingOpportunity
                ? `La oportunidad ${deletingOpportunity.code} se eliminará y dejará de aparecer en la bandeja.`
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
              onClick={() => setDeletingOpportunity(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
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
