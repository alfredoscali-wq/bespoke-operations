"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Search, Trash2 } from "lucide-react"

import { IspBillingDocumentPreview } from "@/components/isp/isp-billing-document-preview"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  ISP_BILLING_DOCUMENT_TYPE_LABELS,
  ISP_BILLING_DOCUMENT_TYPES,
} from "@/lib/isp/billing-constants"
import { formatCuit } from "@/lib/isp/billing-integrity"
import {
  calculateBillingTotals,
  emptyDocumentItemDraft,
  formatBillingMoney,
  suggestedServiceConcept,
  todayIsoDate,
  vatConditionLabel,
} from "@/lib/isp/billing-document-integrity"
import type {
  IspBillingCustomerOption,
  IspBillingDocument,
  IspBillingDocumentItemDraft,
  IspBillingIssueContext,
  IspBillingServiceOption,
} from "@/lib/isp/billing-document-types"
import { canWriteIspBilling } from "@/lib/isp/permissions"
import { useAuth } from "@/components/auth/auth-provider"

function buildPreviewDocument(input: {
  documentType: string
  issueDate: string
  dueDate: string
  observations: string
  customer: IspBillingCustomerOption | null
  context: IspBillingIssueContext | null
  items: IspBillingDocumentItemDraft[]
}): IspBillingDocument | null {
  if (!input.context || !input.customer) return null
  const totals = calculateBillingTotals(
    input.items.map((item) => ({
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      discount: Number(item.discount) || 0,
    }))
  )
  const snapshot = input.customer.snapshot
  return {
    id: "preview",
    companyId: "",
    billingCompanySettingsId: "",
    pointOfSaleId: input.context.pointOfSaleId,
    documentType: input.documentType as IspBillingDocument["documentType"],
    status: "draft",
    authorizationStatus: "not_required",
    issueDate: input.issueDate,
    dueDate: input.dueDate || null,
    number: null,
    formattedNumber: null,
    customerId: input.customer.id,
    subscriberId: input.customer.subscriberId,
    customerNameSnapshot: snapshot.name,
    customerDocumentTypeSnapshot: snapshot.documentType,
    customerDocumentNumberSnapshot: snapshot.documentNumber,
    customerTaxIdSnapshot: snapshot.taxId,
    customerVatConditionSnapshot: snapshot.vatCondition,
    customerTaxAddressSnapshot: snapshot.taxAddress,
    customerCitySnapshot: snapshot.city,
    customerProvinceSnapshot: snapshot.province,
    customerPostalCodeSnapshot: snapshot.postalCode,
    customerEmailSnapshot: snapshot.email,
    issuerLegalNameSnapshot: input.context.issuerLegalName,
    issuerTaxIdSnapshot: input.context.issuerTaxId,
    issuerVatConditionSnapshot: input.context.issuerVatCondition,
    issuerTaxAddressSnapshot: input.context.issuerTaxAddress,
    issuerCitySnapshot: input.context.issuerCity,
    issuerProvinceSnapshot: input.context.issuerProvince,
    issuerPostalCodeSnapshot: input.context.issuerPostalCode,
    issuerPhoneSnapshot: "",
    issuerEmailSnapshot: "",
    issuerWebsiteSnapshot: "",
    issuerLogoUrlSnapshot: input.context.issuerLogoUrl,
    pointOfSaleNumber: input.context.pointOfSaleNumber,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    observations: input.observations,
    cae: null,
    caeExpiresAt: null,
    billingRunId: null,
    periodYear: null,
    periodMonth: null,
    createdAt: "",
    updatedAt: "",
    items: totals.lines.map((line, index) => ({
      id: `preview-${index}`,
      companyId: "",
      documentId: "preview",
      serviceId: input.items[index]?.serviceId ?? null,
      description: String(input.items[index]?.description ?? ""),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount,
      taxableBase: line.taxableBase,
      taxAmount: line.taxAmount,
      taxType: "",
      taxRate: line.taxRate,
      lineTotal: line.lineTotal,
      sortOrder: index,
    })),
    events: [],
  }
}

export function IspBillingDocumentFormScreen({
  documentId,
}: {
  documentId?: string
}) {
  const router = useRouter()
  const { sessionUser } = useAuth()
  const canWrite = canWriteIspBilling(sessionUser)
  const [context, setContext] = useState<IspBillingIssueContext | null>(null)
  const [documentType, setDocumentType] = useState("factura_b")
  const [issueDate, setIssueDate] = useState(todayIsoDate())
  const [dueDate, setDueDate] = useState("")
  const [observations, setObservations] = useState("")
  const [items, setItems] = useState<IspBillingDocumentItemDraft[]>([
    emptyDocumentItemDraft(),
  ])
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<IspBillingCustomerOption[]>([])
  const [customer, setCustomer] = useState<IspBillingCustomerOption | null>(null)
  const [services, setServices] = useState<IspBillingServiceOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    fetch("/api/isp/billing/documents/context")
      .then(async (response) => {
        const payload = (await response.json()) as {
          context?: IspBillingIssueContext
          message?: string
        }
        if (!response.ok) throw new Error(payload.message)
        setContext(payload.context ?? null)
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "No se pudo cargar el emisor."
        )
      )
  }, [])

  useEffect(() => {
    if (!documentId) return
    fetch(`/api/isp/billing/documents/${documentId}`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          document?: IspBillingDocument
          message?: string
        }
        if (!response.ok || !payload.document) {
          throw new Error(payload.message || "No se pudo cargar el comprobante.")
        }
        const doc = payload.document
        setDocumentType(doc.documentType)
        setIssueDate(doc.issueDate)
        setDueDate(doc.dueDate ?? "")
        setObservations(doc.observations)
        setItems(
          doc.items.length
            ? doc.items.map((item) => ({
                id: item.id,
                serviceId: item.serviceId,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
              }))
            : [emptyDocumentItemDraft()]
        )
        setCustomer({
          id: doc.customerId,
          subscriberId: doc.subscriberId,
          name: doc.customerNameSnapshot,
          dni: doc.customerDocumentNumberSnapshot,
          customerNumber: "",
          email: doc.customerEmailSnapshot,
          address: doc.customerTaxAddressSnapshot,
          locality: doc.customerCitySnapshot,
          snapshot: {
            name: doc.customerNameSnapshot,
            documentType: doc.customerDocumentTypeSnapshot,
            documentNumber: doc.customerDocumentNumberSnapshot,
            taxId: doc.customerTaxIdSnapshot,
            vatCondition: doc.customerVatConditionSnapshot,
            taxAddress: doc.customerTaxAddressSnapshot,
            city: doc.customerCitySnapshot,
            province: doc.customerProvinceSnapshot,
            postalCode: doc.customerPostalCodeSnapshot,
            email: doc.customerEmailSnapshot,
          },
        })
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "No se pudo cargar el comprobante."
        )
      )
  }, [documentId])

  useEffect(() => {
    if (query.trim().length < 2) {
      setMatches([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetch(`/api/isp/billing/documents/customers?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            items?: IspBillingCustomerOption[]
          }
          setMatches(payload.items ?? [])
        })
        .catch(() => undefined)
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    if (!customer?.id) {
      setServices([])
      return
    }
    fetch(`/api/isp/billing/documents/customers/${customer.id}/services`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          items?: IspBillingServiceOption[]
        }
        setServices(payload.items ?? [])
      })
      .catch(() => setServices([]))
  }, [customer?.id])

  const totals = useMemo(
    () =>
      calculateBillingTotals(
        items.map((item) => ({
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          discount: Number(item.discount) || 0,
        }))
      ),
    [items]
  )

  const preview = useMemo(
    () =>
      buildPreviewDocument({
        documentType,
        issueDate,
        dueDate,
        observations,
        customer,
        context,
        items,
      }),
    [documentType, issueDate, dueDate, observations, customer, context, items]
  )

  async function saveDraft() {
    if (!canWrite) return
    setSaving(true)
    setError("")
    const payload = {
      documentType,
      customerId: customer?.id ?? "",
      subscriberId: customer?.subscriberId,
      issueDate,
      dueDate: dueDate || null,
      observations,
      items,
    }
    try {
      const response = await fetch(
        documentId
          ? `/api/isp/billing/documents/${documentId}`
          : "/api/isp/billing/documents",
        {
          method: documentId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const body = (await response.json()) as {
        success?: boolean
        message?: string
        document?: IspBillingDocument
      }
      if (!response.ok || !body.document) {
        throw new Error(body.message || "No se pudo guardar el comprobante.")
      }
      router.push(`/facturacion/comprobantes/${body.document.id}`)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo guardar el comprobante."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
          Administración → Facturación → Comprobantes
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-800">
          {documentId ? "Editar comprobante" : "Nuevo comprobante"}
        </h1>
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {context && !context.companyReady ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {context.missing.join(" · ")} Completá la configuración fiscal antes de
          emitir.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Emisor</CardTitle>
          <CardDescription>Empresa facturadora de esta instalación. No se puede cambiar aquí.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-slate-400">Emite: </span>
            {context?.issuerLegalName || "—"}
          </p>
          <p>CUIT {formatCuit(context?.issuerTaxId ?? "") || "—"}</p>
          <p>{vatConditionLabel(context?.issuerVatCondition)}</p>
          <p>
            Punto de venta:{" "}
            {context?.pointOfSaleNumber
              ? String(context.pointOfSaleNumber).padStart(4, "0")
              : "—"}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tipo de comprobante</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISP_BILLING_DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ISP_BILLING_DOCUMENT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fechas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="issue-date">Fecha del comprobante</Label>
              <Input
                id="issue-date"
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="due-date">Fecha de vencimiento</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cliente / Abonado</CardTitle>
          <CardDescription>
            Buscá por nombre, DNI, CUIT, código o N° de abonado. Los datos fiscales se
            toman del cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente o abonado"
              className="pl-8"
            />
          </div>
          {matches.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {matches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full flex-col items-start gap-0.5 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                  onClick={() => {
                    setCustomer(item)
                    setQuery("")
                    setMatches([])
                  }}
                >
                  <span className="text-sm font-medium text-slate-800">{item.name}</span>
                  <span className="text-xs text-slate-500">
                    {[item.dni, item.customerNumber, item.email].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {customer ? (
            <div className="rounded-lg bg-slate-50 px-3 py-3 text-sm">
              <p className="font-medium text-slate-800">{customer.snapshot.name}</p>
              <p className="text-slate-500">
                {customer.snapshot.documentType.toUpperCase()}{" "}
                {customer.snapshot.documentNumber || "—"}
              </p>
              {customer.snapshot.vatCondition ? (
                <p className="text-slate-500">
                  {vatConditionLabel(customer.snapshot.vatCondition)}
                </p>
              ) : null}
              <p className="text-slate-500">
                {[customer.snapshot.taxAddress, customer.snapshot.city]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
              {customer.snapshot.email ? (
                <p className="text-slate-500">{customer.snapshot.email}</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Conceptos</CardTitle>
            <CardDescription>
              El total se calcula desde las líneas. No se puede escribir un total libre.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((current) => [...current, emptyDocumentItemDraft()])}
          >
            <Plus className="size-4" />
            Concepto
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {services.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Servicios del abonado
              </p>
              <div className="flex flex-wrap gap-2">
                {services.map((service) => (
                  <Button
                    key={service.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setItems((current) => [
                        ...current.filter(
                          (item) =>
                            String(item.description).trim() ||
                            Number(item.unitPrice) > 0
                        ),
                        {
                          description: suggestedServiceConcept(service),
                          quantity: 1,
                          unitPrice: service.monthlyFee ?? 0,
                          discount: 0,
                          serviceId: service.id,
                        },
                      ])
                    }
                  >
                    {service.catalogCode || service.planName}
                    {service.monthlyFee != null
                      ? ` · ${formatBillingMoney(service.monthlyFee)}`
                      : ""}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {items.map((item, index) => (
            <div
              key={`${item.id ?? "new"}-${index}`}
              className="grid gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-[1fr_90px_120px_110px_auto]"
            >
              <Input
                value={String(item.description)}
                placeholder="Descripción"
                aria-label={`Descripción del concepto ${index + 1}`}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, description: event.target.value }
                        : row
                    )
                  )
                }
              />
              <Input
                inputMode="decimal"
                value={String(item.quantity)}
                placeholder="Cantidad"
                aria-label={`Cantidad del concepto ${index + 1}`}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, quantity: event.target.value }
                        : row
                    )
                  )
                }
              />
              <Input
                inputMode="decimal"
                value={String(item.unitPrice)}
                placeholder="Precio"
                aria-label={`Precio unitario del concepto ${index + 1}`}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, unitPrice: event.target.value }
                        : row
                    )
                  )
                }
              />
              <Input
                inputMode="decimal"
                value={String(item.discount ?? 0)}
                placeholder="Descuento"
                aria-label={`Descuento del concepto ${index + 1}`}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index
                        ? { ...row, discount: event.target.value }
                        : row
                    )
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  setItems((current) =>
                    current.length === 1
                      ? [emptyDocumentItemDraft()]
                      : current.filter((_, rowIndex) => rowIndex !== index)
                  )
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          <dl className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-slate-500">
              <dt>Subtotal</dt>
              <dd>{formatBillingMoney(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-slate-500">
              <dt>Descuentos</dt>
              <dd>{formatBillingMoney(totals.discountTotal)}</dd>
            </div>
            <div className="flex justify-between text-slate-500">
              <dt>Impuestos</dt>
              <dd>{formatBillingMoney(totals.taxTotal)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
              <dt>Total</dt>
              <dd>{formatBillingMoney(totals.total)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            placeholder="Texto opcional para el comprobante"
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void saveDraft()} disabled={!canWrite || saving}>
          {saving ? "Guardando…" : "Guardar borrador"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPreviewOpen(true)}
          disabled={!preview}
        >
          Vista previa
        </Button>
        <Button asChild variant="ghost">
          <Link href="/facturacion/comprobantes">Cancelar</Link>
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Vista previa</DialogTitle>
          </DialogHeader>
          {preview ? <IspBillingDocumentPreview document={preview} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
