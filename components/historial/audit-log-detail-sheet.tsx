"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { AuditActionBadge } from "@/components/historial/audit-action-badge"
import {
  formatAuditDisplayTimestamp,
  formatAuditMetadataForDisplay,
  parseAuditChangesFromMetadata,
  resolveAuditEntryDescription,
  resolveAuditStatusLabel,
} from "@/lib/audit/display-utils"
import {
  formatAuditEntityTypeLabel,
  formatAuditModuleLabel,
  formatAuditSeverityLabel,
} from "@/lib/audit/audit-labels"
import { fetchAuditEntityTimeline } from "@/lib/audit/fetch-audit-logs.client"
import type { AuditLogEntry } from "@/lib/audit/types"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type AuditLogDetailSheetProps = {
  entry: AuditLogEntry | null
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

function AuditTimeline({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay eventos previos registrados para esta entidad.
      </p>
    )
  }

  return (
    <ol className="relative space-y-0 border-l border-border pl-4">
      {entries.map((item, index) => (
        <li key={item.id} className="relative pb-6 last:pb-0">
          <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-primary" />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {formatAuditDisplayTimestamp(item.createdAt)}
            </p>
            <AuditActionBadge entry={item} />
            <p className="text-sm font-medium">{resolveAuditEntryDescription(item)}</p>
            <p className="text-xs text-muted-foreground">{item.performedByName}</p>
          </div>
          {index < entries.length - 1 ? (
            <span className="sr-only">↓</span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

export function AuditLogDetailSheet({
  entry,
  open,
  onOpenChange,
}: AuditLogDetailSheetProps) {
  const [timeline, setTimeline] = useState<AuditLogEntry[]>([])
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false)

  useEffect(() => {
    if (!open || !entry?.entityId) {
      setTimeline([])
      return
    }

    let cancelled = false
    setIsLoadingTimeline(true)

    void fetchAuditEntityTimeline({
      entityType: entry.entityType,
      entityId: entry.entityId,
    }).then((result) => {
      if (cancelled) return
      setTimeline(result.success ? result.data : [])
      setIsLoadingTimeline(false)
    })

    return () => {
      cancelled = true
    }
  }, [entry?.entityId, entry?.entityType, open])

  if (!entry) return null

  const changes = parseAuditChangesFromMetadata(entry.metadata)
  const metadataRows = formatAuditMetadataForDisplay(entry.metadata)
  const showTimeline =
    entry.entityType === "task" && Boolean(entry.entityId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Detalle del evento</SheetTitle>
          <SheetDescription>
            Trazabilidad operativa del registro seleccionado.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 px-1">
          <DetailRow
            label="Fecha y hora"
            value={formatAuditDisplayTimestamp(entry.createdAt)}
          />
          <DetailRow label="Usuario" value={entry.performedByName} />
          <DetailRow
            label="Módulo"
            value={formatAuditModuleLabel(entry.module)}
          />
          <DetailRow label="Acción" value={<AuditActionBadge entry={entry} />} />
          <DetailRow
            label="Entidad"
            value={
              <div className="space-y-1">
                <p>{formatAuditEntityTypeLabel(entry.entityType)}</p>
                {entry.entityLabel ? (
                  <p className="font-medium">{entry.entityLabel}</p>
                ) : null}
              </div>
            }
          />
          <DetailRow
            label="Descripción"
            value={resolveAuditEntryDescription(entry)}
          />
          <DetailRow
            label="Estado"
            value={
              <div className="space-y-1">
                <p>{resolveAuditStatusLabel(entry)}</p>
                <p className="text-xs text-muted-foreground">
                  Severidad: {formatAuditSeverityLabel(entry.severity)}
                </p>
              </div>
            }
          />

          {changes.length > 0 ? (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold">Cambios realizados</h3>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Campo</th>
                      <th className="px-3 py-2">Anterior</th>
                      <th className="px-3 py-2">Nuevo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((change) => (
                      <tr key={change.campo} className="border-t">
                        <td className="px-3 py-2 font-medium">{change.campo}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {change.valor_anterior ?? "—"}
                        </td>
                        <td className="px-3 py-2">{change.valor_nuevo ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {metadataRows.length > 0 ? (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold">Metadata</h3>
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                {metadataRows.map((row) => (
                  <div key={row.key}>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      {row.key}
                    </p>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-xs text-foreground">
                      {row.value}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {showTimeline ? (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold">Línea de tiempo de la orden de trabajo</h3>
              {isLoadingTimeline ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando historial de la orden de trabajo...
                </div>
              ) : (
                <AuditTimeline entries={timeline} />
              )}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
