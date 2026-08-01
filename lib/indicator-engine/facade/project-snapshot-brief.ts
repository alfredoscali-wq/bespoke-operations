/**
 * Project Snapshot Engine brief (V2) into the ExecutiveBrief shape Sala already renders.
 * No new queries — uses BusinessSnapshot + BusinessDigest already built in Dual Read.
 */

import type { ExecutiveBrief, ExecutiveBriefScope } from "@/lib/executive/types"
import type { ExecutiveBriefV2 } from "@/lib/indicator-engine/contracts/brief"
import type { IndicatorSnapshot } from "@/lib/indicators/types"

export function projectSnapshotBriefToExecutiveBrief(
  briefV2: ExecutiveBriefV2,
  scope: ExecutiveBriefScope
): ExecutiveBrief {
  const snapshot: IndicatorSnapshot = {
    values: { ...briefV2.snapshot.payload.indicators },
  }

  return {
    scope,
    date: briefV2.date,
    narrative: briefV2.narrative,
    generalState: briefV2.generalState.map((metric) => ({ ...metric })),
    production: briefV2.production.map((block) => ({
      id: block.id,
      title: block.title,
      metrics: block.metrics.map((metric) => ({ ...metric })),
    })),
    operationalAlerts: briefV2.operationalAlerts.map((alert) => ({
      ...alert,
    })),
    relevantActivity: briefV2.relevantActivity.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      action: item.action,
      title: item.title,
      description: item.description,
      entityType: item.entityType,
      entityId: item.entityId,
      employeeId: item.employeeId,
    })),
    snapshot,
    firstEventAt: briefV2.firstEventAt,
    lastEventAt: briefV2.lastEventAt,
    activeTimeMs: briefV2.activeTimeMs,
  }
}
