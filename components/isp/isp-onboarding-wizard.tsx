"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
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
  filterConnectionTypesForCatalog,
  snapshotServiceFromCatalog,
  suggestConnectionTypeFromCatalogAndOt,
} from "@/lib/isp/catalog-integrity"
import type { IspCatalogItem } from "@/lib/isp/catalog-types"
import {
  ISP_COMMERCIAL_STATUSES,
  ISP_CONNECTION_TYPES,
  ISP_TECHNICAL_STATUSES,
  ISP_TECHNOLOGIES,
} from "@/lib/isp/constants"
import { connectionFieldsForType } from "@/lib/isp/integrity"
import {
  ISP_COMMERCIAL_STATUS_LABELS,
  ISP_CONNECTION_TYPE_LABELS,
  ISP_TECHNICAL_STATUS_LABELS,
  formatIspTechnologyLabel,
} from "@/lib/isp/labels"
import type {
  IspConnectionDraft,
  IspCustomerDraft,
  IspExistingCustomerMatch,
  IspOnboardingResult,
  IspOtPrefill,
  IspServiceDraft,
} from "@/lib/isp/types"

const EMPTY_CUSTOMER: IspCustomerDraft = {
  name: "",
  dni: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  locality: "",
  notes: "",
}

const EMPTY_SERVICE: IspServiceDraft = {
  catalogId: "",
  technology: "",
  planName: "",
  contractedSpeed: "",
  monthlyFee: "",
  activationDate: "",
  commercialStatus: "pending_activation",
  monthlyCollectionMethod: "pending",
}

const EMPTY_CONNECTION: IspConnectionDraft = {
  connectionType: "",
  pppoeUsername: "",
  pppoePassword: "",
  technicalProfile: "",
  ipAddress: "",
  prefixLength: "",
  gateway: "",
  vlan: "",
  coreName: "",
  technicalStatus: "pending_provision",
}

export function IspOnboardingWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const existingCustomerId = searchParams.get("customerId")
  const sourceTaskId = searchParams.get("taskId")

  const [step, setStep] = useState(0)
  const [includeService, setIncludeService] = useState(true)
  const [includeConnection, setIncludeConnection] = useState(true)
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER)
  const [service, setService] = useState(EMPTY_SERVICE)
  const [connection, setConnection] = useState(EMPTY_CONNECTION)
  const [prefill, setPrefill] = useState<IspOtPrefill | null>(null)
  const [catalogItems, setCatalogItems] = useState<IspCatalogItem[]>([])
  const [existingMatch, setExistingMatch] =
    useState<IspExistingCustomerMatch | null>(null)
  const [reuseExisting, setReuseExisting] = useState(Boolean(existingCustomerId))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/isp/catalog?status=active")
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          items?: IspCatalogItem[]
        }
        if (body.items) setCatalogItems(body.items)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!sourceTaskId) return
    fetch(`/api/isp/tasks/${sourceTaskId}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          prefill?: IspOtPrefill
        }
        if (!body.prefill) return
        setPrefill(body.prefill)
        setCustomer((current) => ({ ...current, ...body.prefill!.customer }))
        setService((current) => ({ ...current, ...body.prefill!.service }))
        setConnection((current) => ({
          ...current,
          ...body.prefill!.connection,
          pppoeUsername: body.prefill!.connection.pppoeUsername ?? "",
        }))
        if (body.prefill.customer.existingCustomer) {
          setExistingMatch(body.prefill.customer.existingCustomer)
        }
      })
      .catch(() => undefined)
  }, [sourceTaskId])

  const selectedCatalog = catalogItems.find((item) => item.id === service.catalogId)
  const allowedConnectionTypes = filterConnectionTypesForCatalog(
    selectedCatalog?.allowedConnectionTypes,
    ISP_CONNECTION_TYPES
  )
  const fields = connectionFieldsForType(connection.connectionType)
  const otOneOffAmount =
    prefill?.otAmountToCollect ?? prefill?.otInstallationAmount ?? null
  const ipFromOt = Boolean(prefill?.fromOt.ipAddress)

  useEffect(() => {
    const catalogId = service.catalogId || prefill?.service.catalogId
    if (!catalogId) return
    if (catalogItems.some((item) => item.id === catalogId)) return
    fetch(`/api/isp/catalog/${catalogId}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          item?: IspCatalogItem
        }
        if (!body.item) return
        setCatalogItems((current) =>
          current.some((item) => item.id === body.item!.id)
            ? current
            : [...current, body.item!]
        )
      })
      .catch(() => undefined)
  }, [catalogItems, prefill?.service.catalogId, service.catalogId])

  const steps = useMemo(() => {
    const items = ["Cliente"]
    if (includeService) items.push("Servicio")
    if (includeService && includeConnection) items.push("Conexión")
    items.push("Confirmación")
    return items
  }, [includeConnection, includeService])

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    const response = await fetch("/api/isp/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reuseExistingCustomer: reuseExisting,
        existingCustomerId: existingMatch?.id ?? existingCustomerId,
        includeService,
        includeConnection: includeService && includeConnection,
        sourceTaskId,
        customer,
        service,
        connection,
      }),
    })
    const body = (await response.json()) as {
      success: boolean
      result?: IspOnboardingResult
      message?: string
    }
    setSaving(false)

    if (body.result?.requiresConfirmation && body.result.existingCustomer) {
      setExistingMatch(body.result.existingCustomer)
      setError("Cliente existente encontrado. Confirme si desea reutilizarlo.")
      setStep(0)
      return
    }

    if (!body.success || !body.result?.customerId) {
      setError(body.message ?? "No se pudo crear el alta.")
      return
    }

    router.push(`/clientes-360/${body.result.customerId}`)
  }

  function applyCatalogItem(item: IspCatalogItem) {
    const snapshot = snapshotServiceFromCatalog(item)
    setService((current) => ({
      ...current,
      catalogId: snapshot.catalogId,
      planName: snapshot.planName,
      technology: snapshot.technology,
      contractedSpeed: snapshot.contractedSpeed,
      monthlyFee: snapshot.monthlyFee,
      monthlyCollectionMethod: snapshot.monthlyCollectionMethod,
    }))
    setConnection((current) => {
      const nextType = suggestConnectionTypeFromCatalogAndOt({
        technology: snapshot.technology,
        installationIp: current.ipAddress || prefill?.otInstallationIp,
        allowedConnectionTypes: snapshot.allowedConnectionTypes,
      })
      const allowed = filterConnectionTypesForCatalog(
        snapshot.allowedConnectionTypes,
        ISP_CONNECTION_TYPES
      )
      const connectionType =
        nextType ||
        (current.connectionType && allowed.includes(current.connectionType)
          ? current.connectionType
          : "")
      return {
        ...current,
        connectionType,
        pppoeUsername: connectionType === "pppoe" ? current.pppoeUsername : "",
        pppoePassword: connectionType === "pppoe" ? current.pppoePassword : "",
      }
    })
    if (!item.requiresConnection) {
      setIncludeConnection(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {existingCustomerId ? "Nuevo servicio" : "Nuevo cliente ISP"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Flujo único: cliente → servicio → conexión → confirmación.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {steps.map((label, index) => (
          <span
            key={label}
            className={
              index === step
                ? "rounded-full bg-foreground px-3 py-1 text-background"
                : "rounded-full bg-muted px-3 py-1"
            }
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {prefill ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
          <p className="font-medium">
            Datos provenientes de la OT {prefill.taskCode}
          </p>
          <p className="mt-1 text-muted-foreground">
            {[
              prefill.fromOt.customer ? "Cliente" : null,
              prefill.fromOt.technology ? "Tecnología" : null,
              prefill.fromOt.plan ? "Plan" : null,
              prefill.fromOt.address ? "Domicilio" : null,
              prefill.fromOt.ipAddress ? "IP de instalación" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Sin datos comerciales precargados"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            El medio de pago de la OT ({prefill.otPaymentMethod || "—"}) no se
            copia como medio de cobranza mensual. El abono queda en Pendiente /
            SIRO.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            El importe a cobrar de la OT
            {otOneOffAmount != null
              ? ` ($${otOneOffAmount.toLocaleString("es-AR")})`
              : ""}{" "}
            es un cobro puntual y no se copia como precio del abono mensual.
            {!prefill.fromOt.monthlyFee
              ? " Precio del abono pendiente de carga."
              : ""}
          </p>
          {prefill.missingFields.length > 0 ? (
            <p className="mt-2 text-xs">
              Faltantes: {prefill.missingFields.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {existingMatch ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium">Cliente existente encontrado</p>
          <p>
            {existingMatch.name} · {existingMatch.dni || "sin documento"}
          </p>
          <Button
            className="mt-2"
            size="sm"
            type="button"
            onClick={() => setReuseExisting(true)}
          >
            Usar este cliente
          </Button>
        </div>
      ) : null}

      {step === 0 ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre / Razón social">
            <Input
              value={customer.name}
              onChange={(event) =>
                setCustomer({ ...customer, name: event.target.value })
              }
            />
          </Field>
          <Field label="DNI / CUIT">
            <Input
              value={customer.dni}
              onChange={(event) =>
                setCustomer({ ...customer, dni: event.target.value })
              }
            />
          </Field>
          <Field label="Teléfono">
            <Input
              value={customer.phone}
              onChange={(event) =>
                setCustomer({ ...customer, phone: event.target.value })
              }
            />
          </Field>
          <Field label="WhatsApp">
            <Input
              value={customer.whatsapp}
              onChange={(event) =>
                setCustomer({ ...customer, whatsapp: event.target.value })
              }
            />
          </Field>
          <Field label="Email">
            <Input
              value={customer.email}
              onChange={(event) =>
                setCustomer({ ...customer, email: event.target.value })
              }
            />
          </Field>
          <Field label="Localidad">
            <Input
              value={customer.locality}
              onChange={(event) =>
                setCustomer({ ...customer, locality: event.target.value })
              }
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Domicilio">
              <Input
                value={customer.address}
                onChange={(event) =>
                  setCustomer({ ...customer, address: event.target.value })
                }
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Observaciones">
              <Textarea
                value={customer.notes}
                onChange={(event) =>
                  setCustomer({ ...customer, notes: event.target.value })
                }
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={includeService}
              onChange={(event) => {
                setIncludeService(event.target.checked)
                if (!event.target.checked) setIncludeConnection(false)
              }}
            />
            Crear también un servicio
          </label>
        </section>
      ) : null}

      {steps[step] === "Servicio" ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Servicio del catálogo">
            <Select
              value={service.catalogId || undefined}
              onValueChange={(value) => {
                const item = catalogItems.find((entry) => entry.id === value)
                if (item) applyCatalogItem(item)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar servicio" />
              </SelectTrigger>
              <SelectContent>
                {catalogItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tecnología">
            <Select
              value={service.technology || undefined}
              onValueChange={(value) =>
                setService({
                  ...service,
                  technology: value as IspServiceDraft["technology"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="No aplica" />
              </SelectTrigger>
              <SelectContent>
                {ISP_TECHNOLOGIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {formatIspTechnologyLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Plan">
            <Input
              value={service.planName}
              onChange={(event) =>
                setService({ ...service, planName: event.target.value })
              }
            />
          </Field>
          <Field label="Velocidad contratada">
            <Input
              value={service.contractedSpeed}
              onChange={(event) =>
                setService({ ...service, contractedSpeed: event.target.value })
              }
            />
          </Field>
          <Field
            label="Precio del abono"
            hint={
              prefill && !prefill.fromOt.monthlyFee
                ? "Pendiente de carga. El importe a cobrar de la OT no es el precio mensual del abono."
                : undefined
            }
          >
            <Input
              value={service.monthlyFee}
              placeholder="Pendiente de carga"
              onChange={(event) =>
                setService({ ...service, monthlyFee: event.target.value })
              }
            />
          </Field>
          <Field label="Fecha de alta">
            <Input
              type="date"
              value={service.activationDate}
              onChange={(event) =>
                setService({ ...service, activationDate: event.target.value })
              }
            />
          </Field>
          <Field label="Estado comercial">
            <Select
              value={service.commercialStatus}
              onValueChange={(value) =>
                setService({
                  ...service,
                  commercialStatus: value as IspServiceDraft["commercialStatus"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISP_COMMERCIAL_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ISP_COMMERCIAL_STATUS_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Medio de cobranza mensual">
            <Input value="Pendiente · SIRO (futuro)" disabled />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={includeConnection}
              onChange={(event) => setIncludeConnection(event.target.checked)}
            />
            Crear también una conexión técnica
          </label>
        </section>
      ) : null}

      {steps[step] === "Conexión" ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo de conexión">
            <Select
              value={connection.connectionType || undefined}
              onValueChange={(value) =>
                setConnection({
                  ...connection,
                  connectionType: value as IspConnectionDraft["connectionType"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {allowedConnectionTypes.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ISP_CONNECTION_TYPE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {fields.showPppoe ? (
            <>
              <Field label="Usuario PPPoE">
                <Input
                  value={connection.pppoeUsername}
                  onChange={(event) =>
                    setConnection({
                      ...connection,
                      pppoeUsername: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Contraseña">
                <Input
                  type="password"
                  value={connection.pppoePassword}
                  onChange={(event) =>
                    setConnection({
                      ...connection,
                      pppoePassword: event.target.value,
                    })
                  }
                />
              </Field>
            </>
          ) : null}
          {fields.showStaticIp ? (
            <>
              <Field
                label="IP"
                hint={ipFromOt ? "IP proveniente de la OT" : undefined}
              >
                <Input
                  value={connection.ipAddress}
                  onChange={(event) =>
                    setConnection({
                      ...connection,
                      ipAddress: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Prefijo / máscara">
                <Input
                  value={connection.prefixLength}
                  onChange={(event) =>
                    setConnection({
                      ...connection,
                      prefixLength: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Gateway">
                <Input
                  value={connection.gateway}
                  onChange={(event) =>
                    setConnection({
                      ...connection,
                      gateway: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="VLAN">
                <Input
                  value={connection.vlan}
                  onChange={(event) =>
                    setConnection({ ...connection, vlan: event.target.value })
                  }
                />
              </Field>
              <Field label="Perfil técnico">
                <Input
                  value={connection.technicalProfile}
                  onChange={(event) =>
                    setConnection({
                      ...connection,
                      technicalProfile: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Core / MikroTik">
                <Input
                  value={connection.coreName}
                  onChange={(event) =>
                    setConnection({
                      ...connection,
                      coreName: event.target.value,
                    })
                  }
                />
              </Field>
            </>
          ) : null}
          <Field label="Estado técnico">
            <Select
              value={connection.technicalStatus}
              onValueChange={(value) =>
                setConnection({
                  ...connection,
                  technicalStatus:
                    value as IspConnectionDraft["technicalStatus"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISP_TECHNICAL_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ISP_TECHNICAL_STATUS_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </section>
      ) : null}

      {steps[step] === "Confirmación" ? (
        <section className="space-y-3 rounded-xl border border-border/70 p-4 text-sm">
          <p>
            <strong>CLIENTE</strong>
            <br />
            {customer.name || "—"}
          </p>
          {includeService ? (
            <p>
              <strong>SERVICIO</strong>
              <br />
              {formatIspTechnologyLabel(service.technology)} · {service.planName || "—"} ·{" "}
              {service.monthlyFee
                ? `$${service.monthlyFee} / mes`
                : "Precio del abono pendiente de carga"}
            </p>
          ) : (
            <p>Se creará el cliente sin servicio ni conexión.</p>
          )}
          {includeService && includeConnection ? (
            <p>
              <strong>CONEXIÓN</strong>
              <br />
              {connection.connectionType || "—"} ·{" "}
              {connection.ipAddress
                ? `${connection.ipAddress}${
                    ipFromOt ? " (IP proveniente de la OT)" : ""
                  }`
                : connection.pppoeUsername || "sin usuario/IP"}{" "}
              · Core {connection.coreName || "—"}
            </p>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || saving}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
        >
          Atrás
        </Button>
        {steps[step] === "Confirmación" ? (
          <Button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmit()}
          >
            {saving ? "Creando..." : "Crear Cliente y Conexión"}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() =>
              setStep((current) => Math.min(steps.length - 1, current + 1))
            }
          >
            Continuar
          </Button>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
