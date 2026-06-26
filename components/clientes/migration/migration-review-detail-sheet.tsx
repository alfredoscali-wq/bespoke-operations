"use client"

import { useState } from "react"
import { Ban, CheckCircle2, Clock3, Loader2 } from "lucide-react"

import { MigrationDataQualityPanel } from "@/components/clientes/migration/migration-data-quality-panel"
import { useMigrationReview } from "@/components/clientes/migration/migration-review-provider"
import { WhatsAppLink } from "@/components/ui/whatsapp-link"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatCustomerTechnologyLabel } from "@/lib/customers/format"
import {
  formatValidationStatusLabel,
  validationStatusBadgeClassName,
  validationStatusDotClassName,
} from "@/lib/customers/customer-validation"
import type {
  EnrichedMigrationCustomer,
  MigrationReviewAction,
} from "@/lib/customers/commercial-migration/review-types"
import { DUPLICATE_KIND_LABELS } from "@/lib/customers/commercial-migration/review-utils"

type MigrationReviewDetailSheetProps = {
  record: EnrichedMigrationCustomer | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  )
}

export function MigrationReviewDetailSheet({
  record,
  open,
  onOpenChange,
}: MigrationReviewDetailSheetProps) {
  const { applyReviewAction } = useMigrationReview()
  const [pendingAction, setPendingAction] =
    useState<MigrationReviewAction | null>(null)

  if (!record) {
    return null
  }

  async function handleAction(action: MigrationReviewAction) {
    setPendingAction(action)
    try {
      await applyReviewAction(record!.legacyId, action)
      onOpenChange(false)
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{record.name || "Cliente sin nombre"}</SheetTitle>
          <SheetDescription>
            N° Cliente {record.externalCustomerCode || "—"} · Revisión previa a
            migración
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <MigrationDataQualityPanel record={record} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Validación
              </p>
              {record.effectiveValidationStatus ? (
                <span
                  className={validationStatusBadgeClassName(
                    record.effectiveValidationStatus
                  )}
                >
                  <span
                    className={validationStatusDotClassName(
                      record.effectiveValidationStatus
                    )}
                  />
                  {formatValidationStatusLabel(record.effectiveValidationStatus)}
                </span>
              ) : (
                <p className="text-sm text-foreground">Descartado</p>
              )}
            </div>
            <DetailField
              label="Estado legacy"
              value={record.legacyClientState || "—"}
            />
            <DetailField label="DNI" value={record.dni} />
            <DetailField label="Teléfono" value={record.phone} />
            <DetailField
              label="WhatsApp"
              value={
                record.phoneWhatsApp ? (
                  <WhatsAppLink phone={record.phoneWhatsApp} />
                ) : (
                  "—"
                )
              }
            />
            <DetailField label="Email" value={record.email} />
            <DetailField label="Dirección" value={record.address} />
            <DetailField
              label="Localidad"
              value={
                record.localityRaw && record.localityRaw !== record.locality
                  ? `${record.locality} (${record.localityRaw})`
                  : record.locality
              }
            />
            <DetailField
              label="Tecnología"
              value={
                formatCustomerTechnologyLabel(record.technology) ??
                record.technologyRaw ??
                "—"
              }
            />
            <DetailField
              label="Conexiones"
              value={`${record.totalConnectionCount} asociada(s)`}
            />
          </div>

          {record.reviewReasons.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Motivos de clasificación
              </p>
              <ul className="space-y-1 text-sm text-foreground">
                {record.reviewReasons.map((reason) => (
                  <li key={reason} className="rounded-lg bg-muted/30 px-3 py-2">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {record.duplicateMatches.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Duplicados detectados
              </p>
              <div className="flex flex-wrap gap-2">
                {record.duplicateMatches.map((kind) => (
                  <span
                    key={kind}
                    className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900"
                  >
                    {DUPLICATE_KIND_LABELS[kind]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {record.observations ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Observaciones
              </p>
              <p className="rounded-lg bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">
                {record.observations}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
            <Button
              className="gap-2"
              disabled={pendingAction !== null}
              onClick={() => void handleAction("aprobado")}
            >
              {pendingAction === "aprobado" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Marcar activo
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={pendingAction !== null}
              onClick={() => void handleAction("revisar_posterior")}
            >
              {pendingAction === "revisar_posterior" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Clock3 className="size-4" />
              )}
              Revisión posterior
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={pendingAction !== null}
              onClick={() => void handleAction("excluido")}
            >
              {pendingAction === "excluido" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Ban className="size-4" />
              )}
              Excluir
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
