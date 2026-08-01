/**
 * Official snapshot scope kinds for Indicator Engine 2.0.
 *
 * Extending the platform: append to SNAPSHOT_SCOPES (and tier map).
 * SnapshotIdentity / BusinessSnapshot shapes stay unchanged.
 */

export const SNAPSHOT_SCOPES = [
  "company",
  "employee",
  "crew",
  "project",
  "customer",
] as const

export type SnapshotScope = (typeof SNAPSHOT_SCOPES)[number]

export type SnapshotScopeTier = "P0" | "P1"

/**
 * Rollout priority. P0 is required for Analysis cutover;
 * P1 follows for entity / crew production views.
 */
export const SNAPSHOT_SCOPE_TIERS = {
  company: "P0",
  employee: "P0",
  crew: "P1",
  project: "P1",
  customer: "P1",
} as const satisfies Record<SnapshotScope, SnapshotScopeTier>

export const SNAPSHOT_SCOPES_P0 = [
  "company",
  "employee",
] as const satisfies readonly SnapshotScope[]

export const SNAPSHOT_SCOPES_P1 = [
  "crew",
  "project",
  "customer",
] as const satisfies readonly SnapshotScope[]

export function isSnapshotScope(value: string): value is SnapshotScope {
  return (SNAPSHOT_SCOPES as readonly string[]).includes(value)
}

export function getSnapshotScopeTier(scope: SnapshotScope): SnapshotScopeTier {
  return SNAPSHOT_SCOPE_TIERS[scope]
}

/** Company scope has no subject; all other scopes require a subject id. */
export function snapshotScopeRequiresSubject(scope: SnapshotScope): boolean {
  return scope !== "company"
}
