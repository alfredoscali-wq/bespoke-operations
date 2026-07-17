"use client"

import { useCallback, useEffect, useState } from "react"

import { AtencionFormDialog } from "@/components/atencion-cliente/atencion-form-dialog"
import { ConsultationInboxSection } from "@/components/atencion-cliente/consultation-inbox-section"
import { ConsultationWorkPanel } from "@/components/atencion-cliente/consultation-work-panel"
import { ConsultationKpiStrip } from "@/components/atencion-cliente/consultation-kpi-strip"
import { ConsultationWorkbenchHeader } from "@/components/atencion-cliente/consultation-workbench-header"
import { EquipoSection } from "@/components/atencion-cliente/equipo-section"
import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import type { SharedInboxQuery } from "@/lib/customer-atenciones/shared-inbox"
import { Button } from "@/components/ui/button"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { cn } from "@/lib/utils"

function createDefaultSharedInboxQuery(): SharedInboxQuery {
  return {
    statusFilter: "all",
    motivo: "all",
    channel: "all",
    operationalCategory: null,
    createdDate: null,
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
  const [selectedConsultationId, setSelectedConsultationId] = useState<
    string | null
  >(null)
  const [expandedConsultationId, setExpandedConsultationId] = useState<
    string | null
  >(null)

  useEffect(() => {
    void loadSharedInbox(sharedInboxQuery)
  }, [loadSharedInbox, sharedInboxQuery])

  const refreshInboxAfterPanelAction = useCallback(() => {
    void loadSharedInbox(sharedInboxQuery)
  }, [loadSharedInbox, sharedInboxQuery])

  const handleSelectConsultation = useCallback((atencionId: string) => {
    setSelectedConsultationId(atencionId)
    setExpandedConsultationId(atencionId)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setExpandedConsultationId(null)
  }, [])

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
      <ConsultationWorkbenchHeader
        query={sharedInboxQuery}
        onQueryChange={setSharedInboxQuery}
        onCreateClick={() => setFormOpen(true)}
        showSearch={moduleView === "personal"}
      />

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
          <ConsultationKpiStrip
            query={sharedInboxQuery}
            onQueryChange={setSharedInboxQuery}
          />

          <div
            className={cn(
              "grid items-start gap-6",
              expandedConsultationId &&
                "lg:grid-cols-[minmax(0,60fr)_minmax(0,40fr)]"
            )}
          >
            <ConsultationInboxSection
              query={sharedInboxQuery}
              onQueryChange={setSharedInboxQuery}
              onSelectConsultation={handleSelectConsultation}
              selectedConsultationId={selectedConsultationId}
            />

            {expandedConsultationId ? (
              <ConsultationWorkPanel
                atencionId={expandedConsultationId}
                onClose={handleCloseDetail}
                onDataChanged={refreshInboxAfterPanelAction}
              />
            ) : null}
          </div>

          <AtencionFormDialog open={formOpen} onOpenChange={setFormOpen} />
        </>
      )}
    </div>
  )
}
