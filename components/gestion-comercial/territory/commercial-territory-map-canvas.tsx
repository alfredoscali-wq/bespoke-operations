"use client"

import { useMemo } from "react"

import {
  CommercialMapCanvas,
  escapeCommercialMapHtml,
  type CommercialMapMarker,
} from "@/components/gestion-comercial/map/commercial-map-canvas"
import {
  COMMERCIAL_PRIORITY_LABELS,
  COMMERCIAL_STATUS_LABELS,
} from "@/lib/commercial/catalogs"
import { resolveCommercialEtiquetaMapColor } from "@/lib/commercial/map-layers"
import type {
  CommercialMapBounds,
  CommercialMapOpportunity,
} from "@/lib/types/commercial"

type CommercialTerritoryMapCanvasProps = {
  opportunities: CommercialMapOpportunity[]
  selectedId: string | null
  pickMode?: boolean
  employeeNameById: Record<string, string>
  onBoundsChange: (bounds: CommercialMapBounds) => void
  onSelect: (id: string) => void
  onOpenDossier: (id: string) => void
  onPickLocation?: (coords: { latitude: number; longitude: number }) => void
  className?: string
}

function buildClientPopupHtml(
  opportunity: CommercialMapOpportunity,
  responsibleName: string
): string {
  const safeCode = escapeCommercialMapHtml(opportunity.code)
  const safeTitle = escapeCommercialMapHtml(opportunity.title)
  const safePerson = escapeCommercialMapHtml(opportunity.personName)
  const safeResponsible = escapeCommercialMapHtml(responsibleName)
  const etiquetaName = opportunity.etiquetaName?.trim()
  const etiquetaColor = resolveCommercialEtiquetaMapColor(
    opportunity.etiquetaColor
  )
  const etiquetaHtml = etiquetaName
    ? `<p style="margin:6px 0 0;display:flex;align-items:center;gap:6px;font-size:11px;color:#334155">
        <span style="display:inline-flex;align-items:center;gap:5px;border-radius:999px;background:${etiquetaColor}22;padding:2px 8px;color:#0f172a">
          <span style="width:8px;height:8px;border-radius:999px;background:${etiquetaColor};flex-shrink:0"></span>
          ${escapeCommercialMapHtml(etiquetaName)}
        </span>
      </p>`
    : ""

  return `
    <div style="min-width:180px;font-family:system-ui,sans-serif">
      <p style="margin:0;font-size:11px;color:#64748b;font-family:ui-monospace,monospace">${safeCode}</p>
      <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#0f172a">${safeTitle}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#475569">${safePerson}</p>
      ${etiquetaHtml}
      <p style="margin:6px 0 0;font-size:11px;color:#64748b">
        ${COMMERCIAL_STATUS_LABELS[opportunity.status]} · ${COMMERCIAL_PRIORITY_LABELS[opportunity.priority]}
      </p>
      <p style="margin:6px 0 0;font-size:11px;color:#64748b">${safeResponsible}</p>
      <button
        type="button"
        data-commercial-map-detail="${opportunity.id}"
        style="margin-top:8px;width:100%;border:1px solid #cbd5e1;border-radius:6px;background:#fff;padding:6px 8px;font-size:12px;cursor:pointer"
      >
        Abrir Ficha del Cliente
      </button>
    </div>
  `
}

/** Clientes map — mode="clients". Never shows Actividad Comercial pins. */
export function CommercialTerritoryMapCanvas({
  opportunities,
  selectedId,
  pickMode = false,
  employeeNameById,
  onBoundsChange,
  onSelect,
  onOpenDossier,
  onPickLocation,
  className,
}: CommercialTerritoryMapCanvasProps) {
  const markers = useMemo((): CommercialMapMarker[] => {
    return opportunities.map((opportunity) => {
      const responsible = opportunity.assignedEmployeeId
        ? employeeNameById[opportunity.assignedEmployeeId] || "Responsable"
        : "Sin responsable"
      return {
        id: opportunity.id,
        latitude: opportunity.latitude,
        longitude: opportunity.longitude,
        color: resolveCommercialEtiquetaMapColor(opportunity.etiquetaColor),
        popupHtml: buildClientPopupHtml(opportunity, responsible),
        detailActionId: opportunity.id,
      }
    })
  }, [employeeNameById, opportunities])

  return (
    <CommercialMapCanvas
      mode="clients"
      markers={markers}
      selectedId={selectedId}
      pickMode={pickMode}
      onBoundsChange={onBoundsChange}
      onSelect={onSelect}
      onOpenDetail={onOpenDossier}
      onPickLocation={onPickLocation}
      className={className}
    />
  )
}
