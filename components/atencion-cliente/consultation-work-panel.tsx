"use client"

import { X } from "lucide-react"

import { AtencionDetailScreen } from "@/components/atencion-cliente/atencion-detail-screen"
import { Button } from "@/components/ui/button"

type ConsultationWorkPanelProps = {
  atencionId: string
  onClose: () => void
  onDataChanged: () => void
}

/**
 * Contextual side panel (UX 1.1): rendered only while a consultation is
 * selected. Reuses the existing detail screen in panel mode, with its own
 * scroll so the bandeja keeps its context untouched.
 */
export function ConsultationWorkPanel({
  atencionId,
  onClose,
  onDataChanged,
}: ConsultationWorkPanelProps) {
  return (
    <aside
      aria-label="Detalle de la consulta"
      className="hidden animate-in fade-in-0 slide-in-from-right-2 duration-200 lg:block"
    >
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-5rem)] lg:flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Detalle de la Consulta
            </h2>
            <p className="text-xs text-muted-foreground">
              Gestioná la consulta sin perder la bandeja
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onClose}
          >
            <X className="size-3.5" />
            Cerrar detalle
          </Button>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          <AtencionDetailScreen
            key={atencionId}
            atencionId={atencionId}
            presentation="panel"
            onRequestClose={onClose}
            onDataChanged={onDataChanged}
          />
        </div>
      </div>
    </aside>
  )
}
