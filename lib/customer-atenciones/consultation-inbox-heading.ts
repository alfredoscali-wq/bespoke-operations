import {
  formatCustomerAtencionMotivoLabel,
} from "@/lib/customer-atenciones/format"
import {
  isSharedInboxUiWorkTray,
  SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG,
  type SharedInboxQuery,
  type SharedInboxWorkTray,
} from "@/lib/customer-atenciones/shared-inbox"

/** UX 3.1 — bandeja heading for the active KPI / queue selection. */
const WORK_TRAY_INBOX_TITLES: Partial<Record<SharedInboxWorkTray, string>> = {
  administracion: "Administración",
  tecnica: "Técnica",
  espera_cliente: "Esperando respuesta del cliente",
  morosos: "Facturación - Morosos",
  retenciones: "Retenciones",
  por_tomar: "Para Resolver",
  ventas: "Ventas",
  generar_ot: "OT por Generar",
  en_gestion: "En gestión",
}

/**
 * UX 3.1 §8 — title/subtitle for the work tray result.
 * No row counters: the bandeja dataset is a capped operational fetch, so a
 * numeric subtitle would look like a company-wide total and diverge from KPIs.
 */
export function resolveConsultationInboxHeading(
  query: SharedInboxQuery
): { title: string; subtitle: string } {
  if (query.workTray && isSharedInboxUiWorkTray(query.workTray)) {
    return {
      title: WORK_TRAY_INBOX_TITLES[query.workTray] ?? query.workTray,
      subtitle: "Consultas pendientes de esta cola",
    }
  }

  if (query.operationalCategory) {
    return {
      title:
        SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG[query.operationalCategory]
          .label,
      subtitle: "Consultas de este indicador",
    }
  }

  if (query.statusFilter === "resueltas_hoy") {
    return {
      title: "Resueltas Hoy",
      subtitle: "Consultas cerradas en la jornada",
    }
  }

  if (query.motivo && query.motivo !== "all") {
    return {
      title: formatCustomerAtencionMotivoLabel(query.motivo),
      subtitle: "Consultas con este motivo",
    }
  }

  return {
    title: "Todas las consultas",
    subtitle: "Resultado de la selección actual",
  }
}
