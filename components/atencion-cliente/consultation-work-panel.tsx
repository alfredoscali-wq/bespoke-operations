"use client"

import { AtencionDetailScreen } from "@/components/atencion-cliente/atencion-detail-screen"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

type ConsultationWorkPanelProps = {
  atencionId: string
  open: boolean
  onClose: () => void
  onDataChanged: () => void
}

/**
 * UX 2.7 — large centered expediente modal with sticky context header.
 * Reuses AtencionDetailScreen in panel presentation.
 */
export function ConsultationWorkPanel({
  atencionId,
  open,
  onClose,
  onDataChanged,
}: ConsultationWorkPanelProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <DialogContent
        showCloseButton
        aria-describedby={undefined}
        className="flex h-[90vh] w-[85vw] max-w-[85vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[85vw]"
        overlayClassName="bg-black/40 supports-backdrop-filter:backdrop-blur-[2px]"
      >
        <DialogTitle className="sr-only">Expediente de Atención</DialogTitle>
        <DialogDescription className="sr-only">
          Expediente completo de la consulta seleccionada.
        </DialogDescription>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/10">
          <AtencionDetailScreen
            key={atencionId}
            atencionId={atencionId}
            presentation="panel"
            onRequestClose={onClose}
            onDataChanged={onDataChanged}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
