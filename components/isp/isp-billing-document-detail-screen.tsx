"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Download, FileText, Pencil } from "lucide-react"

import { IspBillingDocumentPreview } from "@/components/isp/isp-billing-document-preview"
import { IspTonedStatusBadge } from "@/components/isp/isp-status-badges"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ISP_BILLING_DOCUMENT_ARCA_PENDING,
  ISP_BILLING_DOCUMENT_CANCEL_CONFIRM,
  ISP_BILLING_DOCUMENT_TYPE_LABELS,
} from "@/lib/isp/billing-constants"
import { formatCuit, isFiscalBillingDocument } from "@/lib/isp/billing-integrity"
import {
  canCancelBillingDocument,
  canEditBillingDocument,
  canIssueBillingDocument,
  displayBillingDocumentStatus,
  formatBillingMoney,
  vatConditionLabel,
} from "@/lib/isp/billing-document-integrity"
import type { IspBillingDocument } from "@/lib/isp/billing-document-types"
import type { IspBillingTemplateSettings } from "@/lib/isp/billing-template-settings"
import type { IspBillingCompanySettings } from "@/lib/isp/billing-types"
import { canWriteIspBilling } from "@/lib/isp/permissions"
import { formatDateOnly } from "@/lib/dates/date-only"

const EVENT_LABELS = {
  created: "Creado",
  updated: "Actualizado",
  issued: "Emitido",
  cancelled: "Anulado",
} as const

export function IspBillingDocumentDetailScreen({
  documentId,
}: {
  documentId: string
}) {
  const { sessionUser } = useAuth()
  const canWrite = canWriteIspBilling(sessionUser)
  const [document, setDocument] = useState<IspBillingDocument | null>(null)
  const [templateSettings, setTemplateSettings] =
    useState<IspBillingTemplateSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [working, setWorking] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [response, settingsResponse] = await Promise.all([
        fetch(`/api/isp/billing/documents/${documentId}`),
        fetch("/api/isp/billing/settings"),
      ])
      const payload = (await response.json()) as {
        document?: IspBillingDocument
        message?: string
      }
      if (!response.ok || !payload.document) {
        throw new Error(payload.message || "No se pudo cargar el comprobante.")
      }
      setDocument(payload.document)
      if (settingsResponse.ok) {
        const settingsPayload = (await settingsResponse.json()) as {
          settings?: IspBillingCompanySettings | null
        }
        setTemplateSettings(settingsPayload.settings?.templateSettings ?? null)
      }
      setError("")
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo cargar el comprobante."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [documentId])

  async function issue() {
    if (!document) return
    setWorking(true)
    try {
      const response = await fetch(
        `/api/isp/billing/documents/${document.id}/issue`,
        { method: "POST" }
      )
      const payload = (await response.json()) as {
        document?: IspBillingDocument
        message?: string
      }
      if (!response.ok || !payload.document) {
        throw new Error(payload.message || "No se pudo emitir.")
      }
      setDocument(payload.document)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo emitir.")
    } finally {
      setWorking(false)
    }
  }

  async function cancel() {
    if (!document) return
    setWorking(true)
    try {
      const response = await fetch(
        `/api/isp/billing/documents/${document.id}/cancel`,
        { method: "POST" }
      )
      const payload = (await response.json()) as {
        document?: IspBillingDocument
        message?: string
      }
      if (!response.ok || !payload.document) {
        throw new Error(payload.message || "No se pudo anular.")
      }
      setDocument(payload.document)
      setCancelOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo anular.")
    } finally {
      setWorking(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!document) {
    return (
      <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error || "Comprobante no encontrado."}
      </p>
    )
  }

  const display = displayBillingDocumentStatus(document)
  const fiscal = isFiscalBillingDocument(document.documentType)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
            Administración → Facturación → Comprobantes
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-800">
            {ISP_BILLING_DOCUMENT_TYPE_LABELS[document.documentType]}{" "}
            {document.formattedNumber ?? "Sin número"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <IspTonedStatusBadge tone={display.tone}>{display.label}</IspTonedStatusBadge>
            <span className="text-sm text-slate-500">
              {formatDateOnly(document.issueDate, { locale: "es-AR" })}
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {formatBillingMoney(document.total)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditBillingDocument(document.status) ? (
            <Button asChild variant="outline">
              <Link href={`/facturacion/comprobantes/${document.id}/editar`}>
                <Pencil className="size-4" />
                Editar
              </Link>
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
            Vista previa
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/isp/billing/documents/${document.id}/pdf`}>
              <Download className="size-4" />
              Descargar PDF
            </a>
          </Button>
          {canWrite && canIssueBillingDocument(document.status) ? (
            <Button type="button" onClick={() => void issue()} disabled={working}>
              Emitir
            </Button>
          ) : null}
          {canWrite && canCancelBillingDocument(document.status) ? (
            <Button type="button" variant="destructive" onClick={() => setCancelOpen(true)}>
              Anular
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <IspBillingDocumentPreview
        document={document}
        templateSettings={templateSettings}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Empresa emisora</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <p className="font-medium text-slate-800">{document.issuerLegalNameSnapshot}</p>
            <p>CUIT {formatCuit(document.issuerTaxIdSnapshot) || "—"}</p>
            <p>{vatConditionLabel(document.issuerVatConditionSnapshot)}</p>
            <p>
              Punto de venta {String(document.pointOfSaleNumber).padStart(4, "0")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
            <CardDescription>Snapshot fiscal al momento del comprobante.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-600">
            <p className="font-medium text-slate-800">{document.customerNameSnapshot}</p>
            <p>
              {document.customerDocumentTypeSnapshot.toUpperCase()}{" "}
              {document.customerDocumentNumberSnapshot ||
                document.customerTaxIdSnapshot ||
                "—"}
            </p>
            <p>{vatConditionLabel(document.customerVatConditionSnapshot)}</p>
            <p>
              {[
                document.customerTaxAddressSnapshot,
                document.customerCitySnapshot,
                document.customerProvinceSnapshot,
                document.customerPostalCodeSnapshot,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
            {document.customerEmailSnapshot ? (
              <p>{document.customerEmailSnapshot}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conceptos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {document.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
              <div>
                <p className="font-medium text-slate-800">{item.description}</p>
                <p className="text-slate-500">
                  {item.quantity} × {formatBillingMoney(item.unitPrice)}
                </p>
              </div>
              <p className="font-medium">{formatBillingMoney(item.lineTotal)}</p>
            </div>
          ))}
          <dl className="ml-auto max-w-xs space-y-1 pt-2">
            <div className="flex justify-between text-slate-500">
              <dt>Subtotal</dt>
              <dd>{formatBillingMoney(document.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-slate-500">
              <dt>Descuentos</dt>
              <dd>{formatBillingMoney(document.discountTotal)}</dd>
            </div>
            <div className="flex justify-between text-slate-500">
              <dt>Impuestos</dt>
              <dd>{formatBillingMoney(document.taxTotal)}</dd>
            </div>
            <div className="flex justify-between font-semibold text-slate-900">
              <dt>Total</dt>
              <dd>{formatBillingMoney(document.total)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {document.observations.trim() ? (
        <Card>
          <CardHeader>
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            {document.observations}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {document.events.map((event) => (
            <div key={event.id} className="flex justify-between gap-3">
              <span>{EVENT_LABELS[event.eventType]}</span>
              <span className="text-slate-400">
                {new Date(event.createdAt).toLocaleString("es-AR")}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {fiscal ? (
        <Card>
          <CardHeader>
            <CardTitle>Autorización fiscal</CardTitle>
            <CardDescription>{ISP_BILLING_DOCUMENT_ARCA_PENDING}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            En este sprint no se solicita CAE ni se llama a ARCA.
          </CardContent>
        </Card>
      ) : null}

      <Button asChild variant="ghost">
        <Link href="/facturacion/comprobantes">
          <FileText className="size-4" />
          Volver al listado
        </Link>
      </Button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vista previa</DialogTitle>
          </DialogHeader>
          <IspBillingDocumentPreview
            document={document}
            templateSettings={templateSettings}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular comprobante</DialogTitle>
            <DialogDescription>{ISP_BILLING_DOCUMENT_CANCEL_CONFIRM}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void cancel()}
              disabled={working}
            >
              Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
