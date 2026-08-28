"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Eye, FileText, Plus, Search, Trash2 } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { IspTonedStatusBadge } from "@/components/isp/isp-status-badges"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ISP_BILLING_DOCUMENT_DELETE_CONFIRM_DESCRIPTION,
  ISP_BILLING_DOCUMENT_DELETE_CONFIRM_TITLE,
  ISP_BILLING_DOCUMENT_DELETED_MESSAGE,
  ISP_BILLING_DOCUMENTS_EMPTY_DESCRIPTION,
  ISP_BILLING_DOCUMENTS_EMPTY_TITLE,
  ISP_BILLING_DOCUMENTS_SUBTITLE,
  ISP_BILLING_DOCUMENTS_TITLE,
  ISP_BILLING_DOCUMENT_TYPE_LABELS,
  ISP_BILLING_DOCUMENT_TYPES,
} from "@/lib/isp/billing-constants"
import {
  displayBillingDocumentStatus,
  documentTypeLabel,
  formatBillingMoney,
} from "@/lib/isp/billing-document-integrity"
import type { IspBillingDocumentListItem, IspBillingIssueContext } from "@/lib/isp/billing-document-types"
import { formatDateOnly } from "@/lib/dates/date-only"
import { canDeleteIspBillingDocument } from "@/lib/isp/permissions"

const STATUS_FILTERS = [
  { value: "all", label: "Todos los estados" },
  { value: "draft", label: "Borrador" },
  { value: "issued", label: "Emitido" },
  { value: "cancelled", label: "Anulado" },
]

export function IspBillingDocumentsListScreen() {
  const { sessionUser } = useAuth()
  const canDelete = canDeleteIspBillingDocument(sessionUser)

  const [items, setItems] = useState<IspBillingDocumentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [documentType, setDocumentType] = useState("all")
  const [status, setStatus] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [pointOfSaleId, setPointOfSaleId] = useState("all")
  const [pointOfSaleOptions, setPointOfSaleOptions] = useState<
    Array<{ id: string; label: string }>
  >([])
  const [reloadKey, setReloadKey] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<IspBillingDocumentListItem | null>(
    null
  )
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackVariant, setFeedbackVariant] = useState<"success" | "error">(
    "success"
  )

  useEffect(() => {
    fetch("/api/isp/billing/documents/context")
      .then(async (response) => {
        const payload = (await response.json()) as {
          context?: IspBillingIssueContext
        }
        if (!payload.context?.pointOfSaleId) return
        setPointOfSaleOptions([
          {
            id: payload.context.pointOfSaleId,
            label: String(payload.context.pointOfSaleNumber).padStart(4, "0"),
          },
        ])
      })
      .catch(() => undefined)
  }, [])

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set("search", search.trim())
    if (documentType !== "all") params.set("documentType", documentType)
    if (status !== "all") params.set("status", status)
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    if (pointOfSaleId !== "all") params.set("pointOfSaleId", pointOfSaleId)
    return params.toString()
  }, [search, documentType, status, dateFrom, dateTo, pointOfSaleId])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/isp/billing/documents${query ? `?${query}` : ""}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          success?: boolean
          items?: IspBillingDocumentListItem[]
          message?: string
        }
        if (!response.ok || payload.success === false) {
          throw new Error(payload.message || "No se pudieron cargar los comprobantes.")
        }
        setItems(payload.items ?? [])
        setError("")
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setError(
          cause instanceof Error ? cause.message : "No se pudieron cargar los comprobantes."
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [query, reloadKey])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const response = await fetch(
        `/api/isp/billing/documents/${deleteTarget.id}`,
        { method: "DELETE" }
      )
      const payload = (await response.json()) as {
        success?: boolean
        message?: string
      }
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "No se pudo eliminar el comprobante.")
      }
      setDeleteTarget(null)
      setFeedback(payload.message ?? ISP_BILLING_DOCUMENT_DELETED_MESSAGE)
      setFeedbackVariant("success")
      setReloadKey((value) => value + 1)
    } catch (cause) {
      setFeedback(
        cause instanceof Error ? cause.message : "No se pudo eliminar el comprobante."
      )
      setFeedbackVariant("error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
            Administración → Facturación → Comprobantes
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-800">
            {ISP_BILLING_DOCUMENTS_TITLE}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {ISP_BILLING_DOCUMENTS_SUBTITLE}
          </p>
        </div>
        <Button asChild>
          <Link href="/facturacion/comprobantes/nuevo">
            <Plus className="size-4" />
            Nuevo comprobante
          </Link>
        </Button>
      </div>

      {feedback ? (
        <EntityActionFeedback message={feedback} variant={feedbackVariant} />
      ) : null}

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar cliente / abonado"
            className="pl-8"
          />
        </div>
        <Select value={documentType} onValueChange={setDocumentType}>
          <SelectTrigger>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {ISP_BILLING_DOCUMENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {ISP_BILLING_DOCUMENT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={pointOfSaleId} onValueChange={setPointOfSaleId}>
          <SelectTrigger>
            <SelectValue placeholder="Punto de venta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los PV</SelectItem>
            {pointOfSaleOptions.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                PV {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          aria-label="Fecha desde"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          aria-label="Fecha hasta"
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-16 text-center">
          <FileText className="mx-auto size-8 text-slate-300" />
          <p className="mt-3 text-base font-semibold text-slate-800">
            {ISP_BILLING_DOCUMENTS_EMPTY_TITLE}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {ISP_BILLING_DOCUMENTS_EMPTY_DESCRIPTION}
          </p>
          <Button asChild className="mt-4">
            <Link href="/facturacion/comprobantes/nuevo">
              <Plus className="size-4" />
              Nuevo comprobante
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente / Abonado</TableHead>
                  <TableHead>CUIT/DNI</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const display = displayBillingDocumentStatus(item)
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        {formatDateOnly(item.issueDate, { locale: "es-AR" })}
                      </TableCell>
                      <TableCell>{documentTypeLabel(item.documentType)}</TableCell>
                      <TableCell>{item.formattedNumber ?? "Sin número"}</TableCell>
                      <TableCell className="font-medium">
                        {item.customerNameSnapshot}
                      </TableCell>
                      <TableCell>
                        {item.customerTaxIdSnapshot ||
                          item.customerDocumentNumberSnapshot ||
                          "—"}
                      </TableCell>
                      <TableCell>{formatBillingMoney(item.total)}</TableCell>
                      <TableCell>
                        <IspTonedStatusBadge tone={display.tone}>
                          {display.label}
                        </IspTonedStatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/facturacion/comprobantes/${item.id}`}>
                              <Eye className="size-4" />
                              Ver
                            </Link>
                          </Button>
                          {canDelete ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(item)}
                              aria-label="Eliminar comprobante"
                            >
                              <Trash2 className="size-4" />
                              Eliminar
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {items.map((item) => {
              const display = displayBillingDocumentStatus(item)
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {item.customerNameSnapshot}
                      </p>
                      <p className="text-xs text-slate-500">
                        {documentTypeLabel(item.documentType)} ·{" "}
                        {item.formattedNumber ?? "Sin número"}
                      </p>
                    </div>
                    <IspTonedStatusBadge tone={display.tone}>
                      {display.label}
                    </IspTonedStatusBadge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      {formatDateOnly(item.issueDate, { locale: "es-AR" })}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatBillingMoney(item.total)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/facturacion/comprobantes/${item.id}`}>
                        <Eye className="size-4" />
                        Ver
                      </Link>
                    </Button>
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ISP_BILLING_DOCUMENT_DELETE_CONFIRM_TITLE}</DialogTitle>
            <DialogDescription>
              {ISP_BILLING_DOCUMENT_DELETE_CONFIRM_DESCRIPTION}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
