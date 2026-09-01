"use client"

import { useState } from "react"

import {
  ISP_CATALOG_ACTIVATE_ACTION_LABEL,
  ISP_CATALOG_DEACTIVATE_ACTION_LABEL,
} from "@/lib/isp/catalog-integrity"
import type { IspCatalogItem } from "@/lib/isp/catalog-types"
import { cn } from "@/lib/utils"

type CatalogActiveResponse = {
  success: boolean
  item?: IspCatalogItem
  message?: string
}

export function IspCatalogActiveToggle({
  item,
  onUpdated,
  onError,
}: {
  item: IspCatalogItem
  onUpdated: (item: IspCatalogItem) => void
  onError?: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const label = item.isActive
    ? ISP_CATALOG_DEACTIVATE_ACTION_LABEL
    : ISP_CATALOG_ACTIVATE_ACTION_LABEL

  async function toggle() {
    setBusy(true)
    try {
      const response = await fetch(`/api/isp/catalog/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      })
      const body = (await response.json()) as CatalogActiveResponse
      if (!response.ok || !body.item) {
        onError?.(body.message ?? "No se pudo actualizar el estado.")
        return
      }
      onUpdated(body.item)
    } catch {
      onError?.("No se pudo actualizar el estado.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={item.isActive}
      aria-label={label}
      disabled={busy}
      title={label}
      onClick={() => void toggle()}
      className="inline-flex cursor-pointer items-center gap-2 rounded-md text-left text-sm outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          item.isActive ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow-sm transition-transform",
            item.isActive && "translate-x-4"
          )}
        />
      </span>
      <span className={item.isActive ? "font-medium" : "text-muted-foreground"}>
        {item.isActive ? "Activo" : "Inactivo"}
      </span>
    </button>
  )
}
