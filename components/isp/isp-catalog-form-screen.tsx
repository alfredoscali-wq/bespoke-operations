"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import {
  ISP_CATALOG_CATEGORIES,
  ISP_CATALOG_CONNECTION_TYPES,
  ISP_CATALOG_CURRENCIES,
  ISP_CATALOG_CUSTOMER_TYPE_LABELS,
  ISP_CATALOG_CUSTOMER_TYPES,
  ISP_CATALOG_SIRO_STATUS_LABEL,
  ISP_CATALOG_SPEED_UNITS,
  ISP_CATALOG_TECHNOLOGIES,
} from "@/lib/isp/catalog-constants"
import {
  applyTechnicalProfileToCatalogDraft,
  canCatalogItemIncludeTv,
  catalogCategoryLabel,
  catalogConnectionTypeLabel,
  catalogItemToDraft,
  catalogTechnologyLabel,
  emptyCatalogDraft,
  emptyTechnicalProfileDraft,
  formatCatalogMoney,
  formatCatalogSpeedUnit,
  isSelectableTvCatalogPlan,
  validateCatalogDraft,
} from "@/lib/isp/catalog-integrity"
import type {
  IspCatalogDraft,
  IspCatalogItem,
  IspTechnicalProfile,
  IspTechnicalProfileDraft,
} from "@/lib/isp/catalog-types"
import type { IspCatalogConnectionType } from "@/lib/isp/catalog-constants"
import { Button } from "@/components/ui/button"
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

type IspCatalogFormScreenProps = {
  catalogId?: string
}

export function IspCatalogFormScreen({ catalogId }: IspCatalogFormScreenProps) {
  const router = useRouter()
  const [draft, setDraft] = useState<IspCatalogDraft>(emptyCatalogDraft())
  const [profiles, setProfiles] = useState<IspTechnicalProfile[]>([])
  const [tvPlans, setTvPlans] = useState<IspCatalogItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/isp/catalog/technical-profiles")
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          items?: IspTechnicalProfile[]
        }
        if (body.success) setProfiles(body.items ?? [])
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    fetch("/api/isp/catalog?category=tv&status=all")
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          items?: IspCatalogItem[]
        }
        if (!body.success) return
        setTvPlans(
          (body.items ?? []).filter((item) => item.category === "tv")
        )
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!catalogId) return
    fetch(`/api/isp/catalog/${catalogId}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          item?: IspCatalogItem
          message?: string
        }
        if (!body.item) throw new Error(body.message ?? "Servicio no encontrado.")
        setDraft(catalogItemToDraft(body.item))
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Error inesperado.")
      })
  }, [catalogId])

  function update<K extends keyof IspCatalogDraft>(key: K, value: IspCatalogDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function updateCategory(value: string) {
    setDraft((current) => ({
      ...current,
      category: value,
      includesTv: canCatalogItemIncludeTv(value) ? current.includesTv : false,
      tvPlanCatalogId: canCatalogItemIncludeTv(value)
        ? current.tvPlanCatalogId
        : "",
    }))
  }

  function updateIncludesTv(checked: boolean) {
    setDraft((current) => ({
      ...current,
      includesTv: checked,
      tvPlanCatalogId: checked ? current.tvPlanCatalogId : "",
    }))
  }

  function updateProfile<K extends keyof IspTechnicalProfileDraft>(
    key: K,
    value: IspTechnicalProfileDraft[K]
  ) {
    setDraft((current) => ({
      ...current,
      technicalProfile: { ...current.technicalProfile, [key]: value },
    }))
  }

  function toggleConnectionType(type: IspCatalogConnectionType) {
    setDraft((current) => {
      const exists = current.allowedConnectionTypes.includes(type)
      return {
        ...current,
        allowedConnectionTypes: exists
          ? current.allowedConnectionTypes.filter((item) => item !== type)
          : [...current.allowedConnectionTypes, type],
      }
    })
  }

  function selectProfile(value: string) {
    if (value === "none") {
      setDraft((current) => ({
        ...current,
        technicalProfileId: "",
        createTechnicalProfile: false,
        technicalProfile: emptyTechnicalProfileDraft(),
      }))
      return
    }
    if (value === "new") {
      setDraft((current) => ({
        ...current,
        technicalProfileId: "",
        createTechnicalProfile: true,
        technicalProfile: {
          ...emptyTechnicalProfileDraft(),
          code: current.code.trim() || current.technicalProfile.code,
          name: current.name.trim()
            ? `Perfil ${current.name.trim()}`
            : current.technicalProfile.name,
          technology: current.technology,
          connectionType: current.allowedConnectionTypes[0] ?? "",
          downloadSpeed: current.downloadSpeedMbps,
          uploadSpeed: current.uploadSpeedMbps,
          speedUnit: current.speedUnit,
          coreName: "MikroTik",
          coreProfileId: current.code.trim() || current.technicalProfile.coreProfileId,
        },
      }))
      return
    }
    const profile = profiles.find((item) => item.id === value)
    if (!profile) return
    setDraft((current) => applyTechnicalProfileToCatalogDraft(current, profile))
  }

  const profileSelectValue = draft.createTechnicalProfile
    ? "new"
    : draft.technicalProfileId || "none"

  const selectedProfile = profiles.find(
    (item) => item.id === draft.technicalProfileId
  )

  const selectedTvPlan = tvPlans.find(
    (item) => item.id === draft.tvPlanCatalogId
  )
  const selectableTvPlans = tvPlans.filter((item) =>
    isSelectableTvCatalogPlan(item, {
      currentCatalogId: catalogId,
      selectedTvPlanId: draft.tvPlanCatalogId,
    })
  )
  const showTvComponent = canCatalogItemIncludeTv(draft.category)

  const confirmation = useMemo(
    () => ({
      code: draft.code.trim() || "—",
      name: draft.name.trim() || "—",
      category: draft.category
        ? catalogCategoryLabel(draft.category)
        : "—",
      price: draft.monthlyPrice.trim()
        ? `$ ${draft.monthlyPrice} ${draft.currency || "ARS"}`
        : "Sin precio",
      tv: !showTvComponent
        ? "No aplica"
        : draft.includesTv && selectedTvPlan
          ? selectedTvPlan.name
          : "Sin TV",
      tvCharge:
        draft.includesTv && selectedTvPlan
          ? formatCatalogMoney(
              selectedTvPlan.monthlyPrice,
              selectedTvPlan.currency
            )
          : "—",
      technology: catalogTechnologyLabel(draft.technology || null),
      types:
        draft.allowedConnectionTypes
          .map(catalogConnectionTypeLabel)
          .join(", ") || "—",
      profile: draft.createTechnicalProfile
        ? `Nuevo · ${draft.technicalProfile.code || "sin código"}`
        : selectedProfile?.code || "Sin perfil",
      status: draft.isActive ? "Activo" : "Inactivo",
    }),
    [draft, selectedProfile, selectedTvPlan, showTvComponent]
  )

  async function handleSubmit() {
    const validation = validateCatalogDraft(draft)
    if (!validation.valid) {
      setError(validation.message ?? "Revise el formulario.")
      return
    }
    setSaving(true)
    setError(null)
    const response = await fetch(
      catalogId ? `/api/isp/catalog/${catalogId}` : "/api/isp/catalog",
      {
        method: catalogId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      }
    )
    const body = (await response.json()) as {
      success: boolean
      item?: IspCatalogItem
      message?: string
    }
    setSaving(false)
    if (!body.success || !body.item) {
      setError(body.message ?? "No se pudo guardar el servicio.")
      return
    }
    router.push(`/servicios/${body.item.id}`)
  }

  const categoryOptions = (
    ISP_CATALOG_CATEGORIES as readonly string[]
  ).includes(draft.category)
    ? ISP_CATALOG_CATEGORIES
    : draft.category
      ? [...ISP_CATALOG_CATEGORIES, draft.category]
      : ISP_CATALOG_CATEGORIES

  const currencyOptions = (ISP_CATALOG_CURRENCIES as readonly string[]).includes(
    draft.currency
  )
    ? ISP_CATALOG_CURRENCIES
    : draft.currency
      ? [...ISP_CATALOG_CURRENCIES, draft.currency]
      : ISP_CATALOG_CURRENCIES

  const speedUnitOptions = (
    ISP_CATALOG_SPEED_UNITS as readonly string[]
  ).includes(draft.speedUnit)
    ? ISP_CATALOG_SPEED_UNITS
    : draft.speedUnit
      ? [...ISP_CATALOG_SPEED_UNITS, draft.speedUnit]
      : ISP_CATALOG_SPEED_UNITS

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {catalogId ? "Editar servicio" : "Nuevo Servicio"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Catálogo comercial del ISP. El precio mensual es el abono, no el importe
          de una OT.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">1. Información comercial</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Código">
            <Input
              value={draft.code}
              onChange={(event) => update("code", event.target.value)}
              placeholder="FTTH-100"
            />
          </Field>
          <Field label="Nombre comercial">
            <Input
              value={draft.name}
              onChange={(event) => update("name", event.target.value)}
            />
          </Field>
          <Field label="Categoría">
            <Select
              value={draft.category || undefined}
              onValueChange={updateCategory}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {catalogCategoryLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo de cliente">
            <Select
              value={draft.customerType || undefined}
              onValueChange={(value) =>
                update("customerType", value as IspCatalogDraft["customerType"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {ISP_CATALOG_CUSTOMER_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ISP_CATALOG_CUSTOMER_TYPE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estado">
            <Select
              value={draft.isActive ? "active" : "inactive"}
              onValueChange={(value) => update("isActive", value === "active")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Etiqueta en OT">
            <Input
              value={draft.otLabel}
              onChange={(event) => update("otLabel", event.target.value)}
              placeholder="Ej: 50 Mb"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descripción">
              <Textarea
                value={draft.description}
                onChange={(event) => update("description", event.target.value)}
              />
            </Field>
          </div>
          <Field label="Precio mensual (abono)">
            <Input
              value={draft.monthlyPrice}
              onChange={(event) => update("monthlyPrice", event.target.value)}
              inputMode="decimal"
              placeholder="Sin precio hasta que lo complete el administrador"
            />
          </Field>
          <Field label="Moneda">
            <Select
              value={draft.currency || "ARS"}
              onValueChange={(value) => update("currency", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Medio de cobranza mensual"
            hint={ISP_CATALOG_SIRO_STATUS_LABEL}
          >
            <Input value="SIRO" disabled />
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.priceIsConfigurable}
                onCheckedChange={(checked) =>
                  update("priceIsConfigurable", checked === true)
                }
              />
              Precio configurable
            </label>
          </div>
        </div>
      </section>

      {showTvComponent ? (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Componente TV</h2>
          <p className="text-xs text-muted-foreground">
            El servicio comercial sigue siendo un único abono. El cargo TV es
            interno y no reemplaza el precio mensual total.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={draft.includesTv}
              onCheckedChange={(checked) =>
                updateIncludesTv(checked === true)
              }
            />
            Este servicio incluye TV
          </label>
          {draft.includesTv ? (
            selectableTvPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay planes TV activos en el catálogo.
              </p>
            ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Plan TV">
                <Select
                  value={draft.tvPlanCatalogId || undefined}
                  onValueChange={(value) => update("tvPlanCatalogId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar plan TV" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableTvPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} —{" "}
                        {formatCatalogMoney(plan.monthlyPrice, plan.currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Cargo TV"
                hint="Referencia del plan TV. No es el precio total del servicio."
              >
                <Input
                  value={
                    selectedTvPlan
                      ? formatCatalogMoney(
                          selectedTvPlan.monthlyPrice,
                          selectedTvPlan.currency
                        )
                      : "—"
                  }
                  disabled
                />
              </Field>
            </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Plan TV: Sin TV</p>
          )}
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">2. Características</h2>
        <p className="text-xs text-muted-foreground">
          Tecnología es opcional. Bajada y subida son independientes: no se copia
          una en la otra.
        </p>
        {selectedProfile ? (
          <p className="text-xs text-muted-foreground">
            Heredado de {selectedProfile.code}:{" "}
            {catalogTechnologyLabel(selectedProfile.technology)} · bajada{" "}
            {selectedProfile.downloadSpeed ?? "—"} / subida{" "}
            {selectedProfile.uploadSpeed ?? "—"}{" "}
            {formatCatalogSpeedUnit(selectedProfile.speedUnit)}.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tecnología">
            <Select
              value={draft.technology || "none"}
              onValueChange={(value) =>
                update(
                  "technology",
                  value === "none" ? "" : (value as IspCatalogDraft["technology"])
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="No aplica" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No aplica</SelectItem>
                {ISP_CATALOG_TECHNOLOGIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {catalogTechnologyLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Velocidad de bajada"
            hint="No modifica la subida."
          >
            <Input
              value={draft.downloadSpeedMbps}
              onChange={(event) => update("downloadSpeedMbps", event.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field
            label="Velocidad de subida"
            hint="No se completa con la bajada."
          >
            <Input
              value={draft.uploadSpeedMbps}
              onChange={(event) => update("uploadSpeedMbps", event.target.value)}
              inputMode="numeric"
            />
          </Field>
          <Field label="Unidad">
            <Select
              value={draft.speedUnit || "mbps"}
              onValueChange={(value) => update("speedUnit", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {speedUnitOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {formatCatalogSpeedUnit(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">3. Tipos de conexión</h2>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={draft.requiresConnection}
            onCheckedChange={(checked) =>
              update("requiresConnection", checked === true)
            }
          />
          Requiere conexión técnica
        </label>
        {draft.requiresConnection ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {ISP_CATALOG_CONNECTION_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.allowedConnectionTypes.includes(type)}
                  onCheckedChange={() => toggleConnectionType(type)}
                />
                {catalogConnectionTypeLabel(type)}
              </label>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">4. Perfil técnico</h2>
        <p className="text-xs text-muted-foreground">
          Referencia de cómo se materializa el servicio en la red. No conecta con
          MikroTik en este sprint.
        </p>
        <Field label="Perfil técnico">
          <Select value={profileSelectValue} onValueChange={selectProfile}>
            <SelectTrigger>
              <SelectValue placeholder="Sin perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin perfil</SelectItem>
              <SelectItem value="new">Crear perfil técnico</SelectItem>
              {profiles.map((profile) => {
                const disabled =
                  !profile.isActive && profile.id !== draft.technicalProfileId
                return (
                  <SelectItem
                    key={profile.id}
                    value={profile.id}
                    disabled={disabled}
                  >
                    {profile.code} · {profile.name}
                    {profile.isActive ? "" : " (inactivo)"}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </Field>
        {draft.createTechnicalProfile ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código del perfil">
              <Input
                value={draft.technicalProfile.code}
                onChange={(event) => updateProfile("code", event.target.value)}
                placeholder="FTTH-100"
              />
            </Field>
            <Field label="Nombre del perfil">
              <Input
                value={draft.technicalProfile.name}
                onChange={(event) => updateProfile("name", event.target.value)}
              />
            </Field>
            <Field label="Tecnología">
              <Select
                value={draft.technicalProfile.technology || "none"}
                onValueChange={(value) =>
                  updateProfile(
                    "technology",
                    value === "none"
                      ? ""
                      : (value as IspTechnicalProfileDraft["technology"])
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No aplica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No aplica</SelectItem>
                  {ISP_CATALOG_TECHNOLOGIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {catalogTechnologyLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo de conexión">
              <Select
                value={draft.technicalProfile.connectionType || "none"}
                onValueChange={(value) =>
                  updateProfile(
                    "connectionType",
                    value === "none"
                      ? ""
                      : (value as IspTechnicalProfileDraft["connectionType"])
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tipo</SelectItem>
                  {ISP_CATALOG_CONNECTION_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {catalogConnectionTypeLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Bajada">
              <Input
                value={draft.technicalProfile.downloadSpeed}
                onChange={(event) =>
                  updateProfile("downloadSpeed", event.target.value)
                }
                inputMode="numeric"
              />
            </Field>
            <Field
              label="Subida"
              hint="Independiente de la bajada."
            >
              <Input
                value={draft.technicalProfile.uploadSpeed}
                onChange={(event) =>
                  updateProfile("uploadSpeed", event.target.value)
                }
                inputMode="numeric"
              />
            </Field>
            <Field label="Core">
              <Input
                value={draft.technicalProfile.coreName}
                onChange={(event) => updateProfile("coreName", event.target.value)}
                placeholder="MikroTik"
              />
            </Field>
            <Field label="Perfil en Core">
              <Input
                value={draft.technicalProfile.coreProfileId}
                onChange={(event) =>
                  updateProfile("coreProfileId", event.target.value)
                }
                placeholder="FTTH-100"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Descripción">
                <Textarea
                  value={draft.technicalProfile.description}
                  onChange={(event) =>
                    updateProfile("description", event.target.value)
                  }
                />
              </Field>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">5. Confirmación</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Código</dt>
            <dd>{confirmation.code}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Nombre</dt>
            <dd>{confirmation.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Categoría</dt>
            <dd>{confirmation.category}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Precio mensual (abono)
            </dt>
            <dd>{confirmation.price}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Componente TV</dt>
            <dd>{confirmation.tv}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Cargo TV (referencia)
            </dt>
            <dd>{confirmation.tvCharge}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tecnología</dt>
            <dd>{confirmation.technology}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tipos de conexión</dt>
            <dd>{confirmation.types}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Perfil técnico</dt>
            <dd>{confirmation.profile}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Estado</dt>
            <dd>{confirmation.status}</dd>
          </div>
        </dl>
        <div className="flex gap-2">
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/servicios")}
          >
            Cancelar
          </Button>
        </div>
      </section>
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
