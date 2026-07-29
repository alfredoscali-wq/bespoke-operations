import type { CommercialOpportunity } from "@/lib/types/commercial"
import type { CommercialEtiqueta } from "@/lib/types/commercial-etiquetas"

export function indexCommercialEtiquetasById(
  etiquetas: CommercialEtiqueta[]
): Map<string, CommercialEtiqueta> {
  return new Map(etiquetas.map((entry) => [entry.id, entry]))
}

/** Attach etiqueta name/color for UI badges and map pins. */
export function enrichOpportunityWithEtiqueta<T extends CommercialOpportunity>(
  opportunity: T,
  etiquetasById: Map<string, CommercialEtiqueta>
): T {
  if (!opportunity.etiquetaId) {
    return {
      ...opportunity,
      etiquetaName: null,
      etiquetaColor: null,
    }
  }

  const etiqueta = etiquetasById.get(opportunity.etiquetaId)
  if (!etiqueta) {
    return opportunity
  }

  return {
    ...opportunity,
    etiquetaName: etiqueta.name,
    etiquetaColor: etiqueta.color,
  }
}
