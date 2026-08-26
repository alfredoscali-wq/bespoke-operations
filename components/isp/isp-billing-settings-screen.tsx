"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"

import { useAuth } from "@/components/auth/auth-provider"
import {
  IspBillingDocumentA4Stage,
  IspBillingDocumentSheet,
} from "@/components/isp/isp-billing-document-sheet"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
  ARGENTINA_PROVINCES,
  ISP_BILLING_ARCA_HELP,
  ISP_BILLING_ARCA_NOT_CONFIGURED_LABEL,
  ISP_BILLING_DOCUMENT_TYPE_LABELS,
  ISP_BILLING_NO_EMISSION_HELP,
  ISP_BILLING_SAVED_MESSAGE,
  ISP_BILLING_SIRO_HELP,
  ISP_BILLING_SIRO_NOT_CONFIGURED_LABEL,
  ISP_BILLING_VAT_CONDITION_LABELS,
  ISP_BILLING_VAT_CONDITIONS,
  type IspBillingDocumentType,
  type IspBillingVatCondition,
} from "@/lib/isp/billing-constants"
import { buildBillingDocumentPreviewModel } from "@/lib/isp/billing-document-template"
import {
  buildBillingConfigurationStatus,
  emptyBillingDraft,
  formatCuit,
  isFiscalBillingDocument,
} from "@/lib/isp/billing-integrity"
import {
  ISP_BILLING_FOOTER_LEGEND_MAX_LENGTH,
  ISP_BILLING_LOGO_POSITIONS,
  type IspBillingLogoPosition,
  type IspBillingTemplateSettings,
} from "@/lib/isp/billing-template-settings"
import type {
  IspBillingCompanySettings,
  IspBillingCompanySettingsDraft,
  IspBillingConfigurationStatus,
} from "@/lib/isp/billing-types"
import { canWriteIspBilling } from "@/lib/isp/permissions"
import { canAccessSettingsConfigWebModule } from "@/lib/roles/web-module-access"
import { cn } from "@/lib/utils"

function StatusDot({
  tone,
  label,
}: {
  tone: "green" | "yellow" | "red"
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-700">
      <span
        className={cn(
          "size-2.5 rounded-full",
          tone === "green" && "bg-emerald-500",
          tone === "yellow" && "bg-amber-400",
          tone === "red" && "bg-rose-500"
        )}
        aria-hidden
      />
      {label}
    </span>
  )
}

export function IspBillingSettingsScreen() {
  const { sessionUser } = useAuth()
  const canWrite = canWriteIspBilling(sessionUser)
  const canOpenSettingsHub = canAccessSettingsConfigWebModule(sessionUser)
  const [draft, setDraft] = useState<IspBillingCompanySettingsDraft>(
    emptyBillingDraft()
  )
  const [settings, setSettings] = useState<IspBillingCompanySettings | null>(
    null
  )
  const [status, setStatus] = useState<IspBillingConfigurationStatus | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [previewType, setPreviewType] =
    useState<IspBillingDocumentType>("factura_b")

  const liveStatus = useMemo(
    () =>
      buildBillingConfigurationStatus({
        settings: {
          legalName: draft.legalName,
          taxId: draft.taxId,
          vatCondition: draft.vatCondition || null,
          taxAddress: draft.taxAddress,
          pointOfSale: {
            id: draft.pointOfSale.id ?? "draft",
            companyId: settings?.companyId ?? "",
            number: Number(draft.pointOfSale.number) || 0,
            description: draft.pointOfSale.description,
            active: draft.pointOfSale.active,
            createdAt: "",
            updatedAt: "",
          },
          integrations: settings?.integrations ?? [
            {
              provider: "arca",
              status: "not_configured",
              environment: null,
              lastSyncAt: null,
            },
            {
              provider: "siro",
              status: "not_configured",
              environment: null,
              lastSyncAt: null,
            },
          ],
        },
      }),
    [draft, settings]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch("/api/isp/billing/settings")
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          draft?: IspBillingCompanySettingsDraft
          settings?: IspBillingCompanySettings | null
          message?: string
        }
        if (!body.success) {
          throw new Error(body.message ?? "No se pudo cargar la configuración.")
        }
        if (cancelled) return
        if (body.draft) {
          setDraft({
            ...emptyBillingDraft(),
            ...body.draft,
            templateSettings: {
              ...emptyBillingDraft().templateSettings,
              ...body.draft.templateSettings,
            },
            pointOfSale: {
              ...emptyBillingDraft().pointOfSale,
              ...body.draft.pointOfSale,
            },
          })
        }
        setSettings(body.settings ?? null)
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo cargar la configuración fiscal."
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setStatus(liveStatus)
  }, [liveStatus])

  function patch<K extends keyof IspBillingCompanySettingsDraft>(
    key: K,
    value: IspBillingCompanySettingsDraft[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
    setFeedback(null)
  }

  function patchTemplate<K extends keyof IspBillingTemplateSettings>(
    key: K,
    value: IspBillingTemplateSettings[K]
  ) {
    setDraft((current) => ({
      ...current,
      templateSettings: { ...current.templateSettings, [key]: value },
    }))
    setFeedback(null)
  }

  const previewModel = useMemo(
    () =>
      buildBillingDocumentPreviewModel({
        draft,
        documentType: previewType,
      }),
    [draft, previewType]
  )

  async function handleLogo(file: File | undefined) {
    if (!file) return
    setUploadingLogo(true)
    setError(null)
    try {
      const payload = new FormData()
      payload.set("file", file)
      const response = await fetch("/api/isp/billing/logo", {
        method: "POST",
        body: payload,
      })
      const body = (await response.json()) as {
        success: boolean
        url?: string
        message?: string
      }
      if (!body.success || !body.url) {
        throw new Error(body.message ?? "No se pudo cargar el logo.")
      }
      patch("logoUrl", body.url)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo cargar el logo."
      )
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSave() {
    if (!canWrite) return
    setSaving(true)
    setError(null)
    setFeedback(null)
    try {
      const response = await fetch("/api/isp/billing/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
        draft?: IspBillingCompanySettingsDraft
        settings?: IspBillingCompanySettings
      }
      if (!body.success) {
        throw new Error(body.message ?? "No se pudo guardar la configuración.")
      }
      if (body.draft) setDraft(body.draft)
      if (body.settings) setSettings(body.settings)
      setFeedback(body.message ?? ISP_BILLING_SAVED_MESSAGE)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar la configuración fiscal."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
            Sistema → Configuración → Facturación
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-800">
            Configuración de facturación
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Configurá la empresa emisora, punto de venta, comprobantes e
            integraciones fiscales.
          </p>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {ISP_BILLING_NO_EMISSION_HELP}
          </p>
          {canOpenSettingsHub ? (
            <Link
              href="/configuracion"
              className="mt-2 inline-block text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Volver a Configuración
            </Link>
          ) : null}
        </div>
        <Button onClick={() => void handleSave()} disabled={!canWrite || saving}>
          {saving ? "Guardando…" : "Guardar configuración"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuración fiscal</CardTitle>
          <CardDescription>
            Estado de la única empresa que emitirá comprobantes en esta instalación.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
          <StatusDot
            tone={status?.companyReady ? "green" : "red"}
            label={status?.labels.company ?? "Configuración incompleta"}
          />
          <StatusDot
            tone={status?.pointOfSaleReady ? "green" : "red"}
            label={
              status?.pointOfSaleReady
                ? "Punto de venta configurado"
                : "Falta punto de venta"
            }
          />
          <StatusDot tone="yellow" label="ARCA pendiente" />
          <StatusDot tone="yellow" label="SIRO pendiente" />
        </CardContent>
        {status?.incomplete ? (
          <CardContent className="pt-0 text-sm text-rose-700">
            {status.missing.map((item) => item.message).join(" · ")}
          </CardContent>
        ) : null}
      </Card>

      {feedback ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando configuración…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Empresa facturadora</CardTitle>
              <CardDescription>
                Datos fiscales de la empresa que factura a todos los abonados.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Razón social" htmlFor="billing-legal-name">
                <Input
                  id="billing-legal-name"
                  value={draft.legalName}
                  disabled={!canWrite}
                  onChange={(event) => patch("legalName", event.target.value)}
                />
              </Field>
              <Field label="CUIT" htmlFor="billing-tax-id">
                <Input
                  id="billing-tax-id"
                  value={draft.taxId}
                  disabled={!canWrite}
                  placeholder="20-12345678-6"
                  onChange={(event) => patch("taxId", event.target.value)}
                  onBlur={() => patch("taxId", formatCuit(draft.taxId))}
                />
              </Field>
              <Field label="Condición frente al IVA" htmlFor="billing-vat">
                <Select
                  value={draft.vatCondition || undefined}
                  disabled={!canWrite}
                  onValueChange={(value) =>
                    patch("vatCondition", value as IspBillingVatCondition)
                  }
                >
                  <SelectTrigger id="billing-vat">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {ISP_BILLING_VAT_CONDITIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {ISP_BILLING_VAT_CONDITION_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Domicilio fiscal" htmlFor="billing-address">
                <Input
                  id="billing-address"
                  value={draft.taxAddress}
                  disabled={!canWrite}
                  onChange={(event) => patch("taxAddress", event.target.value)}
                />
              </Field>
              <Field label="Localidad" htmlFor="billing-city">
                <Input
                  id="billing-city"
                  value={draft.city}
                  disabled={!canWrite}
                  onChange={(event) => patch("city", event.target.value)}
                />
              </Field>
              <Field label="Provincia" htmlFor="billing-province">
                <Select
                  value={draft.province || undefined}
                  disabled={!canWrite}
                  onValueChange={(value) => patch("province", value)}
                >
                  <SelectTrigger id="billing-province">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {ARGENTINA_PROVINCES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Código postal" htmlFor="billing-postal">
                <Input
                  id="billing-postal"
                  value={draft.postalCode}
                  disabled={!canWrite}
                  onChange={(event) => patch("postalCode", event.target.value)}
                />
              </Field>
              <Field label="Teléfono" htmlFor="billing-phone">
                <Input
                  id="billing-phone"
                  value={draft.phone}
                  disabled={!canWrite}
                  onChange={(event) => patch("phone", event.target.value)}
                />
              </Field>
              <Field label="Email" htmlFor="billing-email">
                <Input
                  id="billing-email"
                  type="email"
                  value={draft.email}
                  disabled={!canWrite}
                  onChange={(event) => patch("email", event.target.value)}
                />
              </Field>
              <Field label="Sitio web" htmlFor="billing-web">
                <Input
                  id="billing-web"
                  value={draft.website}
                  disabled={!canWrite}
                  onChange={(event) => patch("website", event.target.value)}
                />
              </Field>
              <div className="sm:col-span-2">
                <Label htmlFor="billing-logo">Logo</Label>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Input
                    id="billing-logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={!canWrite || uploadingLogo}
                    onChange={(event) =>
                      void handleLogo(event.target.files?.[0])
                    }
                  />
                  {draft.logoUrl ? (
                    <img
                      src={draft.logoUrl}
                      alt="Logo de la empresa facturadora"
                      className="h-12 w-auto object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Opcional</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Punto de venta</CardTitle>
              <CardDescription>
                Una configuración activa en esta versión. El modelo admite más puntos de venta a futuro.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field label="Número" htmlFor="billing-pos-number">
                <Input
                  id="billing-pos-number"
                  inputMode="numeric"
                  value={draft.pointOfSale.number}
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      pointOfSale: {
                        ...current.pointOfSale,
                        number: event.target.value,
                      },
                    }))
                  }
                />
              </Field>
              <Field label="Descripción" htmlFor="billing-pos-description">
                <Input
                  id="billing-pos-description"
                  value={draft.pointOfSale.description}
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      pointOfSale: {
                        ...current.pointOfSale,
                        description: event.target.value,
                      },
                    }))
                  }
                />
              </Field>
              <Field label="Estado" htmlFor="billing-pos-status">
                <Select
                  value={draft.pointOfSale.active ? "active" : "inactive"}
                  disabled={!canWrite}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      pointOfSale: {
                        ...current.pointOfSale,
                        active: value === "active",
                      },
                    }))
                  }
                >
                  <SelectTrigger id="billing-pos-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Numeración de comprobantes</CardTitle>
              <CardDescription>
                Preparada para emisión futura. No se generan comprobantes en este sprint.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.sequences.map((sequence, index) => {
                const issued =
                  settings?.sequences.find(
                    (item) => item.documentType === sequence.documentType
                  )?.issuedCount ?? 0
                return (
                  <div
                    key={sequence.documentType}
                    className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]"
                  >
                    <p className="text-sm text-slate-700">
                      {ISP_BILLING_DOCUMENT_TYPE_LABELS[sequence.documentType]}
                      {!isFiscalBillingDocument(sequence.documentType) ? (
                        <span className="ml-2 text-xs text-slate-400">
                          No fiscal · sin CAE
                        </span>
                      ) : null}
                    </p>
                    <Input
                      inputMode="numeric"
                      value={sequence.nextNumber}
                      disabled={!canWrite || issued > 0}
                      onChange={(event) =>
                        setDraft((current) => {
                          const sequences = [...current.sequences]
                          sequences[index] = {
                            ...sequence,
                            nextNumber: event.target.value,
                          }
                          return { ...current, sequences }
                        })
                      }
                    />
                    <span className="text-xs text-slate-400">
                      {issued > 0 ? "Bloqueado" : "Próximo número"}
                    </span>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Diseño del comprobante</CardTitle>
              <CardDescription>
                Plantilla visual A4. La estructura es fija; solo se configuran
                logo, datos visibles y leyenda. No modifica importes ni
                snapshots fiscales.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={draft.templateSettings.showLogo}
                    disabled={!canWrite}
                    onCheckedChange={(checked) =>
                      patchTemplate("showLogo", checked === true)
                    }
                  />
                  Mostrar logo
                </label>
                <Field label="Posición del logo" htmlFor="billing-logo-position">
                  <Select
                    value={draft.templateSettings.logoPosition}
                    disabled={!canWrite || !draft.templateSettings.showLogo}
                    onValueChange={(value) =>
                      patchTemplate(
                        "logoPosition",
                        value as IspBillingLogoPosition
                      )
                    }
                  >
                    <SelectTrigger id="billing-logo-position">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ISP_BILLING_LOGO_POSITIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value === "left"
                            ? "Izquierda"
                            : value === "center"
                              ? "Centro"
                              : "Derecha"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="URL del logo" htmlFor="billing-logo-url">
                  <Input
                    id="billing-logo-url"
                    value={draft.logoUrl}
                    disabled={!canWrite}
                    placeholder="https://"
                    onChange={(event) => patch("logoUrl", event.target.value)}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={draft.templateSettings.showAddress}
                    disabled={!canWrite}
                    onCheckedChange={(checked) =>
                      patchTemplate("showAddress", checked === true)
                    }
                  />
                  Mostrar domicilio
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={draft.templateSettings.showPhone}
                    disabled={!canWrite}
                    onCheckedChange={(checked) =>
                      patchTemplate("showPhone", checked === true)
                    }
                  />
                  Mostrar teléfono
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={draft.templateSettings.showEmail}
                    disabled={!canWrite}
                    onCheckedChange={(checked) =>
                      patchTemplate("showEmail", checked === true)
                    }
                  />
                  Mostrar email
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={draft.templateSettings.showObservations}
                    disabled={!canWrite}
                    onCheckedChange={(checked) =>
                      patchTemplate("showObservations", checked === true)
                    }
                  />
                  Mostrar observaciones
                </label>
              </div>
              <Field
                label="Leyenda inferior personalizada"
                htmlFor="billing-footer-legend"
              >
                <Textarea
                  id="billing-footer-legend"
                  value={draft.templateSettings.footerLegend}
                  disabled={!canWrite}
                  maxLength={ISP_BILLING_FOOTER_LEGEND_MAX_LENGTH}
                  placeholder="Texto opcional al pie del comprobante"
                  onChange={(event) =>
                    patchTemplate("footerLegend", event.target.value)
                  }
                />
                <p className="text-xs text-slate-400">
                  Máximo {ISP_BILLING_FOOTER_LEGEND_MAX_LENGTH} caracteres. Sin
                  HTML. La leyenda de documento no fiscal no se puede ocultar.
                </p>
              </Field>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Field label="Vista previa" htmlFor="billing-preview-type">
                  <Select
                    value={previewType}
                    onValueChange={(value) =>
                      setPreviewType(value as IspBillingDocumentType)
                    }
                  >
                    <SelectTrigger id="billing-preview-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        [
                          "factura_a",
                          "factura_b",
                          "factura_c",
                          "presupuesto",
                          "comprobante_x",
                          "nota_credito",
                          "nota_debito",
                        ] as const
                      ).map((value) => (
                        <SelectItem key={value} value={value}>
                          {ISP_BILLING_DOCUMENT_TYPE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <p className="text-xs text-slate-400">
                  Usa los datos reales de la empresa y un cliente de ejemplo. No
                  crea un comprobante.
                </p>
              </div>
              <IspBillingDocumentA4Stage className="rounded-xl">
                <IspBillingDocumentSheet model={previewModel} />
              </IspBillingDocumentA4Stage>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>ARCA</CardTitle>
                <CardDescription>{ISP_BILLING_ARCA_NOT_CONFIGURED_LABEL}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Integración ARCA · Pendiente de configuración
                </div>
                <p className="text-sm text-slate-500">{ISP_BILLING_ARCA_HELP}</p>
                <dl className="grid gap-1 text-sm text-slate-600">
                  <div>CUIT emisor: {formatCuit(draft.taxId) || "—"}</div>
                  <div>
                    Punto de venta: {draft.pointOfSale.number || "—"}
                  </div>
                  <div>Ambiente: no configurado</div>
                  <div>Estado de conexión: no configurado</div>
                </dl>
                <Button type="button" disabled>
                  Configurar ARCA
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SIRO</CardTitle>
                <CardDescription>{ISP_BILLING_SIRO_NOT_CONFIGURED_LABEL}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-slate-800">
                  SIRO · Pendiente
                </div>
                <p className="text-sm text-slate-500">{ISP_BILLING_SIRO_HELP}</p>
                <dl className="grid gap-1 text-sm text-slate-600">
                  <div>CUIT: {formatCuit(draft.taxId) || "—"}</div>
                  <div>Convenio: no configurado</div>
                  <div>Ambiente: no configurado</div>
                  <div>Estado de conexión: no configurado</div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
