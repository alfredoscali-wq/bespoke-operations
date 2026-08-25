"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  ISP_CATALOG_BILLING_PERIOD_LABELS,
  ISP_CATALOG_CUSTOMER_TYPE_LABELS,
  ISP_CATALOG_SIRO_STATUS_LABEL,
} from "@/lib/isp/catalog-constants"
import {
  catalogCategoryLabel,
  catalogConnectionTypeLabel,
  catalogTechnologyLabel,
  formatCatalogSpeedValue,
  formatCatalogSpeedUnit,
  resolveCatalogCharacteristics,
} from "@/lib/isp/catalog-integrity"
import type { IspCatalogItem } from "@/lib/isp/catalog-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function formatPrice(value: number | null | undefined, currency?: string) {
  if (value == null) return "Sin precio"
  const amount = `$ ${value.toLocaleString("es-AR", {
    maximumFractionDigits: 0,
  })}`
  return currency ? `${amount} ${currency}` : amount
}

export function IspCatalogDetailScreen({ catalogId }: { catalogId: string }) {
  const router = useRouter()
  const [item, setItem] = useState<IspCatalogItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/isp/catalog/${catalogId}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          item?: IspCatalogItem
          message?: string
        }
        if (!body.item) throw new Error(body.message ?? "Servicio no encontrado.")
        setItem(body.item)
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Error inesperado.")
      })
  }, [catalogId])

  async function toggleActive() {
    if (!item) return
    setSaving(true)
    const response = await fetch(`/api/isp/catalog/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    })
    const body = (await response.json()) as {
      success: boolean
      item?: IspCatalogItem
      message?: string
    }
    setSaving(false)
    if (body.item) setItem(body.item)
    else setError(body.message ?? "No se pudo actualizar el estado.")
  }

  if (error && !item) {
    return <p className="text-sm text-destructive">{error}</p>
  }
  if (!item) {
    return <p className="text-sm text-muted-foreground">Cargando servicio...</p>
  }

  const characteristics = resolveCatalogCharacteristics(item)
  const profile = item.technicalProfile

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {item.code || "Sin código"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
          <p className="text-sm text-muted-foreground">
            {catalogCategoryLabel(item.category)} ·{" "}
            {item.isActive ? "Activo" : "Inactivo"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/servicios/${item.id}/editar`}>Editar</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={toggleActive}
          >
            {item.isActive ? "Desactivar" : "Activar"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push("/servicios")}>
            Volver
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Información comercial</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Item label="Código" value={item.code || "—"} />
          <Item label="Nombre" value={item.name} />
          <Item label="Categoría" value={catalogCategoryLabel(item.category)} />
          <Item
            label="Tipo de cliente"
            value={ISP_CATALOG_CUSTOMER_TYPE_LABELS[item.customerType]}
          />
          <Item
            label="Precio"
            value={formatPrice(item.monthlyPrice, item.currency)}
          />
          <Item
            label="Periodicidad"
            value={ISP_CATALOG_BILLING_PERIOD_LABELS[item.billingPeriod]}
          />
          <Item label="Medio de cobranza" value={ISP_CATALOG_SIRO_STATUS_LABEL} />
          <Item
            label="Precio configurable"
            value={item.priceIsConfigurable ? "Sí" : "No"}
          />
          <Item
            label="Estado"
            value={item.isActive ? "Activo" : "Inactivo"}
          />
          <Item
            label="Clientes que utilizan este servicio"
            value={String(item.usedCount ?? 0)}
          />
          <div className="sm:col-span-2">
            <Item label="Descripción" value={item.description || "—"} />
          </div>
        </dl>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Características</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Item
            label="Tecnología"
            value={catalogTechnologyLabel(characteristics.technology)}
          />
          <Item
            label="Unidad"
            value={formatCatalogSpeedUnit(characteristics.speedUnit)}
          />
          <Item
            label="Velocidad de bajada"
            value={formatCatalogSpeedValue(
              characteristics.downloadSpeedMbps,
              characteristics.speedUnit
            )}
          />
          <Item
            label="Velocidad de subida"
            value={formatCatalogSpeedValue(
              characteristics.uploadSpeedMbps,
              characteristics.speedUnit
            )}
          />
        </dl>
        {characteristics.downloadSpeedMbps != null &&
        characteristics.uploadSpeedMbps == null ? (
          <p className="text-xs text-muted-foreground">
            Subida pendiente de completar. No se asume igual a la bajada.
          </p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Conexión</h2>
        <p className="text-xs text-muted-foreground">
          Tipos permitidos para este servicio. La IP y el usuario PPPoE pertenecen
          a la conexión del abonado, no al catálogo.
        </p>
        <div className="flex flex-wrap gap-1">
          {item.allowedConnectionTypes.length > 0 ? (
            item.allowedConnectionTypes.map((type) => (
              <Badge key={type} variant="outline">
                {catalogConnectionTypeLabel(type)}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Perfil técnico</h2>
        {profile ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Item label="Perfil" value={`${profile.code} · ${profile.name}`} />
            <Item label="Core" value={profile.coreName || "—"} />
            <Item label="Perfil en Core" value={profile.coreProfileId || "—"} />
            <Item
              label="Estado"
              value={profile.isActive ? "Activo" : "Inactivo"}
            />
            <Item
              label="Tecnología"
              value={catalogTechnologyLabel(profile.technology)}
            />
            <Item
              label="Bajada"
              value={formatCatalogSpeedValue(
                profile.downloadSpeed,
                profile.speedUnit
              )}
            />
            <Item
              label="Subida"
              value={formatCatalogSpeedValue(
                profile.uploadSpeed,
                profile.speedUnit
              )}
            />
            <Item
              label="Tipo de conexión"
              value={
                profile.connectionType
                  ? catalogConnectionTypeLabel(profile.connectionType)
                  : "—"
              }
            />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Este servicio todavía no tiene un perfil técnico asociado.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Los datos de Core / MikroTik son configuración preparada. No hay
          conexión real ni provisioning en este sprint.
        </p>
      </section>
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}
