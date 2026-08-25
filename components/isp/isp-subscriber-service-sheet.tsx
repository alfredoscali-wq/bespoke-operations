"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"

import { IspConnectionFields } from "@/components/isp/isp-connection-fields"
import { IspCommercialStatusBadge } from "@/components/isp/isp-status-badges"
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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  ISP_CATALOG_CONNECTION_TYPE_LABELS,
  ISP_CATALOG_TECHNOLOGY_LABELS,
} from "@/lib/isp/catalog-constants"
import {
  filterConnectionTypesForCatalog,
  formatCatalogSpeed,
  snapshotServiceFromCatalog,
} from "@/lib/isp/catalog-integrity"
import type { IspCatalogItem, IspTechnicalProfile } from "@/lib/isp/catalog-types"
import {
  ISP_CONNECTION_TYPES,
  ISP_SERVICE_WITHOUT_CONNECTION_MESSAGE,
} from "@/lib/isp/constants"
import {
  ISP_CREATE_CONNECTION_CHECKBOX_LABEL,
  ISP_KEEP_PPPOE_PASSWORD_PLACEHOLDER,
  commercialStatusFromActivationDate,
  emptyConnectionDraft,
  inheritedSpeedsFromCatalog,
  localIsoDate,
  prefillConnectionFromCatalog,
  submitLabelForIncludeConnection,
} from "@/lib/isp/subscriber-service-integrity"
import type {
  IspConnectionDraft,
  IspServiceWithConnection,
} from "@/lib/isp/types"

export type SubscriberServiceSheetMode =
  | "add-service"
  | "edit-service"
  | "change-plan"
  | "create-connection"
  | "edit-connection"
  | "view-service"
  | "view-connection"

function todayIsoDate() {
  return localIsoDate()
}

function formatMoney(value: string | number | null | undefined) {
  const parsed =
    typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."))
  if (!Number.isFinite(parsed)) return "—"
  return `$${parsed.toLocaleString("es-AR")}`
}

function draftFromService(
  service: IspServiceWithConnection | null
): IspConnectionDraft {
  const connection = service?.connection
  if (!connection) return emptyConnectionDraft()
  return {
    connectionType: connection.connectionType,
    pppoeUsername: connection.pppoeUsername ?? "",
    pppoePassword: "",
    technicalProfile: connection.technicalProfile ?? "",
    technicalProfileId: connection.technicalProfileId ?? "",
    ipAddress: connection.ipAddress ?? "",
    prefixLength:
      connection.prefixLength != null ? String(connection.prefixLength) : "",
    gateway: connection.gateway ?? "",
    vlan: connection.vlan ?? "",
    coreName: connection.coreName ?? "MikroTik",
    coreProfileId: connection.coreProfileId ?? "",
    technicalStatus: connection.technicalStatus,
  }
}

export function IspSubscriberServiceSheet({
  open,
  mode,
  customerId,
  service,
  onClose,
  onSaved,
}: {
  open: boolean
  mode: SubscriberServiceSheetMode
  customerId: string
  service?: IspServiceWithConnection | null
  onClose: () => void
  onSaved: () => void
}) {
  const [catalogItems, setCatalogItems] = useState<IspCatalogItem[]>([])
  const [profiles, setProfiles] = useState<IspTechnicalProfile[]>([])
  const [search, setSearch] = useState("")
  const [catalogId, setCatalogId] = useState("")
  const [monthlyFee, setMonthlyFee] = useState("")
  const [activationDate, setActivationDate] = useState(todayIsoDate())
  const [subsequentStatus, setSubsequentStatus] = useState<
    "date_driven" | "suspended" | "cancelled"
  >("date_driven")
  const [notes, setNotes] = useState("")
  const [includeConnection, setIncludeConnection] = useState(true)
  const [connection, setConnection] = useState<IspConnectionDraft>(
    emptyConnectionDraft()
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedCatalog = catalogItems.find((item) => item.id === catalogId) ?? null
  const snapshot = selectedCatalog
    ? snapshotServiceFromCatalog(selectedCatalog)
    : null
  const allowedTypes = filterConnectionTypesForCatalog(
    selectedCatalog?.allowedConnectionTypes ??
      (service
        ? catalogItems.find((item) => item.id === service.catalogId)
            ?.allowedConnectionTypes
        : undefined),
    ISP_CONNECTION_TYPES
  )
  const speeds = selectedCatalog
    ? inheritedSpeedsFromCatalog(selectedCatalog)
    : {
        download:
          service?.downloadSpeed != null
            ? `${service.downloadSpeed} Mbps`
            : "—",
        upload:
          service?.uploadSpeed != null ? `${service.uploadSpeed} Mbps` : "—",
        pair: service?.contractedSpeed ?? "",
      }

  const previewStatus = commercialStatusFromActivationDate(activationDate)
  const displayedStatus =
    subsequentStatus !== "date_driven" ? subsequentStatus : previewStatus

  const title = useMemo(() => {
    if (mode === "add-service") return "Agregar servicio"
    if (mode === "edit-service") return "Editar servicio"
    if (mode === "change-plan") return "Cambiar servicio"
    if (mode === "create-connection") return "Crear conexión"
    if (mode === "edit-connection") return "Editar conexión"
    if (mode === "view-connection") return "Conexión"
    return "Servicio contratado"
  }, [mode])

  useEffect(() => {
    if (!open) return
    fetch("/api/isp/catalog?status=active")
      .then(async (response) => {
        const body = (await response.json()) as {
          items?: IspCatalogItem[]
        }
        setCatalogItems(body.items ?? [])
      })
      .catch(() => undefined)
    fetch("/api/isp/catalog/technical-profiles?status=active")
      .then(async (response) => {
        const body = (await response.json()) as {
          items?: IspTechnicalProfile[]
        }
        setProfiles(body.items ?? [])
      })
      .catch(() => undefined)
  }, [open])

  useEffect(() => {
    const id = catalogId || service?.catalogId
    if (!open || !id) return
    if (catalogItems.some((item) => item.id === id)) return
    fetch(`/api/isp/catalog/${id}`)
      .then(async (response) => {
        const body = (await response.json()) as { item?: IspCatalogItem }
        if (!body.item) return
        setCatalogItems((current) =>
          current.some((item) => item.id === body.item!.id)
            ? current
            : [...current, body.item!]
        )
      })
      .catch(() => undefined)
  }, [catalogId, catalogItems, open, service?.catalogId])

  useEffect(() => {
    if (!open) return
    setError(null)
    setSearch("")
    if (mode === "add-service") {
      setCatalogId("")
      setMonthlyFee("")
      setActivationDate(todayIsoDate())
      setSubsequentStatus("date_driven")
      setNotes("")
      setIncludeConnection(true)
      setConnection(emptyConnectionDraft())
      return
    }
    if (service) {
      setCatalogId(service.catalogId ?? "")
      setMonthlyFee(service.monthlyFee != null ? String(service.monthlyFee) : "")
      setActivationDate(service.activationDate || todayIsoDate())
      setSubsequentStatus(
        service.commercialStatus === "suspended" ||
          service.commercialStatus === "cancelled"
          ? service.commercialStatus
          : "date_driven"
      )
      setNotes(service.notes ?? "")
      setIncludeConnection(mode === "change-plan")
      setConnection(draftFromService(service))
    }
    if (mode === "change-plan") {
      setCatalogId("")
      setMonthlyFee("")
      setSubsequentStatus("date_driven")
      setActivationDate(todayIsoDate())
      setIncludeConnection(true)
      setConnection(emptyConnectionDraft())
    }
    if (mode === "create-connection") {
      setIncludeConnection(true)
    }
  }, [mode, open, service])

  useEffect(() => {
    if (!open || (mode !== "create-connection" && mode !== "add-service")) return
    const catalog =
      catalogItems.find((item) => item.id === (catalogId || service?.catalogId)) ??
      null
    if (!catalog) return
    setConnection((current) => {
      if (current.technicalProfileId || current.connectionType) return current
      return {
        ...emptyConnectionDraft(),
        ...prefillConnectionFromCatalog(catalog),
      }
    })
  }, [catalogId, catalogItems, mode, open, service])

  function applyCatalog(item: IspCatalogItem) {
    const snap = snapshotServiceFromCatalog(item)
    setCatalogId(item.id)
    setMonthlyFee(snap.monthlyFee)
    setIncludeConnection((current) =>
      mode === "add-service" || mode === "change-plan" ? true : current
    )
    setConnection((current) => ({
      ...current,
      ...prefillConnectionFromCatalog(item),
      pppoeUsername: current.pppoeUsername,
      pppoePassword: current.pppoePassword,
      ipAddress: current.ipAddress,
      prefixLength: current.prefixLength,
      gateway: current.gateway,
      vlan: current.vlan,
    }))
  }

  const filteredCatalog = catalogItems.filter((item) => {
    const needle = search.trim().toLowerCase()
    if (!needle) return true
    return (
      item.name.toLowerCase().includes(needle) ||
      (item.code ?? "").toLowerCase().includes(needle)
    )
  })

  const showCatalogPicker = mode === "add-service" || mode === "change-plan"
  const showContractFields =
    mode === "add-service" ||
    mode === "edit-service" ||
    mode === "change-plan" ||
    mode === "view-service"
  const showConnection =
    ((mode === "add-service" || mode === "change-plan") && includeConnection) ||
    mode === "create-connection" ||
    mode === "edit-connection" ||
    mode === "view-connection"
  const readOnly =
    mode === "view-service" || mode === "view-connection"

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (mode === "add-service" || mode === "change-plan") {
        const response = await fetch(`/api/isp/customers/${customerId}/services`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            catalogId,
            monthlyFee,
            activationDate,
            notes,
            includeConnection,
            replacedServiceId:
              mode === "change-plan" ? service?.id ?? null : null,
            connection: includeConnection ? connection : undefined,
          }),
        })
        const body = (await response.json()) as {
          success: boolean
          message?: string
        }
        if (!body.success) throw new Error(body.message)
      } else if (mode === "edit-service") {
        const response = await fetch(`/api/isp/services/${service?.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monthlyFee,
            activationDate,
            commercialStatus:
              subsequentStatus === "date_driven"
                ? commercialStatusFromActivationDate(activationDate)
                : subsequentStatus,
            notes,
          }),
        })
        const body = (await response.json()) as {
          success: boolean
          message?: string
        }
        if (!body.success) throw new Error(body.message)
      } else if (mode === "create-connection" && service) {
        const response = await fetch(
          `/api/isp/services/${service.id}/connection`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connection }),
          }
        )
        const body = (await response.json()) as {
          success: boolean
          message?: string
        }
        if (!body.success) throw new Error(body.message)
      } else if (mode === "edit-connection" && service?.connection) {
        const response = await fetch(
          `/api/isp/connections/${service.connection.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connection }),
          }
        )
        const body = (await response.json()) as {
          success: boolean
          message?: string
        }
        if (!body.success) throw new Error(body.message)
      }
      onSaved()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.")
    } finally {
      setSaving(false)
    }
  }

  const submitLabel =
    mode === "create-connection"
      ? "Guardar conexión"
      : mode === "edit-connection"
        ? "Guardar conexión"
        : mode === "edit-service"
          ? "Guardar servicio"
          : submitLabelForIncludeConnection(includeConnection)

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto sm:max-w-xl data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 px-4 pb-4">
          {showCatalogPicker ? (
            <div className="space-y-2">
              <Label>Servicio</Label>
              <Input
                placeholder="Buscar por código o nombre"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/70 p-2">
                {filteredCatalog.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay servicios activos para esta empresa.
                  </p>
                ) : (
                  filteredCatalog.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`block w-full rounded-md px-2 py-1.5 text-left text-sm ${
                        catalogId === item.id
                          ? "bg-primary/10 font-medium"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => applyCatalog(item)}
                    >
                      {item.name}
                      {item.code ? ` · ${item.code}` : ""}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {selectedCatalog && showCatalogPicker ? (
            <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Servicio seleccionado
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <p>
                  Servicio: <strong>{selectedCatalog.name}</strong>
                </p>
                {selectedCatalog.code ? (
                  <p>
                    Código: <strong>{selectedCatalog.code}</strong>
                  </p>
                ) : null}
                <p>
                  Tecnología:{" "}
                  {selectedCatalog.technology
                    ? ISP_CATALOG_TECHNOLOGY_LABELS[selectedCatalog.technology]
                    : "—"}
                </p>
                <p>
                  Velocidad:{" "}
                  {formatCatalogSpeed(
                    selectedCatalog.downloadSpeedMbps,
                    selectedCatalog.uploadSpeedMbps,
                    selectedCatalog.speedUnit
                  ) || "—"}
                </p>
                <p>Precio de lista: {formatMoney(selectedCatalog.monthlyPrice)} / mes</p>
                <p className="sm:col-span-2">
                  Tipo de conexión:{" "}
                  {selectedCatalog.allowedConnectionTypes
                    .map((type) => ISP_CATALOG_CONNECTION_TYPE_LABELS[type])
                    .join(", ") || "—"}
                </p>
              </div>
            </div>
          ) : null}

          {showContractFields ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {snapshot || service ? (
                <>
                  <Field label="Precio de lista">
                    <Input
                      disabled
                      value={formatMoney(
                        selectedCatalog?.monthlyPrice ?? service?.listPrice
                      )}
                    />
                  </Field>
                  <Field label="Precio contratado">
                    <Input
                      disabled={readOnly}
                      value={monthlyFee}
                      onChange={(event) => setMonthlyFee(event.target.value)}
                    />
                  </Field>
                </>
              ) : null}
              <Field label="Fecha de alta">
                <Input
                  type="date"
                  disabled={readOnly}
                  value={activationDate}
                  onChange={(event) => setActivationDate(event.target.value)}
                />
              </Field>
              <Field label="Estado comercial">
                <div className="flex min-h-9 flex-col justify-center gap-1">
                  <IspCommercialStatusBadge status={displayedStatus} />
                  {displayedStatus === "pending_activation" && activationDate ? (
                    <p className="text-[11px] text-muted-foreground">
                      Se activa el{" "}
                      {new Date(`${activationDate}T00:00:00`).toLocaleDateString(
                        "es-AR"
                      )}
                    </p>
                  ) : null}
                </div>
              </Field>
              {mode === "edit-service" && !readOnly ? (
                <Field label="Evento posterior">
                  <Select
                    value={subsequentStatus}
                    onValueChange={(value) =>
                      setSubsequentStatus(
                        value as "date_driven" | "suspended" | "cancelled"
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_driven">
                        Según fecha de alta
                      </SelectItem>
                      <SelectItem value="suspended">Suspendido</SelectItem>
                      <SelectItem value="cancelled">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
              <div className="space-y-1 sm:col-span-2">
                <Label>Observaciones</Label>
                <Textarea
                  disabled={readOnly}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {mode === "add-service" || mode === "change-plan" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeConnection}
                onChange={(event) => setIncludeConnection(event.target.checked)}
              />
              {ISP_CREATE_CONNECTION_CHECKBOX_LABEL}
            </label>
          ) : null}

          {!includeConnection &&
          (mode === "add-service" || mode === "change-plan") ? (
            <p className="text-sm text-muted-foreground">
              {ISP_SERVICE_WITHOUT_CONNECTION_MESSAGE}
            </p>
          ) : null}

          {showConnection ? (
            <IspConnectionFields
              draft={connection}
              onChange={setConnection}
              allowedTypes={
                allowedTypes.length > 0 ? allowedTypes : [...ISP_CONNECTION_TYPES]
              }
              profiles={profiles}
              inheritedDownload={speeds.download}
              inheritedUpload={speeds.upload}
              inheritedPair={speeds.pair}
              passwordPlaceholder={
                mode === "edit-connection"
                  ? ISP_KEEP_PPPOE_PASSWORD_PLACEHOLDER
                  : undefined
              }
              allowTechnicalStatus={mode === "edit-connection"}
              disabled={readOnly}
            />
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        {readOnly ? (
          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </SheetFooter>
        ) : (
          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Guardando..." : submitLabel}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
