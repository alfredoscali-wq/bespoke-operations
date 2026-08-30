import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { ACTIVITY_ACTIONS, isActivityAction } from "../lib/activity-engine/activity-actions.ts"
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, AUDIT_MODULES } from "../lib/audit/types.ts"
import { APP_MODULE_KEYS, canAccessPathWithModules, createEmptyModuleVisibility } from "../lib/roles/app-modules.ts"
import { DEFAULT_COMPANY_AREA_MODULE_VISIBILITY } from "../lib/roles/company-areas.ts"
import {
  NETWORK_AGENT_STATUSES,
  NETWORK_JOB_STATUSES,
  NETWORK_JOB_TYPES,
  NETWORK_SITE_KINDS,
} from "../lib/network/constants.ts"
import {
  parseEnrollRequest,
  parseHeartbeatReport,
  resolveTrustedCompanyId,
  validateNetworkAgentDraft,
  validateNetworkSiteDraft,
} from "../lib/network/integrity.ts"
import { isNetworkApiPath } from "../lib/network/v1/routing.ts"
import { hashNetworkSecret, isNetworkAgentToken, isNetworkEnrollmentToken } from "../lib/network/tokens.ts"
import { generateNetworkAgentToken, generateNetworkEnrollmentToken } from "../lib/network/tokens.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

test("módulo network está en el catálogo y rutas", () => {
  assert.ok(APP_MODULE_KEYS.includes("network"))
  assert.equal(
    canAccessPathWithModules("/network", createEmptyModuleVisibility()),
    false
  )
  assert.equal(
    canAccessPathWithModules("/network/agents", {
      ...createEmptyModuleVisibility(),
      network: true,
    }),
    true
  )
  assert.equal(DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.tecnica.network, true)
  assert.equal(DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.operario.network, false)
  assert.equal(DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.ventas.network, false)
})

test("sitio y agent validan campos mínimos", () => {
  assert.equal(validateNetworkSiteDraft({ name: "  ", kind: "pop" }).ok, false)
  assert.equal(validateNetworkSiteDraft({ name: "POP Centro", kind: "pop" }).ok, true)
  assert.equal(validateNetworkAgentDraft({ name: "edge-1", siteId: "" }).ok, true)
  assert.equal(
    validateNetworkAgentDraft({ name: "edge-1", siteId: "site-1" }).ok,
    true
  )
  assert.deepEqual(NETWORK_SITE_KINDS, [
    "pop",
    "node",
    "tower",
    "datacenter",
    "office",
    "other",
  ])
  assert.deepEqual(NETWORK_AGENT_STATUSES, [
    "pending",
    "online",
    "degraded",
    "offline",
    "maintenance",
  ])
  assert.ok(NETWORK_JOB_TYPES.includes("discovery"))
  assert.ok(NETWORK_JOB_STATUSES.includes("pending"))
})

test("el tenant autenticado ignora company_id del payload del agent", () => {
  const trusted = "00000000-0000-4000-8000-000000000002"
  const claimed = "00000000-0000-4000-8000-000000000001"
  assert.equal(resolveTrustedCompanyId(trusted, claimed), trusted)
  assert.equal(resolveTrustedCompanyId(trusted, { id: claimed }), trusted)
})

test("enrollment y heartbeat no aceptan tenant libre", () => {
  const enroll = parseEnrollRequest({
    enrollmentToken: "bne_test",
    companyId: "00000000-0000-4000-8000-000000000001",
  })
  assert.equal(enroll.ok, true)
  if (enroll.ok) {
    assert.equal("companyId" in enroll, false)
    assert.equal(enroll.enrollmentToken, "bne_test")
  }

  const heartbeat = parseHeartbeatReport({
    status: "online",
    companyId: "00000000-0000-4000-8000-000000000001",
  })
  assert.equal(heartbeat.ok, true)
  if (heartbeat.ok) {
    assert.equal(heartbeat.report.status, "online")
    assert.equal("companyId" in heartbeat.report, false)
  }
})

test("tokens de agent y enrollment son distinguibles y se hashean", () => {
  const enrollment = generateNetworkEnrollmentToken()
  const agent = generateNetworkAgentToken()
  assert.equal(isNetworkEnrollmentToken(enrollment), true)
  assert.equal(isNetworkAgentToken(enrollment), false)
  assert.equal(isNetworkAgentToken(agent), true)
  assert.notEqual(hashNetworkSecret(agent), agent)
  assert.equal(hashNetworkSecret("abc").length, 64)
})

test("Agent API usa namespace propio y no Mobile API", () => {
  assert.equal(isNetworkApiPath("/api/network/v1/enroll"), true)
  assert.equal(isNetworkApiPath("/api/mobile/v1/auth/login"), false)
  assert.equal(isNetworkApiPath("/api/network/sites"), false)

  const proxy = read("proxy.ts")
  assert.match(proxy, /isNetworkApiPath/)
  assert.match(proxy, /isMobileApiPath/)

  const enrollRoute = read("app/api/network/v1/enroll/route.ts")
  assert.match(enrollRoute, /enrollNetworkAgent/)
  assert.doesNotMatch(enrollRoute, /mobile\/v1/)
})

test("Activity y Audit reutilizan engines existentes", () => {
  assert.equal(isActivityAction(ACTIVITY_ACTIONS.AGENT_ENROLLED), true)
  assert.equal(isActivityAction(ACTIVITY_ACTIONS.AGENT_STATUS_CHANGED), true)
  assert.equal(AUDIT_MODULES.NETWORK, "network")
  assert.equal(AUDIT_ENTITY_TYPES.NETWORK_AGENT, "network_agent")
  assert.equal(AUDIT_ACTIONS.NETWORK_AGENT_ENROLLED, "NETWORK_AGENT_ENROLLED")
  assert.equal(
    AUDIT_ACTIONS.NETWORK_AGENT_STATUS_CHANGED,
    "NETWORK_AGENT_STATUS_CHANGED"
  )
})

test("migración fundacional aísla por company_id y no toca isp_connections", () => {
  const sql = read("supabase/migrations/20261150000100_network_0_foundation.sql")
  assert.match(sql, /CREATE TABLE public.network_sites/)
  assert.match(sql, /CREATE TABLE public.network_agents/)
  assert.match(sql, /CREATE TABLE public.network_agent_jobs/)
  assert.match(sql, /auth_user_company_id\(\)/)
  assert.match(sql, /auth_user_has_allowed_module\('network'\)/)
  assert.match(sql, /auth_is_demo_platform_read_only\(\)/)
  assert.match(sql, /Tenant is always taken from this row/)
  assert.doesNotMatch(sql, /ALTER TABLE public.isp_connections/)
  assert.doesNotMatch(sql, /CREATE TABLE public.isp_/)
})
