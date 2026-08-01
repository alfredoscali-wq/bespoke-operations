/**
 * Centro Ejecutivo Read Model — Sprint 22 / Bloque H.
 */

export type ExecutiveAttentionSeverity = "critical" | "important" | "info"

export type ExecutiveAttentionItem = {
  id: string
  severity: ExecutiveAttentionSeverity
  severityLabel: string
  title: string
  href: string
  hrefLabel: string
}

export type ExecutiveWinItem = {
  id: string
  title: string
}

export type ExecutiveDomainId =
  | "attention"
  | "operations"
  | "planning"
  | "commercial"
  | "administration"

export type ExecutiveDomainTrend = "up" | "stable" | "down"

export type ExecutiveDomainStatus = "ok" | "watch" | "alert"

export type ExecutiveDomainCard = {
  id: ExecutiveDomainId
  label: string
  status: ExecutiveDomainStatus
  statusLabel: string
  trend: ExecutiveDomainTrend
  trendLabel: string
  primaryLabel: string
  primaryValue: string
  href: string
}

export type ExecutiveDecisionItem = {
  id: string
  recommendation: string
  href: string
  hrefLabel: string
}

export type ExecutiveCenterReadModel = {
  date: string
  builtAt: number
  narrative: string
  attention: ExecutiveAttentionItem[]
  wins: ExecutiveWinItem[]
  domains: ExecutiveDomainCard[]
  decisions: ExecutiveDecisionItem[]
}
