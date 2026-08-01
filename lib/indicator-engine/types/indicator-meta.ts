/**
 * Canonical categories for Indicator Engine 2.0 registry entries.
 */

export const BUSINESS_INDICATOR_CATEGORIES = [
  "meta",
  "customers",
  "attention",
  "commercial",
  "workorders",
  "projects",
  "settings",
  "transitional",
] as const

export type BusinessIndicatorCategory =
  (typeof BUSINESS_INDICATOR_CATEGORIES)[number]

export const BUSINESS_INDICATOR_STATUSES = [
  "active",
  "deprecated",
  "draft",
  "transitional",
] as const

export type BusinessIndicatorStatus =
  (typeof BUSINESS_INDICATOR_STATUSES)[number]

/** Who owns the definition in the product architecture. */
export const BUSINESS_INDICATOR_OWNERS = [
  "indicator-engine",
  "platform",
] as const

export type BusinessIndicatorOwner =
  (typeof BUSINESS_INDICATOR_OWNERS)[number]

/** Where the indicator ultimately derives its facts from. */
export const BUSINESS_INDICATOR_ORIGINS = [
  "activity_events",
  "derived",
] as const

export type BusinessIndicatorOrigin =
  (typeof BUSINESS_INDICATOR_ORIGINS)[number]
