"use client"

import {
  formatActivityActionLabel,
  formatActivityDisplayTimestamp,
  formatActivityEntityTypeLabel,
  formatActivityMetadataJson,
  formatActivityModuleLabel,
  formatActivityOriginLabel,
  formatActivitySeverityLabel,
} from "@/lib/activity/activity-viewer-labels"
import type { ActivityViewerEntry } from "@/lib/activity/activity-viewer-types"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type ActivityViewerDetailSheetProps = {
  entry: ActivityViewerEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1 border-b border-border/60 py-3 last:border-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  )
}

export function ActivityViewerDetailSheet({
  entry,
  open,
  onOpenChange,
}: ActivityViewerDetailSheetProps) {
  if (!entry) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Detalle del evento</SheetTitle>
          <SheetDescription>
            Registro de solo lectura desde activity_events.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 px-1">
          <DetailRow
            label="Fecha"
            value={formatActivityDisplayTimestamp(entry.createdAt)}
          />
          <DetailRow label="Usuario" value={entry.userName} />
          <DetailRow label="Empresa" value={entry.companyName} />
          <DetailRow label="Área" value={entry.areaLabel} />
          <DetailRow
            label="Módulo"
            value={formatActivityModuleLabel(String(entry.module))}
          />
          <DetailRow
            label="Entidad"
            value={formatActivityEntityTypeLabel(String(entry.entityType))}
          />
          <DetailRow label="Entity ID" value={entry.entityId ?? "—"} />
          <DetailRow
            label="Acción"
            value={
              <div className="space-y-1">
                <p>{formatActivityActionLabel(String(entry.action))}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {entry.action}
                </p>
              </div>
            }
          />
          <DetailRow
            label="Origen"
            value={formatActivityOriginLabel(String(entry.origin))}
          />
          <DetailRow
            label="Severity"
            value={formatActivitySeverityLabel(String(entry.severity))}
          />
          <DetailRow
            label="Correlation ID"
            value={
              entry.correlationId ? (
                <span className="break-all font-mono text-xs">
                  {entry.correlationId}
                </span>
              ) : (
                "—"
              )
            }
          />
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold">Metadata</h3>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/20 p-3 font-mono text-xs text-foreground">
              {formatActivityMetadataJson(entry.metadata)}
            </pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
