"use client"

import { useEffect, useState } from "react"
import { Plus } from "lucide-react"

import { AtencionFormDialog } from "@/components/atencion-cliente/atencion-form-dialog"
import { ConsultationInboxSection } from "@/components/atencion-cliente/consultation-inbox-section"
import { ConsultationInboxSummary } from "@/components/atencion-cliente/consultation-inbox-summary"
import { ConsultationOperationalWorkSection } from "@/components/atencion-cliente/consultation-operational-work-section"
import { EquipoSection } from "@/components/atencion-cliente/equipo-section"
import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import type { SharedInboxQuery } from "@/lib/customer-atenciones/shared-inbox"
import { toLocalDateOnly } from "@/lib/dates/date-only"
import { Button } from "@/components/ui/button"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"

function createDefaultSharedInboxQuery(): SharedInboxQuery {
  return {
    statusFilter: "all",
    motivo: "all",
    channel: "all",
    operationalCategory: null,
    createdDate: toLocalDateOnly(),
    search: "",
  }
}

export function AtencionClienteModule() {
  const {
    loadSharedInbox,
    canViewEquipoReport,
    actionFeedback,
    clearActionFeedback,
  } = useAtencionCliente()
  const [moduleView, setModuleView] = useState<"personal" | "equipo">("personal")
  const [formOpen, setFormOpen] = useState(false)
  const [sharedInboxQuery, setSharedInboxQuery] = useState<SharedInboxQuery>(
    createDefaultSharedInboxQuery
  )

  useEffect(() => {
    void loadSharedInbox(sharedInboxQuery)
  }, [loadSharedInbox, sharedInboxQuery])

  useEffect(() => {
    if (!actionFeedback) {
      return
    }

    const timer = window.setTimeout(() => {
      clearActionFeedback()
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [actionFeedback, clearActionFeedback])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Atención al Cliente
          </h1>
          <p className="text-sm text-muted-foreground">
            Bandeja operativa del día: consultas que requieren acción. Use fecha,
            estado o búsqueda para ver historial.
          </p>
        </div>
        <Button size="lg" onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 size-4" />
          Nueva Atención
        </Button>
      </div>

      <EntityActionFeedback message={actionFeedback} />

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
          <ConsultationInboxSummary
            activeFilter={sharedInboxQuery.statusFilter}
            onFilterChange={(statusFilter) =>
              setSharedInboxQuery((current) => ({
                ...current,
                statusFilter,
                operationalCategory: null,
              }))
            }
          />

          <ConsultationOperationalWorkSection
            query={sharedInboxQuery}
            onQueryChange={setSharedInboxQuery}
          />

          <ConsultationInboxSection
            query={sharedInboxQuery}
            onQueryChange={setSharedInboxQuery}
          />

          <AtencionFormDialog open={formOpen} onOpenChange={setFormOpen} />
        </>
      )}
    </div>
  )
}
