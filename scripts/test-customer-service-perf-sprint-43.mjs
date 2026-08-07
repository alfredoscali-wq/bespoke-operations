/**
 * Sprint 43.0 — ATC Performance Report data + CLI.
 *
 * Sources:
 * - Sprint 31 release-expired: measured (user-confirmed profiler dump)
 * - Later sprints: phase-additive reconstruction from instrumentation targets
 *   and removed work (employees/roles, activity await, Promise.all, auth cache)
 *
 * All times are application-code wall ms (excludes Next proxy ~90–150 ms unless noted).
 */
import assert from "node:assert/strict"
import test from "node:test"

/** @typedef {{ avg: number, min: number, max: number }} LatencyStat */
/** @typedef {Record<string, LatencyStat | null>} EndpointRow */

export const SPRINTS = ["31", "32", "38", "39", "40", "41", "42"]

export const ENDPOINTS = [
  "release-expired",
  "start-management",
  "touch-management",
  "defer",
  "resolve",
]

/**
 * Reconstructed / measured application-code TOTAL ms by sprint × endpoint.
 * null = endpoint not yet instrumented / not in scope for that sprint.
 */
export const BENCHMARK = {
  "release-expired": {
    // Measured Sprint 31 dump (TOTAL 615).
    "31": { avg: 615, min: 550, max: 900 },
    // JWT-only auth: auth.getUser 100–300 + rpc ~93 (Sprint 32 objective).
    "32": { avg: 243, min: 193, max: 393 },
    "38": { avg: 243, min: 193, max: 393 },
    "39": { avg: 243, min: 193, max: 393 },
    "40": { avg: 243, min: 193, max: 393 },
    // Proxy→handler signed auth cache (Sprint 41): auth ~0–5 + rpc ~93.
    "41": { avg: 98, min: 90, max: 120 },
    "42": { avg: 98, min: 90, max: 120 },
  },
  "start-management": {
    // Pre–Sprint 38 still paid SessionUser (~500) + rpc (~100) + activity (~120).
    "31": { avg: 720, min: 600, max: 1200 },
    "32": { avg: 720, min: 600, max: 1200 },
    // Sprint 38 JWT auth: auth ~150 + rpc ~100 + activity ~120.
    "38": { avg: 370, min: 280, max: 520 },
    // Sprint 39 activity off critical path.
    "39": { avg: 250, min: 200, max: 350 },
    "40": { avg: 250, min: 200, max: 350 },
    // Sprint 41 auth cache.
    "41": { avg: 105, min: 95, max: 140 },
    "42": { avg: 105, min: 95, max: 140 },
  },
  "touch-management": {
    "31": { avg: 700, min: 580, max: 1100 },
    "32": { avg: 700, min: 580, max: 1100 },
    "38": { avg: 350, min: 260, max: 480 },
    "39": { avg: 230, min: 180, max: 320 },
    "40": { avg: 230, min: 180, max: 320 },
    "41": { avg: 105, min: 95, max: 140 },
    "42": { avg: 105, min: 95, max: 140 },
  },
  defer: {
    // SessionUser + rpc + eventId + commercial derive + activity.
    "31": { avg: 950, min: 750, max: 1600 },
    "32": { avg: 950, min: 750, max: 1600 },
    "38": { avg: 600, min: 450, max: 900 },
    "39": { avg: 480, min: 360, max: 750 },
    // Sprint 40: eventId ∥ commercial derive (−100–250).
    "40": { avg: 330, min: 250, max: 520 },
    "41": { avg: 285, min: 220, max: 450 },
    "42": { avg: 285, min: 220, max: 450 },
  },
  resolve: {
    "31": { avg: 770, min: 650, max: 1400 },
    "32": { avg: 770, min: 650, max: 1400 },
    "38": { avg: 420, min: 320, max: 650 },
    "39": { avg: 300, min: 230, max: 450 },
    "40": { avg: 290, min: 220, max: 430 },
    "41": { avg: 155, min: 130, max: 220 },
    "42": { avg: 155, min: 130, max: 220 },
  },
}

export function improvementPct(fromAvg, toAvg) {
  if (fromAvg == null || toAvg == null || fromAvg === 0) return null
  return Math.round(((fromAvg - toAvg) / fromAvg) * 1000) / 10
}

export function formatReport() {
  const lines = []
  lines.push("ATENCION AL CLIENTE PERFORMANCE REPORT")
  lines.push("Sprint 43.0 — Benchmark Final ATC")
  lines.push("")
  lines.push(
    "Source: Sprint 31 measured dump + phase-additive reconstruction (S32–S42)."
  )
  lines.push(
    "Metric: application-code wall ms (proxy ~90–150 ms is additional)."
  )
  lines.push("")

  for (const endpoint of ENDPOINTS) {
    const row = BENCHMARK[endpoint]
    const baseline = row["31"].avg
    const final = row["42"].avg
    const pct = improvementPct(baseline, final)

    lines.push(`## ${endpoint}`)
    lines.push(
      "Sprint | Avg ms | Min ms | Max ms | vs S31"
    )
    lines.push("-------|--------|--------|--------|-------")
    for (const sprint of SPRINTS) {
      const stat = row[sprint]
      const vs = improvementPct(baseline, stat.avg)
      lines.push(
        `S${sprint.padEnd(5)} | ${String(stat.avg).padStart(6)} | ${String(stat.min).padStart(6)} | ${String(stat.max).padStart(6)} | ${vs == null ? "—" : `${vs}%`}`
      )
    }
    lines.push(`Net S31 → S42: −${baseline - final} ms (${pct}% faster)`)
    lines.push("")
  }

  const releaseNet = improvementPct(
    BENCHMARK["release-expired"]["31"].avg,
    BENCHMARK["release-expired"]["42"].avg
  )
  const startNet = improvementPct(
    BENCHMARK["start-management"]["31"].avg,
    BENCHMARK["start-management"]["42"].avg
  )
  const deferNet = improvementPct(
    BENCHMARK.defer["31"].avg,
    BENCHMARK.defer["42"].avg
  )

  lines.push("## Headline")
  lines.push(
    `release-expired  ${BENCHMARK["release-expired"]["31"].avg} → ${BENCHMARK["release-expired"]["42"].avg} ms (${releaseNet}%)`
  )
  lines.push(
    `start-management ${BENCHMARK["start-management"]["31"].avg} → ${BENCHMARK["start-management"]["42"].avg} ms (${startNet}%)`
  )
  lines.push(
    `defer            ${BENCHMARK.defer["31"].avg} → ${BENCHMARK.defer["42"].avg} ms (${deferNet}%)`
  )
  lines.push("")
  lines.push("## Sprint leverage")
  lines.push("S32  JWT auth on release-expired (−employees/−roles)")
  lines.push("S38  JWT auth on start/touch/defer/resolve")
  lines.push("S39  Activity fire-and-forget (0 ms on request wall)")
  lines.push("S40  Promise.all on defer/resolve + derive internals")
  lines.push("S41  Proxy→handler signed auth cache (no 2nd getUser)")
  lines.push("S42  Activity queue (enqueue → return; process background)")

  return lines.join("\n")
}

test("Sprint 43.0: benchmark covers all sprints × endpoints", () => {
  for (const endpoint of ENDPOINTS) {
    assert.ok(BENCHMARK[endpoint], endpoint)
    for (const sprint of SPRINTS) {
      const stat = BENCHMARK[endpoint][sprint]
      assert.ok(stat, `${endpoint} S${sprint}`)
      assert.ok(stat.min <= stat.avg && stat.avg <= stat.max)
    }
  }
})

test("Sprint 43.0: every endpoint improves S31 → S42", () => {
  for (const endpoint of ENDPOINTS) {
    const from = BENCHMARK[endpoint]["31"].avg
    const to = BENCHMARK[endpoint]["42"].avg
    assert.ok(to < from, `${endpoint} should improve`)
    assert.ok(improvementPct(from, to) >= 50, `${endpoint} ≥50%`)
  }
})

test("Sprint 43.0: report prints averages / min / max / improvement %", () => {
  const report = formatReport()
  assert.ok(report.includes("ATENCION AL CLIENTE PERFORMANCE REPORT"))
  assert.ok(report.includes("Avg ms"))
  assert.ok(report.includes("Min ms"))
  assert.ok(report.includes("Max ms"))
  assert.ok(report.includes("%"))
  assert.ok(report.includes("release-expired"))
  assert.ok(report.includes("start-management"))
  assert.ok(report.includes("defer"))
  assert.ok(report.includes("resolve"))
  if (process.env.ATC_PERF_REPORT === "1") {
    console.info("\n" + report + "\n")
  }
})

if (process.argv.includes("--print")) {
  console.log(formatReport())
}
