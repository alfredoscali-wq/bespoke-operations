/**
 * Business rules for Centro Ejecutivo — no AI, no free-form generation.
 * Built exclusively from Executive Brief indicator values + alerts.
 */

import type { ExecutiveBrief } from "@/lib/executive/types"
import { indicatorCount, INDICATOR_IDS } from "@/lib/indicators"
import type {
  ExecutiveAttentionItem,
  ExecutiveDecisionItem,
  ExecutiveDomainCard,
  ExecutiveWinItem,
} from "@/lib/analysis/executive-center/types"

const HREF = {
  attention: "/atencion-cliente",
  operations: "/activity/cuadrillas",
  planning: "/operations/planificacion",
  commercial: "/gestion-comercial/oportunidades",
  sala: "/activity",
  workforce: "/activity/workforce-monitor",
  jornada: "/activity/jornada",
} as const

function get(brief: ExecutiveBrief, id: string): number {
  return indicatorCount(brief.snapshot, id)
}

function severityLabel(
  severity: ExecutiveAttentionItem["severity"]
): string {
  if (severity === "critical") return "Crítico"
  if (severity === "important") return "Importante"
  return "Informativo"
}

export function buildAttentionItems(
  brief: ExecutiveBrief
): ExecutiveAttentionItem[] {
  const items: ExecutiveAttentionItem[] = []
  const started = get(brief, INDICATOR_IDS.WORKORDERS_STARTED)
  const finished = get(brief, INDICATOR_IDS.WORKORDERS_FINISHED)
  const openOt = Math.max(0, started - finished)
  const rescheduled = get(brief, INDICATOR_IDS.WORKORDERS_RESCHEDULED)
  const cancelled = get(brief, INDICATOR_IDS.WORKORDERS_CANCELLED)
  const attCreated = get(brief, INDICATOR_IDS.ATTENTIONS_CREATED)
  const attResolved = get(brief, INDICATOR_IDS.ATTENTIONS_RESOLVED)
  const openAtt = Math.max(0, attCreated - attResolved)
  const transferred = get(brief, INDICATOR_IDS.ATTENTIONS_TRANSFERRED)
  const projectsActive = get(brief, INDICATOR_IDS.PROJECTS_ACTIVE)
  const projectsFinished = get(brief, INDICATOR_IDS.PROJECTS_FINISHED)
  const requestsCreated = get(brief, INDICATOR_IDS.REQUESTS_CREATED)
  const requestsResolved = get(brief, INDICATOR_IDS.REQUESTS_RESOLVED)
  const openRequests = Math.max(0, requestsCreated - requestsResolved)

  if (openOt >= 10) {
    items.push({
      id: "ot-open-critical",
      severity: "critical",
      severityLabel: severityLabel("critical"),
      title: `Hay ${openOt} OT iniciadas sin cierre en la jornada.`,
      href: HREF.operations,
      hrefLabel: "Ver producción",
    })
  } else if (openOt >= 3) {
    items.push({
      id: "ot-open-important",
      severity: "important",
      severityLabel: severityLabel("important"),
      title: `Hay ${openOt} OT fuera de ritmo de cierre.`,
      href: HREF.planning,
      hrefLabel: "Abrir Planning",
    })
  } else if (openOt > 0) {
    items.push({
      id: "ot-open-info",
      severity: "info",
      severityLabel: severityLabel("info"),
      title: `${openOt} OT siguen abiertas en el día.`,
      href: HREF.operations,
      hrefLabel: "Ver producción",
    })
  }

  if (rescheduled >= 3) {
    items.push({
      id: "ot-reschedule",
      severity: "important",
      severityLabel: severityLabel("important"),
      title: `Se reprogramaron ${rescheduled} órdenes de trabajo.`,
      href: HREF.planning,
      hrefLabel: "Revisar Planning",
    })
  }

  if (cancelled > 0) {
    items.push({
      id: "ot-cancelled",
      severity: "important",
      severityLabel: severityLabel("important"),
      title: `Hay ${cancelled} OT cancelada${cancelled === 1 ? "" : "s"} en la jornada.`,
      href: HREF.operations,
      hrefLabel: "Ver producción",
    })
  }

  if (openAtt >= 15) {
    items.push({
      id: "att-open-critical",
      severity: "critical",
      severityLabel: severityLabel("critical"),
      title: `Administración acumula ${openAtt} consultas pendientes.`,
      href: HREF.attention,
      hrefLabel: "Ir a Atención",
    })
  } else if (openAtt >= 5) {
    items.push({
      id: "att-open-important",
      severity: "important",
      severityLabel: severityLabel("important"),
      title: `Existen ${openAtt} consultas esperando respuesta.`,
      href: HREF.attention,
      hrefLabel: "Ir a Atención",
    })
  } else if (openAtt > 0) {
    items.push({
      id: "att-open-info",
      severity: "info",
      severityLabel: severityLabel("info"),
      title: `${openAtt} consulta${openAtt === 1 ? "" : "s"} pendiente${openAtt === 1 ? "" : "s"} en Atención.`,
      href: HREF.attention,
      hrefLabel: "Ir a Atención",
    })
  }

  if (transferred >= 3) {
    items.push({
      id: "att-transferred",
      severity: "important",
      severityLabel: severityLabel("important"),
      title: `${transferred} consultas fueron derivadas y requieren seguimiento.`,
      href: HREF.attention,
      hrefLabel: "Seguir en Atención",
    })
  }

  if (projectsActive > 0 && projectsFinished === 0 && openOt >= 5) {
    items.push({
      id: "projects-risk",
      severity: "important",
      severityLabel: severityLabel("important"),
      title: "Hay obras activas que podrían demorarse por OT abiertas.",
      href: HREF.planning,
      hrefLabel: "Revisar Planning",
    })
  }

  if (openRequests >= 3) {
    items.push({
      id: "commercial-pending",
      severity: "important",
      severityLabel: severityLabel("important"),
      title: `Existen ${openRequests} solicitudes comerciales pendientes.`,
      href: HREF.commercial,
      hrefLabel: "Abrir Comercial",
    })
  } else if (openRequests > 0) {
    items.push({
      id: "commercial-pending-info",
      severity: "info",
      severityLabel: severityLabel("info"),
      title: `${openRequests} solicitud${openRequests === 1 ? "" : "es"} comercial${openRequests === 1 ? "" : "es"} pendiente${openRequests === 1 ? "" : "s"}.`,
      href: HREF.commercial,
      hrefLabel: "Abrir Comercial",
    })
  }

  const severityRank = { critical: 0, important: 1, info: 2 } as const
  return items.sort(
    (left, right) =>
      severityRank[left.severity] - severityRank[right.severity]
  )
}

export function buildWinItems(brief: ExecutiveBrief): ExecutiveWinItem[] {
  const wins: ExecutiveWinItem[] = []
  const started = get(brief, INDICATOR_IDS.WORKORDERS_STARTED)
  const finished = get(brief, INDICATOR_IDS.WORKORDERS_FINISHED)
  const cancelled = get(brief, INDICATOR_IDS.WORKORDERS_CANCELLED)
  const attCreated = get(brief, INDICATOR_IDS.ATTENTIONS_CREATED)
  const attResolved = get(brief, INDICATOR_IDS.ATTENTIONS_RESOLVED)
  const crews = get(brief, INDICATOR_IDS.CREWS_ACTIVE)
  const openAtt = Math.max(0, attCreated - attResolved)

  if (crews > 0 && started > 0) {
    wins.push({
      id: "crews-started",
      title: "Las cuadrillas registraron inicio de actividad en la jornada.",
    })
  }

  if (attCreated > 0 && attResolved >= attCreated) {
    wins.push({
      id: "attention-cleared",
      title: "Atención resolvió el 100 % de las consultas del día.",
    })
  } else if (attCreated > 0 && attResolved / attCreated >= 0.9) {
    const rate = Math.round((attResolved / attCreated) * 100)
    wins.push({
      id: "attention-high",
      title: `Atención resolvió el ${rate} % de los expedientes.`,
    })
  }

  if (cancelled === 0 && (started > 0 || finished > 0)) {
    wins.push({
      id: "no-cancellations",
      title: "No hubo cancelaciones de OT en la jornada.",
    })
  }

  if (openAtt === 0 && attCreated > 0) {
    wins.push({
      id: "no-waiting",
      title: "No quedan consultas pendientes del día.",
    })
  }

  if (started > 0 && finished >= started) {
    wins.push({
      id: "ot-closed",
      title: "Se completaron todas las OT iniciadas en el día.",
    })
  } else if (finished > 0 && started > 0 && finished / started >= 0.85) {
    wins.push({
      id: "ot-strong",
      title: "Se cerró la mayoría de las OT prioritarias iniciadas.",
    })
  }

  if (finished > 0 && crews > 0) {
    wins.push({
      id: "production-pulse",
      title: "La operación mantiene ritmo productivo con OT finalizadas.",
    })
  }

  return wins.slice(0, 5)
}

function domainStatus(
  alert: boolean,
  watch: boolean
): Pick<ExecutiveDomainCard, "status" | "statusLabel"> {
  if (alert) return { status: "alert", statusLabel: "Requiere atención" }
  if (watch) return { status: "watch", statusLabel: "En observación" }
  return { status: "ok", statusLabel: "Estable" }
}

function domainTrend(
  positive: boolean,
  negative: boolean
): Pick<ExecutiveDomainCard, "trend" | "trendLabel"> {
  if (positive) return { trend: "up", trendLabel: "Mejora" }
  if (negative) return { trend: "down", trendLabel: "Empeora" }
  return { trend: "stable", trendLabel: "Sin cambio" }
}

export function buildDomainCards(
  brief: ExecutiveBrief
): ExecutiveDomainCard[] {
  const started = get(brief, INDICATOR_IDS.WORKORDERS_STARTED)
  const finished = get(brief, INDICATOR_IDS.WORKORDERS_FINISHED)
  const openOt = Math.max(0, started - finished)
  const rescheduled = get(brief, INDICATOR_IDS.WORKORDERS_RESCHEDULED)
  const attCreated = get(brief, INDICATOR_IDS.ATTENTIONS_CREATED)
  const attResolved = get(brief, INDICATOR_IDS.ATTENTIONS_RESOLVED)
  const openAtt = Math.max(0, attCreated - attResolved)
  const transferred = get(brief, INDICATOR_IDS.ATTENTIONS_TRANSFERRED)
  const requestsCreated = get(brief, INDICATOR_IDS.REQUESTS_CREATED)
  const requestsResolved = get(brief, INDICATOR_IDS.REQUESTS_RESOLVED)
  const commercialDone = get(brief, INDICATOR_IDS.COMMERCIAL_COMPLETED)
  const openRequests = Math.max(0, requestsCreated - requestsResolved)
  const finishRate =
    started > 0 ? Math.round((finished / started) * 100) : finished > 0 ? 100 : 0
  const resolveRate =
    attCreated > 0
      ? Math.round((attResolved / attCreated) * 100)
      : attResolved > 0
        ? 100
        : 0

  const attention = domainStatus(openAtt >= 15, openAtt >= 5)
  const operations = domainStatus(openOt >= 10, openOt >= 3)
  const planning = domainStatus(rescheduled >= 5, rescheduled >= 2)
  const commercial = domainStatus(openRequests >= 5, openRequests >= 2)
  const administration = domainStatus(transferred >= 5 || openAtt >= 15, transferred >= 2)

  return [
    {
      id: "attention",
      label: "Atención",
      ...attention,
      ...domainTrend(resolveRate >= 90 && attCreated > 0, openAtt >= 10),
      primaryLabel: "Resolución",
      primaryValue: attCreated > 0 || attResolved > 0 ? `${resolveRate}%` : "—",
      href: HREF.attention,
    },
    {
      id: "operations",
      label: "Operaciones",
      ...operations,
      ...domainTrend(finishRate >= 85 && started > 0, openOt >= 8),
      primaryLabel: "Cierre OT",
      primaryValue: started > 0 || finished > 0 ? `${finishRate}%` : "—",
      href: HREF.operations,
    },
    {
      id: "planning",
      label: "Planning",
      ...planning,
      ...domainTrend(rescheduled === 0 && finished > 0, rescheduled >= 3),
      primaryLabel: "Reprogramadas",
      primaryValue: String(rescheduled),
      href: HREF.planning,
    },
    {
      id: "commercial",
      label: "Comercial",
      ...commercial,
      ...domainTrend(commercialDone > 0 && openRequests === 0, openRequests >= 3),
      primaryLabel: "Completadas",
      primaryValue: String(commercialDone),
      href: HREF.commercial,
    },
    {
      id: "administration",
      label: "Administración",
      ...administration,
      ...domainTrend(openAtt === 0 && attCreated > 0, openAtt >= 10),
      primaryLabel: "Pendientes",
      primaryValue: String(openAtt),
      href: HREF.attention,
    },
  ]
}

export function buildDecisionItems(
  brief: ExecutiveBrief,
  attention: ExecutiveAttentionItem[]
): ExecutiveDecisionItem[] {
  const decisions: ExecutiveDecisionItem[] = []
  const started = get(brief, INDICATOR_IDS.WORKORDERS_STARTED)
  const finished = get(brief, INDICATOR_IDS.WORKORDERS_FINISHED)
  const openOt = Math.max(0, started - finished)
  const openAtt = Math.max(
    0,
    get(brief, INDICATOR_IDS.ATTENTIONS_CREATED) -
      get(brief, INDICATOR_IDS.ATTENTIONS_RESOLVED)
  )
  const openRequests = Math.max(
    0,
    get(brief, INDICATOR_IDS.REQUESTS_CREATED) -
      get(brief, INDICATOR_IDS.REQUESTS_RESOLVED)
  )
  const rescheduled = get(brief, INDICATOR_IDS.WORKORDERS_RESCHEDULED)

  if (openOt >= 5) {
    decisions.push({
      id: "reassign-crew",
      recommendation:
        "Conviene reasignar capacidad operativa para cerrar OT abiertas antes de fin de jornada.",
      href: HREF.planning,
      hrefLabel: "Ir a Planning",
    })
  }

  if (openAtt >= 5) {
    decisions.push({
      id: "support-attention",
      recommendation:
        "Administración requiere apoyo para evitar demoras en consultas pendientes.",
      href: HREF.attention,
      hrefLabel: "Ir a Atención",
    })
  }

  if (openRequests >= 2) {
    decisions.push({
      id: "recover-commercial",
      recommendation: `Existen oportunidades de recuperar ${openRequests} solicitud${openRequests === 1 ? "" : "es"} comercial${openRequests === 1 ? "" : "es"} pendiente${openRequests === 1 ? "" : "s"}.`,
      href: HREF.commercial,
      hrefLabel: "Abrir Comercial",
    })
  }

  if (rescheduled >= 3) {
    decisions.push({
      id: "stabilize-planning",
      recommendation:
        "Conviene revisar la ruta del día para estabilizar las reprogramaciones.",
      href: HREF.planning,
      hrefLabel: "Revisar Planning",
    })
  }

  if (decisions.length === 0 && attention.length > 0) {
    const top = attention[0]
    decisions.push({
      id: "follow-top-attention",
      recommendation: `Priorizar ahora: ${top.title.replace(/\.$/, "")}.`,
      href: top.href,
      hrefLabel: top.hrefLabel,
    })
  }

  if (decisions.length === 0) {
    decisions.push({
      id: "maintain-pace",
      recommendation:
        "La jornada está bajo control. Mantener el ritmo y revisar Sala de Situación al cierre.",
      href: HREF.sala,
      hrefLabel: "Abrir Sala",
    })
  }

  return decisions.slice(0, 4)
}
