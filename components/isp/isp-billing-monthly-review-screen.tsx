"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CircleAlert,
  ExternalLink,
  FileText,
  Percent,
  Users,
} from "lucide-react"

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
import { KpiCard } from "@/components/ui/kpi-card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ISP_BILLING_DOCUMENT_TYPE_LABELS,
  type IspBillingDocumentType,
} from "@/lib/isp/billing-constants"
import { formatBillingMoney } from "@/lib/isp/billing-document-integrity"
import {
  billingRunPhaseHint,
  billingRunStatusLabel,
  billingRunStatusTone,
} from "@/lib/isp/billing-run-engine"
import type {
  IspBillingRunDetail,
  IspBillingRunGroup,
} from "@/lib/isp/billing-run-types"
import { billingPeriodTitle } from "@/lib/isp/billing-proration"
import { canWriteIspBilling } from "@/lib/isp/permissions"

const MONTHLY_DOCUMENT_TYPES: IspBillingDocumentType[] = [
  "factura_a",
  "factura_b",
  "factura_c",
]

function preinvoiceStatus(group: IspBillingRunGroup, runStatus: string): string {
  if (group.hasError) return "Error"
  if (runStatus === "confirmed" && group.items.some((item) => item.documentId)) {
    return "Emitido"
  }
  if (group.requiresReview && group.totalAmount <= 0) return "Requiere revisión"
  if (group.hasProportional) return "Con proporcional"
  return "Pendiente de confirmación"
}

export function IspBillingMonthlyReviewScreen({ runId }: { runId: string }) {
  const router = useRouter()
  const { sessionUser } = useAuth()
  const canWrite = canWriteIspBilling(sessionUser)
  const [detail, setDetail] = useState<IspBillingRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [working, setWorking] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [preview, setPreview] = useState<IspBillingRunGroup | null>(null)
  const [view, setView] = useState<"all" | "proportional" | "errors">("all")

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(`/api/isp/billing/runs/${runId}`)
      const payload = (await response.json()) as {
        detail?: IspBillingRunDetail
        message?: string
      }
      if (!response.ok || !payload.detail) {
        throw new Error(payload.message || "No se pudo cargar la corrida.")
      }
      setDetail(payload.detail)
      setError("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la corrida.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [runId])

  const groups = useMemo(() => {
    if (!detail) return []
    if (view === "proportional") {
      return detail.groups.filter((group) => group.hasProportional)
    }
    if (view === "errors") {
      return detail.groups.filter((group) => group.hasError)
    }
    return detail.groups
  }, [detail, view])

  const proportionalItems = detail?.items.filter((item) => item.proportionalAmount > 0) ?? []

  async function confirm() {
    if (!detail) return
    setWorking(true)
    try {
      const response = await fetch(`/api/isp/billing/runs/${detail.run.id}/confirm`, {
        method: "POST",
      })
      const payload = (await response.json()) as {
        detail?: IspBillingRunDetail
        message?: string
      }
      if (!response.ok || !payload.detail) {
        throw new Error(payload.message || "No se pudo confirmar.")
      }
      setDetail(payload.detail)
      setConfirmOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo confirmar.")
    } finally {
      setWorking(false)
    }
  }

  async function cancelRun() {
    if (!detail) return
    setWorking(true)
    try {
      const response = await fetch(`/api/isp/billing/runs/${detail.run.id}/cancel`, {
        method: "POST",
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message)
      router.push("/facturacion/mensual")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cancelar.")
    } finally {
      setWorking(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!detail) {
    return (
      <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error || "Corrida no encontrada."}
      </p>
    )
  }

  const period = {
    year: detail.run.periodYear,
    month: detail.run.periodMonth,
  }
  const reviewable =
    detail.run.status === "in_review" || detail.run.status === "with_errors"

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
            Administración → Facturación → Facturación mensual
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-800">
            {billingPeriodTitle(period)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <IspTonedStatusBadge tone={billingRunStatusTone(detail.run.status)}>
              {billingRunStatusLabel(detail.run.status)}
            </IspTonedStatusBadge>
            <span className="text-sm text-slate-500">
              {billingRunPhaseHint(detail.run.status)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/facturacion/mensual">Volver</Link>
          </Button>
          {canWrite && reviewable ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void cancelRun()}
              disabled={working}
            >
              Cancelar preparación
            </Button>
          ) : null}
          {canWrite && reviewable ? (
            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!detail.canConfirm || working}
            >
              Confirmar facturación
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard compact label="Total abonados" value={detail.run.totalCustomers} icon={Users} tone="blue" />
        <KpiCard
          compact
          label="Comprobantes a generar"
          value={detail.run.totalDocuments}
          icon={FileText}
          tone="blue"
        />
        <KpiCard
          compact
          label="Importe total"
          value={formatBillingMoney(detail.run.totalAmount)}
          icon={FileText}
          tone="green"
        />
        <KpiCard
          compact
          label="Proporcionales"
          value={detail.run.proportionalDocuments}
          icon={Percent}
          tone="yellow"
        />
        <KpiCard
          compact
          label="Errores"
          value={detail.run.errorsCount}
          icon={CircleAlert}
          tone={detail.run.errorsCount ? "red" : "gray"}
        />
        <KpiCard
          compact
          label="Requieren revisión"
          value={detail.run.warningsCount}
          icon={AlertTriangle}
          tone={detail.run.warningsCount ? "yellow" : "gray"}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {MONTHLY_DOCUMENT_TYPES.map((documentType) => {
          const summary = detail.typeSummaries.find(
            (item) => item.documentType === documentType
          )
          return (
            <Card key={documentType}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {ISP_BILLING_DOCUMENT_TYPE_LABELS[documentType]}
                </CardTitle>
                <CardDescription>
                  {summary?.count ?? 0} comprobantes ·{" "}
                  {formatBillingMoney(summary?.totalAmount ?? 0)}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-500">
                <p>Con proporcional: {summary?.proportionalCount ?? 0}</p>
                <p>Con observaciones: {summary?.warningCount ?? 0}</p>
                <p>Con errores: {summary?.errorCount ?? 0}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Proporcionales</CardTitle>
            <CardDescription>
              {detail.run.proportionalDocuments} comprobantes contienen proporcional.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setView("proportional")}>
            Ver proporcionales
          </Button>
        </CardHeader>
        {view === "proportional" && proportionalItems.length > 0 ? (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Abonado</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Fecha de alta</TableHead>
                  <TableHead>Días</TableHead>
                  <TableHead>Importe mensual</TableHead>
                  <TableHead>Proporcional</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proportionalItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.customerName}</TableCell>
                    <TableCell>{item.catalogCode || item.serviceName}</TableCell>
                    <TableCell>{item.activationDate ?? "—"}</TableCell>
                    <TableCell>{item.proportionalDays} días</TableCell>
                    <TableCell>
                      {formatBillingMoney(item.contractedMonthlyAmount || item.monthlyAmount)}
                    </TableCell>
                    <TableCell>{formatBillingMoney(item.proportionalAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        ) : null}
      </Card>

      {detail.run.errorsCount > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-rose-700">Errores</CardTitle>
            <CardDescription>
              Bloquean la confirmación. Corregilos en el origen y volvé a preparar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.groups
              .filter((group) => group.hasError)
              .map((group) => (
                <div
                  key={group.customerId}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-slate-800">{group.customerName}</p>
                    <p className="text-sm text-rose-700">{group.errorMessage}</p>
                    {group.suggestedAction ? (
                      <p className="text-sm text-slate-500">{group.suggestedAction}</p>
                    ) : null}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/clientes-360/${group.customerId}`}>
                      Ver abonado
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}

      {detail.groups.some(
        (group) => !group.hasError && (group.warningMessage || group.requiresReview)
      ) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-amber-800">Advertencias</CardTitle>
            <CardDescription>No bloquean la confirmación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-800">
            {detail.groups
              .filter((group) => group.warningMessage || group.requiresReview)
              .slice(0, 20)
              .map((group) => (
                <p key={`warn-${group.customerId}`}>
                  {group.customerName}: {group.warningMessage || "Requiere revisión"}
                </p>
              ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={view === "all" ? "default" : "outline"}
          onClick={() => setView("all")}
        >
          Todos
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === "errors" ? "default" : "outline"}
          onClick={() => setView("errors")}
        >
          Errores
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Abonado</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Conceptos</TableHead>
              <TableHead>Importe</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                  No hay precomprobantes en esta vista.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <TableRow
                  key={group.customerId}
                  className="cursor-pointer"
                  onClick={() => setPreview(group)}
                >
                  <TableCell className="font-medium">{group.customerName}</TableCell>
                  <TableCell>
                    {group.documentType
                      ? ISP_BILLING_DOCUMENT_TYPE_LABELS[group.documentType]
                      : "—"}
                  </TableCell>
                  <TableCell>{group.concepts.length}</TableCell>
                  <TableCell>{formatBillingMoney(group.totalAmount)}</TableCell>
                  <TableCell>
                    {preinvoiceStatus(group, detail.run.status)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(preview)} onOpenChange={() => setPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {preview?.documentType
                ? ISP_BILLING_DOCUMENT_TYPE_LABELS[preview.documentType]
                : "Precomprobante"}
            </DialogTitle>
            <DialogDescription>
              {preview?.customerName} · {billingPeriodTitle(period)} ·{" "}
              {preview ? preinvoiceStatus(preview, detail.run.status) : ""}
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="space-y-2 text-sm">
              {preview.concepts.map((concept, index) => (
                <div key={`${concept.serviceId}-${index}`} className="flex justify-between gap-3">
                  <span>{concept.description}</span>
                  <span className="font-medium">{formatBillingMoney(concept.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold">
                <span>Total</span>
                <span>{formatBillingMoney(preview.totalAmount)}</span>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/clientes-360/${preview.customerId}`}>Ver abonado</Link>
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar facturación</DialogTitle>
            <DialogDescription>
              Vas a generar {detail.run.totalDocuments} comprobantes por un total de{" "}
              {formatBillingMoney(detail.run.totalAmount)}. Esta acción creará los
              comprobantes del período seleccionado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Volver a revisar
            </Button>
            <Button type="button" onClick={() => void confirm()} disabled={working}>
              Confirmar facturación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
