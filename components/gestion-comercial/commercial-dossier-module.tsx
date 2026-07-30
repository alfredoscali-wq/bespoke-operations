"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { PermanentDeleteAction } from "@/components/admin/permanent-delete-action"
import { useAuth } from "@/components/auth/auth-provider"
import { CommercialActivityDrawer } from "@/components/gestion-comercial/commercial-activity-drawer"
import { CommercialActivityQuickActions } from "@/components/gestion-comercial/commercial-activity-quick-actions"
import {
  CommercialActivitiesProvider,
} from "@/components/gestion-comercial/commercial-activities-provider"
import { CommercialClientCard } from "@/components/gestion-comercial/commercial-client-card"
import { CommercialHeader } from "@/components/gestion-comercial/commercial-header"
import { CommercialNewOpportunityDrawer } from "@/components/gestion-comercial/commercial-new-opportunity-drawer"
import { CommercialSolicitudDrawer } from "@/components/gestion-comercial/commercial-solicitud-drawer"
import { CommercialSolicitudResolveDrawer } from "@/components/gestion-comercial/commercial-solicitud-resolve-drawer"
import { CommercialSolicitudesSection } from "@/components/gestion-comercial/commercial-solicitudes-section"
import { CommercialTimeline } from "@/components/gestion-comercial/timeline/commercial-timeline"
import {
  CommercialProvider,
  useDeleteOpportunity,
  useCommercialContextLoad,
} from "@/components/gestion-comercial/commercial-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { Button } from "@/components/ui/button"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"
import { resolveCommercialClientDisplayName } from "@/lib/commercial/display"
import { resolveCommercialDossierBackHref } from "@/lib/commercial/dossier-navigation"
import {
  enrichOpportunityWithEtiqueta,
  indexCommercialEtiquetasById,
} from "@/lib/commercial/etiqueta-display"
import { resolveCommercialActorEmployeeId } from "@/lib/commercial/module-access"
import {
  buildSolicitudOtCreateHref,
  storeSolicitudOtCreatePrefill,
  type SolicitudOtCreatePrefill,
} from "@/lib/commercial/solicitud-ot-create"
import type { CommercialActivityTypeCode } from "@/lib/commercial/activity-catalogs"
import { listCommercialEtiquetasBrowser } from "@/lib/supabase/commercial-etiquetas.browser"
import {
  cancelCommercialSolicitudBrowser,
  listCommercialSolicitudesByOpportunityBrowser,
} from "@/lib/supabase/commercial-solicitudes.browser"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import type {
  CommercialOpportunity,
  CommercialPerson,
} from "@/lib/types/commercial"
import type { CommercialActivityListItem } from "@/lib/types/commercial-activities"
import type { CommercialEtiqueta } from "@/lib/types/commercial-etiquetas"
import type { CommercialSolicitud } from "@/lib/types/commercial-solicitudes"

type CommercialDossierContentProps = {
  opportunityId: string
}

function CommercialDossierContent({
  opportunityId,
}: CommercialDossierContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const { loadDossier, upsertPersonLocal, upsertOpportunityLocal } =
    useCommercialContextLoad()
  const { mutateAsync: deleteOpportunity } = useDeleteOpportunity()

  function handleBack() {
    const backHref = resolveCommercialDossierBackHref(searchParams.get("from"))
    if (backHref) {
      router.push(backHref)
      return
    }
    router.back()
  }

  const [opportunity, setOpportunity] = useState<CommercialOpportunity | null>(
    null
  )
  const [person, setPerson] = useState<CommercialPerson | null>(null)
  const [etiquetas, setEtiquetas] = useState<CommercialEtiqueta[]>([])
  const [solicitudes, setSolicitudes] = useState<CommercialSolicitud[]>([])
  const [isSolicitudesLoading, setIsSolicitudesLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false)
  const [solicitudDrawerOpen, setSolicitudDrawerOpen] = useState(false)
  const [resolveDrawerOpen, setResolveDrawerOpen] = useState(false)
  const [editingSolicitud, setEditingSolicitud] =
    useState<CommercialSolicitud | null>(null)
  const [resolvingSolicitud, setResolvingSolicitud] =
    useState<CommercialSolicitud | null>(null)
  const [editingActivity, setEditingActivity] =
    useState<CommercialActivityListItem | null>(null)
  const [defaultActivityType, setDefaultActivityType] =
    useState<CommercialActivityTypeCode>("nota")

  const actorEmployeeId = useMemo(
    () =>
      sessionUser ? resolveCommercialActorEmployeeId(sessionUser) : null,
    [sessionUser]
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isAuthReady || !companyId) {
        setEtiquetas([])
        return
      }
      const result = await listCommercialEtiquetasBrowser(companyId, {
        activeOnly: false,
      })
      if (cancelled) return
      setEtiquetas(result.data ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady])

  useEffect(() => {
    if (!isAuthReady || !companyId || !opportunityId) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (!cancelled) setIsSolicitudesLoading(true)
    })
    void listCommercialSolicitudesByOpportunityBrowser(
      companyId,
      opportunityId
    ).then((result) => {
      if (cancelled) return
      setSolicitudes(result.data ?? [])
      setIsSolicitudesLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, opportunityId])

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
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      setEditingActivity(null)
      setDefaultActivityType("nota")
      setActivityDrawerOpen(true)
    })
    return () => {
      cancelled = true
    }
  }, [isLoading, opportunity, searchParams])

  const etiquetasById = useMemo(
    () => indexCommercialEtiquetasById(etiquetas),
    [etiquetas]
  )

  const displayOpportunity = useMemo(
    () =>
      opportunity
        ? enrichOpportunityWithEtiqueta(opportunity, etiquetasById)
        : null,
    [etiquetasById, opportunity]
  )

  function openRegisterActivity() {
    setEditingActivity(null)
    setDefaultActivityType("nota")
    setActivityDrawerOpen(true)
  }

  function openEditActivity(activity: CommercialActivityListItem) {
    setEditingActivity(activity)
    setDefaultActivityType(activity.activityTypeCode)
    setActivityDrawerOpen(true)
  }

  function openNewSolicitud() {
    setEditingSolicitud(null)
    setSolicitudDrawerOpen(true)
  }

  function openEditSolicitud(solicitud: CommercialSolicitud) {
    setEditingSolicitud(solicitud)
    setSolicitudDrawerOpen(true)
  }

  function buildOtPrefill(
    solicitud: CommercialSolicitud
  ): SolicitudOtCreatePrefill | null {
    if (!person || !displayOpportunity) return null
    const clientName = resolveCommercialClientDisplayName({
      personType: person.personType,
      firstName: person.firstName,
      lastName: person.lastName,
      companyName: person.companyName,
    })
    return {
      solicitudId: solicitud.id,
      opportunityId: displayOpportunity.id,
      solicitudCode: solicitud.code,
      requestTypeName: solicitud.requestTypeName ?? "",
      productPlan: solicitud.productPlan,
      observations: solicitud.observations,
      customerName: clientName,
      customerPhone: person.phone.trim() || person.mobile.trim(),
      address: person.address.trim() || person.street.trim(),
      locality: person.city.trim(),
    }
  }

  function openResolveSolicitud(solicitud: CommercialSolicitud) {
    setResolvingSolicitud(solicitud)
    setResolveDrawerOpen(true)
  }

  function handleGenerateOt(solicitud: CommercialSolicitud) {
    const prefill = buildOtPrefill(solicitud)
    if (!prefill) return
    storeSolicitudOtCreatePrefill(prefill)
    router.push(buildSolicitudOtCreateHref(solicitud.id))
  }

  async function handleCancelSolicitud(solicitud: CommercialSolicitud) {
    if (!companyId) return
    const result = await cancelCommercialSolicitudBrowser(
      companyId,
      solicitud.id,
      { employeeId: actorEmployeeId }
    )
    if (result.error || !result.data) return
    setSolicitudes((current) =>
      current.map((entry) =>
        entry.id === result.data!.id ? result.data! : entry
      )
    )
  }

  function handleSolicitudSaved(solicitud: CommercialSolicitud) {
    setSolicitudes((current) => {
      const index = current.findIndex((entry) => entry.id === solicitud.id)
      if (index < 0) return [solicitud, ...current]
      const next = [...current]
      next[index] = solicitud
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TableRowsSkeleton rows={3} columns={4} />
      </div>
    )
  }

  if (error || !displayOpportunity || !person) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Expediente no encontrado."}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/gestion-comercial/oportunidades")}
        >
          Volver a Clientes
        </Button>
      </div>
    )
  }

  const contactPhone = person.phone.trim() || person.mobile.trim()
  const clientName = resolveCommercialClientDisplayName({
    personType: person.personType,
    firstName: person.firstName,
    lastName: person.lastName,
    companyName: person.companyName,
  })

  return (
    <div className="space-y-6">
      <CommercialHeader
        opportunity={displayOpportunity}
        clientName={clientName}
        onBack={handleBack}
        onEdit={() => setEditDrawerOpen(true)}
        permanentDeleteAction={
          <PermanentDeleteAction
            entityType="commercial_client"
            entityId={displayOpportunity.id}
            entityLabel={`${clientName} (${displayOpportunity.code})`}
            title="Eliminar definitivamente este cliente."
            description={
              "Esta acción eliminará permanentemente el cliente y toda la información asociada.\n\nEsta operación no puede deshacerse."
            }
            onDelete={async ({ entityId }) => {
              const result = await deleteOpportunity(entityId)
              return {
                success: result.success,
                message: result.message,
              }
            }}
            onSuccess={() => {
              router.push("/gestion-comercial/oportunidades")
            }}
          />
        }
      />

      <CommercialActivityQuickActions
        phone={contactPhone}
        onRegisterActivity={openRegisterActivity}
        onNewSolicitud={openNewSolicitud}
      />

      <CommercialClientCard
        person={person}
        opportunity={displayOpportunity}
      />

      <CommercialSolicitudesSection
        solicitudes={solicitudes}
        isLoading={isSolicitudesLoading}
        onNew={openNewSolicitud}
        onEdit={openEditSolicitud}
        onResolve={openResolveSolicitud}
        onGenerateOt={handleGenerateOt}
        onCancel={(solicitud) => {
          void handleCancelSolicitud(solicitud)
        }}
      />

      <CommercialTimeline
        onEdit={openEditActivity}
        onCreateFirst={openRegisterActivity}
      />

      <CommercialNewOpportunityDrawer
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        mode="edit"
        person={person}
        opportunity={displayOpportunity}
        onUpdated={({ person: nextPerson, opportunity: nextOpportunity }) => {
          setPerson(nextPerson)
          setOpportunity(nextOpportunity)
          upsertPersonLocal(nextPerson)
          upsertOpportunityLocal(nextOpportunity)
        }}
      />

      <CommercialActivityDrawer
        open={activityDrawerOpen}
        onOpenChange={(open) => {
          setActivityDrawerOpen(open)
          if (!open) setEditingActivity(null)
        }}
        opportunityId={displayOpportunity.id}
        activity={editingActivity}
        defaultTypeCode={defaultActivityType}
      />

      <CommercialSolicitudDrawer
        open={solicitudDrawerOpen}
        onOpenChange={(open) => {
          setSolicitudDrawerOpen(open)
          if (!open) setEditingSolicitud(null)
        }}
        companyId={companyId}
        opportunityId={displayOpportunity.id}
        solicitud={editingSolicitud}
        onSaved={handleSolicitudSaved}
      />

      <CommercialSolicitudResolveDrawer
        open={resolveDrawerOpen}
        onOpenChange={(open) => {
          setResolveDrawerOpen(open)
          if (!open) setResolvingSolicitud(null)
        }}
        companyId={companyId}
        actorEmployeeId={actorEmployeeId}
        solicitud={resolvingSolicitud}
        otPrefill={
          resolvingSolicitud ? buildOtPrefill(resolvingSolicitud) : null
        }
        onResolved={handleSolicitudSaved}
      />
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
