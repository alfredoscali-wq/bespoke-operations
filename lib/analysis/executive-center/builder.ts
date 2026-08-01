/**
 * ExecutiveCenterReadBuilder — single model for Centro Ejecutivo.
 */

import type { ExecutiveBrief } from "@/lib/executive/types"
import {
  buildAttentionItems,
  buildDecisionItems,
  buildDomainCards,
  buildWinItems,
} from "@/lib/analysis/executive-center/rules"
import type { ExecutiveCenterReadModel } from "@/lib/analysis/executive-center/types"

export function buildExecutiveCenterReadModel(input: {
  date: string
  brief: ExecutiveBrief
  now?: number
}): ExecutiveCenterReadModel {
  const attention = buildAttentionItems(input.brief)
  const wins = buildWinItems(input.brief)
  const domains = buildDomainCards(input.brief)
  const decisions = buildDecisionItems(input.brief, attention)

  return {
    date: input.date,
    builtAt: input.now ?? Date.now(),
    narrative: input.brief.narrative,
    attention,
    wins,
    domains,
    decisions,
  }
}
