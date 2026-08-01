import type { ExecutiveBriefV2 } from "@/lib/indicator-engine/contracts/brief"
import { validateBusinessDigest } from "@/lib/indicator-engine/contracts/digest"
import { validateBusinessSnapshot } from "@/lib/indicator-engine/snapshot/validate-snapshot"

/**
 * Structural validation for Executive Brief V2 (no business rules).
 */
export function validateExecutiveBrief(brief: ExecutiveBriefV2): string[] {
  const errors: string[] = []

  if (brief == null || typeof brief !== "object") {
    return ["Brief is incomplete: missing root object."]
  }

  if (!brief.identity) {
    errors.push("Brief is incomplete: missing identity.")
  }

  if (typeof brief.date !== "string" || !brief.date.trim()) {
    errors.push("Brief is missing date.")
  }

  if (typeof brief.narrative !== "string") {
    errors.push("Brief is missing narrative.")
  }

  if (!Array.isArray(brief.generalState)) {
    errors.push("Brief.generalState must be an array.")
  }

  if (!Array.isArray(brief.production)) {
    errors.push("Brief.production must be an array.")
  }

  if (!Array.isArray(brief.operationalAlerts)) {
    errors.push("Brief.operationalAlerts must be an array.")
  }

  if (!Array.isArray(brief.relevantActivity)) {
    errors.push("Brief.relevantActivity must be an array.")
  }

  if (!brief.snapshot) {
    errors.push("Brief is incomplete: missing snapshot.")
  } else {
    errors.push(...validateBusinessSnapshot(brief.snapshot))
  }

  if (!brief.digest) {
    errors.push("Brief is incomplete: missing digest.")
  } else {
    errors.push(...validateBusinessDigest(brief.digest))
  }

  if (brief.firstEventAt !== null && typeof brief.firstEventAt !== "string") {
    errors.push("Brief.firstEventAt must be string or null.")
  }

  if (brief.lastEventAt !== null && typeof brief.lastEventAt !== "string") {
    errors.push("Brief.lastEventAt must be string or null.")
  }

  if (typeof brief.activeTimeMs !== "number") {
    errors.push("Brief.activeTimeMs must be a number.")
  }

  return errors
}

export function assertExecutiveBriefValidInDevelopment(
  brief: ExecutiveBriefV2
): void {
  if (process.env.NODE_ENV === "production") return

  const errors = validateExecutiveBrief(brief)
  if (errors.length === 0) return

  throw new Error(
    [
      "Executive Brief validation failed (development only):",
      ...errors.map((error) => `  - ${error}`),
    ].join("\n")
  )
}
