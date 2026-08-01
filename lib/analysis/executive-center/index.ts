/**
 * Centro Ejecutivo — Sprint 22 / Bloque H.
 */

export { buildExecutiveCenterReadModel } from "@/lib/analysis/executive-center/builder"

export {
  prepareExecutiveCenterExport,
  type ExecutiveCenterExportFormat,
  type ExecutiveCenterExportResult,
} from "@/lib/analysis/executive-center/export"

export {
  buildAttentionItems,
  buildDecisionItems,
  buildDomainCards,
  buildWinItems,
} from "@/lib/analysis/executive-center/rules"

export type {
  ExecutiveAttentionItem,
  ExecutiveAttentionSeverity,
  ExecutiveCenterReadModel,
  ExecutiveDecisionItem,
  ExecutiveDomainCard,
  ExecutiveDomainId,
  ExecutiveDomainStatus,
  ExecutiveDomainTrend,
  ExecutiveWinItem,
} from "@/lib/analysis/executive-center/types"
