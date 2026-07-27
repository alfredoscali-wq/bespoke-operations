"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

import { CommercialActivityDrawer } from "@/components/gestion-comercial/commercial-activity-drawer"
import { CommercialActivitiesProvider } from "@/components/gestion-comercial/commercial-activities-provider"
import { CommercialModuleHero } from "@/components/gestion-comercial/commercial-module-hero"
import { CommercialNewOpportunityDrawer } from "@/components/gestion-comercial/commercial-new-opportunity-drawer"
import { CommercialOpportunityDrawer } from "@/components/gestion-comercial/commercial-opportunity-drawer"
import {
  CommercialProvider,
  useCommercialOpportunities,
  useCommercialPeople,
  useUpdateOpportunity,
} from "@/components/gestion-comercial/commercial-provider"
import { CommercialPipelineColumn } from "@/components/gestion-comercial/pipeline/commercial-pipeline-column"
import { EmployeesProvider, useEmployees } from "@/components/rrhh/employees-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  COMMERCIAL_LOST_REASON_OPTIONS,
  COMMERCIAL_SOURCE_FIELD_LABEL,
  COMMERCIAL_SOURCE_LABELS,
  COMMERCIAL_SOURCE_SELECT_CODES,
  COMMERCIAL_STATUS_CODES,
  COMMERCIAL_STATUS_LABELS,
  type CommercialStatusCode,
} from "@/lib/commercial/catalogs"
import {
  emptyPipelineFilters,
  filterPipelineCards,
  groupPipelineCardsByStatus,
} from "@/lib/commercial/pipeline"
import { listCommercialResponsibleOptions } from "@/lib/commercial/responsible-employees"
import { buildCommercialDossierHref } from "@/lib/commercial/dossier-navigation"
import type { CommercialPipelineCard } from "@/lib/types/commercial-pipeline"
import type {
  CommercialOpportunity,
  CommercialOpportunityListItem,
} from "@/lib/types/commercial"

type PendingMove = {
  cardId: string
  fromStatus: CommercialStatusCode
  toStatus: CommercialStatusCode
}

function CommercialPipelineContent() {
  const router = useRouter()
  const { employees } = useEmployees()
  const { data: people } = useCommercialPeople()
  const { refetch: refreshOpportunities } = useCommercialOpportunities()
  const { mutateAsync: updateOpportunity } = useUpdateOpportunity()

  const [cards, setCards] = useState<CommercialPipelineCard[]>([])
  const [filters, setFilters] = useState(emptyPipelineFilters)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<CommercialStatusCode | null>(
    null
  )
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [wonConfirmOpen, setWonConfirmOpen] = useState(false)
  const [lostDialogOpen, setLostDialogOpen] = useState(false)
  const [lostReason, setLostReason] = useState("")
  const [lostReasonOther, setLostReasonOther] = useState("")
  const [isMoving, setIsMoving] = useState(false)
  const [newOpportunityOpen, setNewOpportunityOpen] = useState(false)

  const [activityOpportunityId, setActivityOpportunityId] = useState<
    string | null
  >(null)
  const [activityMode, setActivityMode] = useState<"activity" | "commitment">(
    "activity"
  )
  const [editOpportunity, setEditOpportunity] =
    useState<CommercialOpportunity | null>(null)

  const employeeOptions = useMemo(
    () => listCommercialResponsibleOptions(employees),
    [employees]
  )

  const loadPipeline = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/gestion-comercial/pipeline")
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean
        message?: string
        cards?: CommercialPipelineCard[]
      } | null
      if (!response.ok || !payload?.success || !payload.cards) {
        setError(payload?.message ?? "No se pudo cargar el pipeline.")
        setCards([])
        return
      }
      setCards(payload.cards)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPipeline()
  }, [loadPipeline])

  const visibleCards = useMemo(
    () => filterPipelineCards(cards, filters),
    [cards, filters]
  )

  const grouped = useMemo(
    () => groupPipelineCardsByStatus(visibleCards),
    [visibleCards]
  )

  const applyStatusChange = useCallback(
    async (
      cardId: string,
      toStatus: CommercialStatusCode,
      extra?: { lostReason?: string }
    ) => {
      setIsMoving(true)
      setError(null)
      const previous = cards.find((card) => card.id === cardId)
      if (!previous) {
        setIsMoving(false)
        return
      }

      setCards((current) =>
        current.map((card) =>
          card.id === cardId ? { ...card, status: toStatus } : card
        )
      )

      const result = await updateOpportunity({
        id: cardId,
        payload: {
          status: toStatus,
          ...(extra?.lostReason != null
            ? { lostReason: extra.lostReason }
            : {}),
        },
      })

      if (!result.success) {
        setCards((current) =>
          current.map((card) =>
            card.id === cardId ? { ...card, status: previous.status } : card
          )
        )
        setError(result.message ?? "No se pudo actualizar la etapa.")
      } else {
        void refreshOpportunities()
        void loadPipeline()
      }
      setIsMoving(false)
    },
    [cards, loadPipeline, refreshOpportunities, updateOpportunity]
  )

  function requestMove(
    cardId: string,
    fromStatus: CommercialStatusCode,
    toStatus: CommercialStatusCode
  ) {
    if (fromStatus === toStatus) return
    const pending = { cardId, fromStatus, toStatus }
    if (toStatus === "ganada") {
      setPendingMove(pending)
      setWonConfirmOpen(true)
      return
    }
    if (toStatus === "perdida") {
      setPendingMove(pending)
      setLostReason("")
      setLostReasonOther("")
      setLostDialogOpen(true)
      return
    }
    void applyStatusChange(cardId, toStatus)
  }

  function handleDrop(toStatus: CommercialStatusCode) {
    if (!draggingId) {
      setDropTarget(null)
      return
    }
    const card = cards.find((entry) => entry.id === draggingId)
    setDropTarget(null)
    setDraggingId(null)
    if (!card) return
    requestMove(card.id, card.status, toStatus)
  }

  async function confirmWon() {
    if (!pendingMove) return
    setWonConfirmOpen(false)
    const move = pendingMove
    setPendingMove(null)
    await applyStatusChange(move.cardId, "ganada")
  }

  async function confirmLost() {
    if (!pendingMove) return
    const reason =
      lostReason === "Otro"
        ? lostReasonOther.trim() || "Otro"
        : lostReason.trim()
    if (!reason) {
      setError("Indicá el motivo de pérdida.")
      return
    }
    setLostDialogOpen(false)
    const move = pendingMove
    setPendingMove(null)
    await applyStatusChange(move.cardId, "perdida", { lostReason: reason })
  }

  async function openEdit(opportunityId: string) {
    const response = await fetch(
      `/api/gestion-comercial/opportunities/${opportunityId}`
    )
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean
      opportunity?: CommercialOpportunity
    } | null
    if (response.ok && payload?.opportunity) {
      setEditOpportunity(payload.opportunity)
    }
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[560px] flex-col gap-4">
      <CommercialModuleHero
        active="pipeline"
        title="Pipeline Comercial"
        description="Seguimiento de oportunidades por etapa. Arrastrá para cambiar el estado."
        onNewOpportunity={() => setNewOpportunityOpen(true)}
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 gap-2"
            onClick={() => void loadPipeline()}
            disabled={isLoading}
          >
            <RefreshCw className="size-4" />
            Actualizar
          </Button>
        }
      />

      <div className="grid gap-2 rounded-xl border bg-card p-3 shadow-sm md:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1 md:col-span-2 xl:col-span-2">
          <Label htmlFor="pipeline-search">Buscar</Label>
          <Input
            id="pipeline-search"
            placeholder="Persona, empresa o código"
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label>Responsable</Label>
          <Select
            value={filters.assignedEmployeeId || "__all__"}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                assignedEmployeeId: value === "__all__" ? "" : value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {employeeOptions.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Estado</Label>
          <Select
            value={filters.status || "__all__"}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                status:
                  value === "__all__" ? "" : (value as CommercialStatusCode),
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {COMMERCIAL_STATUS_CODES.map((status) => (
                <SelectItem key={status} value={status}>
                  {COMMERCIAL_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{COMMERCIAL_SOURCE_FIELD_LABEL}</Label>
          <Select
            value={filters.source || "__all__"}
            onValueChange={(value) =>
              setFilters((current) => ({
                ...current,
                source: value === "__all__" ? "" : (value as typeof filters.source),
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {COMMERCIAL_SOURCE_SELECT_CODES.map((source) => (
                <SelectItem key={source} value={source}>
                  {COMMERCIAL_SOURCE_LABELS[source]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pipeline-from">Desde</Label>
          <Input
            id="pipeline-from"
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                dateFrom: event.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pipeline-to">Hasta</Label>
          <Input
            id="pipeline-to"
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                dateTo: event.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pipeline-person">Persona</Label>
          <Input
            id="pipeline-person"
            value={filters.personQuery}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                personQuery: event.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pipeline-company">Empresa</Label>
          <Input
            id="pipeline-company"
            value={filters.companyQuery}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                companyQuery: event.target.value,
              }))
            }
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading && cards.length === 0 ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[420px] w-[280px] shrink-0" />
          ))}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-x-auto pb-2">
          <div className="flex h-full min-w-max gap-3">
            {COMMERCIAL_STATUS_CODES.map((status) => {
              if (filters.status && filters.status !== status) return null
              return (
                <CommercialPipelineColumn
                  key={status}
                  status={status}
                  cards={grouped[status]}
                  isDropTarget={dropTarget === status}
                  draggingId={draggingId}
                  onDragStart={(cardId) => setDraggingId(cardId)}
                  onDragOver={(next) => setDropTarget(next)}
                  onDragLeave={(left) => {
                    if (dropTarget === left) setDropTarget(null)
                  }}
                  onDrop={handleDrop}
                  onOpenDossier={(id) =>
                    router.push(buildCommercialDossierHref(id, "pipeline"))
                  }
                  onRegisterActivity={(id) => {
                    setActivityMode("activity")
                    setActivityOpportunityId(id)
                  }}
                  onCreateCommitment={(id) => {
                    setActivityMode("commitment")
                    setActivityOpportunityId(id)
                  }}
                  onEdit={(id) => void openEdit(id)}
                />
              )
            })}
          </div>
        </div>
      )}

      <Dialog
        open={wonConfirmOpen}
        onOpenChange={(open) => {
          setWonConfirmOpen(open)
          if (!open) setPendingMove(null)
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Marcar como Ganada</DialogTitle>
            <DialogDescription>
              ¿Desea marcar esta oportunidad como Ganada?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setWonConfirmOpen(false)
                setPendingMove(null)
              }}
              disabled={isMoving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void confirmWon()}
              disabled={isMoving}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={lostDialogOpen}
        onOpenChange={(open) => {
          setLostDialogOpen(open)
          if (!open) setPendingMove(null)
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Marcar como Perdida</DialogTitle>
            <DialogDescription>
              Indicá el motivo de pérdida para registrar en el historial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Select value={lostReason} onValueChange={setLostReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar motivo" />
                </SelectTrigger>
                <SelectContent>
                  {COMMERCIAL_LOST_REASON_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lostReason === "Otro" ? (
              <div className="space-y-1">
                <Label htmlFor="lost-other">Detalle</Label>
                <Input
                  id="lost-other"
                  value={lostReasonOther}
                  onChange={(event) => setLostReasonOther(event.target.value)}
                  placeholder="Describí el motivo"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLostDialogOpen(false)
                setPendingMove(null)
              }}
              disabled={isMoving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmLost()}
              disabled={isMoving || !lostReason}
            >
              Confirmar pérdida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CommercialOpportunityDrawer
        open={Boolean(editOpportunity)}
        onOpenChange={(open) => {
          if (!open) setEditOpportunity(null)
        }}
        opportunity={editOpportunity}
        onUpdated={() => {
          setEditOpportunity(null)
          void loadPipeline()
          void refreshOpportunities()
        }}
      />

      <CommercialNewOpportunityDrawer
        open={newOpportunityOpen}
        onOpenChange={setNewOpportunityOpen}
        people={people}
        onCreated={(opportunity: CommercialOpportunityListItem) => {
          setNewOpportunityOpen(false)
          router.push(buildCommercialDossierHref(opportunity.id, "pipeline"))
        }}
      />

      {activityOpportunityId ? (
        <CommercialActivitiesProvider opportunityId={activityOpportunityId}>
          <CommercialActivityDrawer
            open
            onOpenChange={(open) => {
              if (!open) {
                setActivityOpportunityId(null)
                void loadPipeline()
              }
            }}
            opportunityId={activityOpportunityId}
            defaultTypeCode="nota"
            preferCommitment={activityMode === "commitment"}
          />
        </CommercialActivitiesProvider>
      ) : null}
    </div>
  )
}

export function CommercialPipelineModule() {
  return (
    <EmployeesProvider>
      <CommercialProvider>
        <CommercialPipelineContent />
      </CommercialProvider>
    </EmployeesProvider>
  )
}
