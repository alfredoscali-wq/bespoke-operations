"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { CommercialActivityDrawer } from "@/components/gestion-comercial/commercial-activity-drawer"
import { CommercialActivityQuickActions } from "@/components/gestion-comercial/commercial-activity-quick-actions"
import {
  CommercialActivitiesProvider,
  useCommercialActivities,
} from "@/components/gestion-comercial/commercial-activities-provider"
import { CommercialHeader } from "@/components/gestion-comercial/commercial-header"
import { CommercialOpportunityCard } from "@/components/gestion-comercial/commercial-opportunity-card"
import { CommercialOpportunityDrawer } from "@/components/gestion-comercial/commercial-opportunity-drawer"
import { CommercialPersonDrawer } from "@/components/gestion-comercial/commercial-person-drawer"
import { CommercialProspectCard } from "@/components/gestion-comercial/commercial-prospect-card"
import { CommercialTimeline } from "@/components/gestion-comercial/timeline/commercial-timeline"
import {
  CommercialProvider,
  useDeleteOpportunity,
  useCommercialContextLoad,
} from "@/components/gestion-comercial/commercial-provider"
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
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"
import type {
  CommercialActivityTypeCode,
  CommercialQuickActivityType,
} from "@/lib/commercial/activity-catalogs"
import type {
  CommercialOpportunity,
  CommercialPerson,
} from "@/lib/types/commercial"
import type { CommercialActivityListItem } from "@/lib/types/commercial-activities"

type CommercialDossierContentProps = {
  opportunityId: string
}

function CommercialDossierContent({
  opportunityId,
}: CommercialDossierContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { employees } = useEmployees()
  const { loadDossier, upsertPersonLocal, upsertOpportunityLocal } =
    useCommercialContextLoad()
  const { mutateAsync: deleteOpportunity } = useDeleteOpportunity()
  const {
    refetch: refetchActivities,
  } = useCommercialActivities()

  const [opportunity, setOpportunity] = useState<CommercialOpportunity | null>(
    null
  )
  const [person, setPerson] = useState<CommercialPerson | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [personDrawerOpen, setPersonDrawerOpen] = useState(false)
  const [opportunityDrawerOpen, setOpportunityDrawerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false)
  const [editingActivity, setEditingActivity] =
    useState<CommercialActivityListItem | null>(null)
  const [defaultActivityType, setDefaultActivityType] =
    useState<CommercialActivityTypeCode>("nota")

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      setError(null)
      const result = await loadDossier(opportunityId)
      if (cancelled) return
      if (!result.success || !result.opportunity || !result.person) {
        setError(result.message ?? "No se pudo cargar el expediente.")
        setOpportunity(null)
        setPerson(null)
        setIsLoading(false)
        return
      }
      setOpportunity(result.opportunity)
      setPerson(result.person)
      setIsLoading(false)

      if (!result.opportunity.sellerOpenedAt) {
        void fetch(
          `/api/gestion-comercial/opportunities/${opportunityId}/open`,
          { method: "POST" }
        )
          .then(async (response) => {
            const payload = (await response.json().catch(() => null)) as {
              success?: boolean
              opportunity?: CommercialOpportunity
            } | null
            if (!response.ok || !payload?.success || !payload.opportunity) return
            if (cancelled) return
            setOpportunity(payload.opportunity)
            upsertOpportunityLocal(payload.opportunity)
          })
          .catch(() => {
            /* non-blocking */
          })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadDossier, opportunityId, upsertOpportunityLocal])

  useEffect(() => {
    if (isLoading || !opportunity) return
    if (searchParams.get("action") !== "activity") return
    setEditingActivity(null)
    setDefaultActivityType("nota")
    setActivityDrawerOpen(true)
  }, [isLoading, opportunity, searchParams])

  const responsibleName = useMemo(() => {
    if (!opportunity?.assignedEmployeeId) return ""
    const employee = employees.find(
      (entry) => entry.id === opportunity.assignedEmployeeId
    )
    if (!employee) return ""
    return (
      `${employee.firstName} ${employee.lastName}`.trim() ||
      employee.employeeCode
    )
  }, [employees, opportunity])

  function openCreateActivity(typeCode: CommercialQuickActivityType) {
    setEditingActivity(null)
    setDefaultActivityType(typeCode)
    setActivityDrawerOpen(true)
  }

  function openEditActivity(activity: CommercialActivityListItem) {
    setEditingActivity(activity)
    setDefaultActivityType(activity.activityTypeCode)
    setActivityDrawerOpen(true)
  }

  async function handleDelete() {
    if (!opportunity) return
    setIsDeleting(true)
    try {
      const result = await deleteOpportunity(opportunity.id)
      if (!result.success) {
        setError(result.message ?? "No se pudo eliminar la oportunidad.")
        return
      }
      router.push("/gestion-comercial")
    } finally {
      setIsDeleting(false)
      setDeleteOpen(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TableRowsSkeleton rows={3} columns={4} />
      </div>
    )
  }

  if (error || !opportunity || !person) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Expediente no encontrado."}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/gestion-comercial")}
        >
          Volver al inicio
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CommercialHeader
        opportunity={opportunity}
        responsibleName={responsibleName}
        onBack={() => router.push("/gestion-comercial")}
        onEditPerson={() => setPersonDrawerOpen(true)}
        onEditOpportunity={() => setOpportunityDrawerOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />

      <CommercialActivityQuickActions onSelect={openCreateActivity} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,35%)_minmax(0,65%)]">
        <CommercialProspectCard person={person} />
        <CommercialOpportunityCard
          opportunity={opportunity}
          responsibleName={responsibleName}
        />
      </div>

      <CommercialTimeline
        onEdit={openEditActivity}
        onCreateFirst={() => openCreateActivity("nota")}
      />

      <CommercialPersonDrawer
        open={personDrawerOpen}
        onOpenChange={setPersonDrawerOpen}
        person={person}
        opportunityId={opportunity.id}
        onUpdated={(next) => {
          setPerson(next)
          upsertPersonLocal(next)
        }}
      />

      <CommercialOpportunityDrawer
        open={opportunityDrawerOpen}
        onOpenChange={setOpportunityDrawerOpen}
        opportunity={opportunity}
        onUpdated={(next) => {
          const statusChanged = next.status !== opportunity.status
          setOpportunity(next)
          upsertOpportunityLocal(next)
          if (statusChanged) {
            void refetchActivities()
          }
        }}
      />

      <CommercialActivityDrawer
        open={activityDrawerOpen}
        onOpenChange={(open) => {
          setActivityDrawerOpen(open)
          if (!open) setEditingActivity(null)
        }}
        opportunityId={opportunity.id}
        activity={editingActivity}
        defaultTypeCode={defaultActivityType}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Eliminar oportunidad</DialogTitle>
            <DialogDescription>
              La oportunidad {opportunity.code} se eliminará con soft delete y
              dejará de aparecer en la bandeja.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
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

export function CommercialDossierModule({
  opportunityId,
}: {
  opportunityId: string
}) {
  return (
    <EmployeesProvider>
      <CommercialProvider>
        <CommercialActivitiesProvider opportunityId={opportunityId}>
          <CommercialDossierContent opportunityId={opportunityId} />
        </CommercialActivitiesProvider>
      </CommercialProvider>
    </EmployeesProvider>
  )
}
