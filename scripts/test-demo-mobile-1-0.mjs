/**
 * Sprint Demo Mobile 1.0 — isolation, public /demo page, Mobile write path.
 * Source-contract + in-memory policy. Does not mutate ABNet.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { decideDemoMobileDeviceCrewBinding } from "../lib/demo/bind-demo-mobile-device.ts"
import {
  BESPOKE_DEMO_COMPANY_ID,
  BESPOKE_DEMO_COMPANY_NAME,
  DEMO_ADMIN_EMAIL,
  DEMO_COMMERCIAL_USERNAME,
  DEMO_LANDING_PATH,
  DEMO_MOBILE_APK_DOWNLOAD_PATH,
  DEMO_MOBILE_COMPANY_CODE,
  DEMO_MOBILE_COMPANY_CODE_DISPLAY,
  DEMO_MOBILE_CREW_NAME,
  DEMO_MOBILE_DEVICE_ID,
  DEMO_MOBILE_TASK_CODES,
  DEMO_OPERARIO_EMAIL,
  DEMO_OPERARIO_EMPLOYEE_CODE,
} from "../lib/demo/constants.ts"
import { DEMO_MOBILE_TASK_DEFINITIONS } from "../lib/demo/demo-mobile-checklists.ts"
import { resolveDemoCommercialAuthEmail } from "../lib/demo/login-alias.ts"
import { isAllowedDemoApkRedirectUrl } from "../lib/demo/mobile-apk.ts"
import { isDemoCompanyId, isDemoPlatformReadOnlyUser } from "../lib/demo/demo-mode.ts"
import { evaluateGpsLiveHeartbeatGate } from "../lib/gps-live/heartbeat-policy.ts"
import { isAuthPublicPath, LOGIN_PATH } from "../lib/auth/routes.ts"
import { isFieldAgentAgendaTaskVisible } from "../lib/mobile/v1/agenda/agenda-task-visibility.ts"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "../lib/supabase/company.constants.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const DEMO = BESPOKE_DEMO_COMPANY_ID
const ABNET = BESPOKE_PRODUCTION_COMPANY_ID
const DEMO_CREW = "crew-demo-1"
const ABNET_CREW = "crew-abnet-1"

const page = read("app/demo/page.tsx")
const landing = read("components/demo/demo-landing-page.tsx")
const layout = read("app/demo/layout.tsx")
const apkRoute = read("app/api/demo/apk/route.ts")
const credentials = read("lib/demo/public-credentials.server.ts")
const provision = read("lib/mobile/v1/devices/provision-service.ts")
const prepare = read("lib/demo/prepare-demo-mobile-tenant.ts")
const seedMobile = read("scripts/seed-demo-mobile.ts")
const seedCompany = read("scripts/seed-demo-company.ts")
const taskStart = read("lib/mobile/v1/tasks/task-start-service.ts")
const taskSubmit = read("lib/mobile/v1/tasks/task-submit-service.ts")
const checklist = read("lib/mobile/v1/tasks/task-checklist-service.ts")
const checklistPhoto = read("lib/mobile/v1/tasks/task-checklist-photo-service.ts")
const executionAccess = read("lib/mobile/v1/tasks/task-execution-access.ts")
const heartbeat = read("lib/mobile/v1/gps/gps-heartbeat-service.ts")
const agenda = read("lib/mobile/v1/agenda/agenda-service.ts")
const bootstrap = read("lib/mobile/v1/bootstrap/bootstrap-service.ts")
const routes = read("lib/auth/routes.ts")
const constants = read("lib/demo/constants.ts")
const operario = read("lib/demo/ensure-demo-operario-account.ts")
const apkLib = read("lib/demo/mobile-apk.ts")

function assertTenantScopedWrite(source, tableHint) {
  assert.match(source, new RegExp(tableHint))
  assert.match(source, /company_id/)
  assert.match(source, /BESPOKE_DEMO_COMPANY_ID/)
  assert.match(source, /\.eq\("id", BESPOKE_DEMO_COMPANY_ID\)/)
}

test("1. Demo company isolation — canonical id, never the nil UUID", () => {
  assert.equal(DEMO, "00000000-0000-4000-8000-000000000001")
  assert.notEqual(DEMO, "00000000-0000-0000-0000-000000000001")
  assert.notEqual(DEMO, ABNET)
  assert.equal(isDemoCompanyId(DEMO), true)
  assert.equal(isDemoCompanyId(ABNET), false)
  assert.doesNotMatch(constants, /00000000-0000-0000-0000-000000000001/)
  assert.match(prepare, /Refusing to mutate the production tenant/)
  assert.match(prepare, /\.eq\("id", BESPOKE_DEMO_COMPANY_ID\)/)
})

test("2. Demo Mobile user is operario, not DEMO-ADMIN", () => {
  assert.equal(DEMO_OPERARIO_EMAIL, "demo.operario@bespoke-app.com.ar")
  assert.equal(DEMO_OPERARIO_EMPLOYEE_CODE, "DEMO-OPERARIO")
  assert.notEqual(DEMO_OPERARIO_EMAIL, DEMO_ADMIN_EMAIL)
  assert.match(operario, /system_role: "operario"/)
  assert.match(operario, /system_access: true/)
  assert.doesNotMatch(operario, /system_role: "demo"/)
  assert.doesNotMatch(operario, /DEMO-ADMIN/)
  assert.equal(
    isDemoPlatformReadOnlyUser({ systemRole: "operario", companyId: DEMO }),
    true
  )
  assert.equal(
    isDemoPlatformReadOnlyUser({
      systemRole: "operario",
      companyId: ABNET,
    }),
    false
  )
})

test("3. Demo mobile_code is unique and distinct from ABNet", () => {
  assert.equal(DEMO_MOBILE_COMPANY_CODE, "demo-8f4k")
  assert.equal(DEMO_MOBILE_COMPANY_CODE_DISPLAY, "DEMO-8F4K")
  assert.notEqual(DEMO_MOBILE_COMPANY_CODE, "abnet-7k5g")
  assert.match(prepare, /assignUniqueDemoMobileCode/)
  assert.match(prepare, /already belongs to/)
  assert.match(seedMobile, /ABNet mobile_code changed/)
  assert.doesNotMatch(prepare, /abnet-7k5g/)
  assert.doesNotMatch(constants, /abnet-7k5g/)
})

test("4. Demo device → employee → crew binding stays in Demo", () => {
  assert.equal(DEMO_MOBILE_CREW_NAME, "Cuadrilla Demo 1")
  assert.equal(DEMO_MOBILE_DEVICE_ID, "bespoke-demo-mobile-001")

  const bind = decideDemoMobileDeviceCrewBinding({
    authCompanyId: DEMO,
    deviceWorkTeamId: null,
    employeeCrews: [
      { id: DEMO_CREW, companyId: DEMO, name: DEMO_MOBILE_CREW_NAME },
    ],
  })
  assert.equal(bind.action, "bind")
  if (bind.action === "bind") {
    assert.equal(bind.workTeamId, DEMO_CREW)
  }

  const abnet = decideDemoMobileDeviceCrewBinding({
    authCompanyId: ABNET,
    deviceWorkTeamId: null,
    employeeCrews: [
      { id: ABNET_CREW, companyId: ABNET, name: "GUSTAVO AVILA" },
    ],
  })
  assert.equal(abnet.action, "skip")
  if (abnet.action === "skip") {
    assert.equal(abnet.reason, "foreign_tenant")
  }

  const cross = decideDemoMobileDeviceCrewBinding({
    authCompanyId: DEMO,
    deviceWorkTeamId: null,
    employeeCrews: [
      { id: ABNET_CREW, companyId: ABNET, name: DEMO_MOBILE_CREW_NAME },
    ],
  })
  assert.equal(cross.action, "skip")

  assert.match(provision, /maybeBindDemoDeviceToCrew/)
  assert.match(provision, /auth\.companyId !== BESPOKE_DEMO_COMPANY_ID/)
})

test("5. Demo task access is company-scoped", () => {
  assert.match(executionAccess, /\.eq\("company_id", companyId\)/)
  assert.match(executionAccess, /TASK_NOT_FOUND/)
  assert.match(executionAccess, /taskMatchesCrewId/)
  assert.equal(DEMO_MOBILE_TASK_CODES.length, 3)
  assert.deepEqual([...DEMO_MOBILE_TASK_CODES], [
    "DEMO-MOBILE-001",
    "DEMO-MOBILE-002",
    "DEMO-MOBILE-003",
  ])
})

test("6. Demo task mutation uses existing Mobile API, not a Demo bypass", () => {
  for (const source of [taskStart, taskSubmit, checklist]) {
    assert.match(source, /assertMobileTaskExecutionAccess|createAdminClient/)
    assert.doesNotMatch(source, /isDemoPlatformReadOnlyUser/)
    assert.doesNotMatch(source, /auth_is_demo_platform_read_only/)
    assert.doesNotMatch(source, /if \(.*DEMO.*\) \{[\s\S]*allow/)
  }
  assert.match(taskStart, /startMobileTask/)
  assert.match(taskSubmit, /submit-for-approval|getTransitionForAction/)
})

test("7. Demo evidence upload stays on the authenticated task company", () => {
  assert.match(checklistPhoto, /uploadTaskEvidencePhoto/)
  assert.match(checklistPhoto, /assertMobileTaskExecutionAccess/)
  assert.match(checklistPhoto, /createdBy: context\.auth\.authUserId/)
  assert.doesNotMatch(checklistPhoto, /BESPOKE_PRODUCTION_COMPANY_ID/)
  assert.doesNotMatch(checklistPhoto, /abnet-7k5g/)
})

test("8. Demo cannot access ABNet via bind / credentials / seed writes", () => {
  assert.doesNotMatch(landing, /ABNet|abnet-7k5g|app-abnet/)
  assert.doesNotMatch(page, /ABNet|abnet-7k5g|app-abnet/)
  assert.doesNotMatch(operario, /BESPOKE_PRODUCTION_COMPANY_ID/)
  assert.match(prepare, /BESPOKE_PRODUCTION_COMPANY_ID/)
  assert.match(prepare, /Refusing to mutate the production tenant/)
  assert.match(prepare, /ABNet mobile_code/)
  assert.doesNotMatch(
    prepare,
    /\.update\(\{[\s\S]{0,200}mobile_code:[\s\S]{0,80}BESPOKE_PRODUCTION_COMPANY_ID/
  )
  assert.doesNotMatch(seedMobile, /abnet-7k5g/)
})

test("9. Demo GPS heartbeat requires Demo device crew + active shift", () => {
  const rejected = evaluateGpsLiveHeartbeatGate({
    authCompanyId: DEMO,
    device: {
      companyId: ABNET,
      status: "ACTIVE",
      workTeamId: ABNET_CREW,
    },
    shiftActive: true,
    heartbeatEnabled: true,
    lastReceivedAt: null,
    nowMs: Date.now(),
  })
  assert.equal(rejected.accept, false)
  if (!rejected.accept) {
    assert.equal(rejected.reason, "device_not_found")
  }

  const noShift = evaluateGpsLiveHeartbeatGate({
    authCompanyId: DEMO,
    device: {
      companyId: DEMO,
      status: "ACTIVE",
      workTeamId: DEMO_CREW,
    },
    shiftActive: false,
    heartbeatEnabled: true,
    lastReceivedAt: null,
    nowMs: Date.now(),
  })
  assert.equal(noShift.accept, false)
  if (!noShift.accept) {
    assert.equal(noShift.reason, "shift_inactive")
  }

  const accepted = evaluateGpsLiveHeartbeatGate({
    authCompanyId: DEMO,
    device: {
      companyId: DEMO,
      status: "ACTIVE",
      workTeamId: DEMO_CREW,
    },
    shiftActive: true,
    heartbeatEnabled: true,
    lastReceivedAt: null,
    nowMs: Date.now(),
  })
  assert.equal(accepted.accept, true)

  assert.match(heartbeat, /SHIFT_NOT_ACTIVE/)
  assert.match(heartbeat, /auth\.companyId/)
})

test("10. Demo agenda shows assigned OT for today", () => {
  const today = "2026-09-24"
  const visible = isFieldAgentAgendaTaskVisible(
    {
      status: "asignada",
      startDate: today,
      dueDate: today,
      crewId: DEMO_CREW,
    },
    today
  )
  assert.equal(visible, true)

  const otherDay = isFieldAgentAgendaTaskVisible(
    {
      status: "asignada",
      startDate: "2026-01-01",
      dueDate: "2026-01-01",
      crewId: DEMO_CREW,
    },
    today
  )
  assert.equal(otherDay, false)

  assert.match(agenda, /resolveMobileWorkTeam/)
  assert.match(prepare, /status: "asignada"/)
  assert.match(prepare, /start_date: today/)
})

test("11. Demo task start uses existing startMobileTask + company filter", () => {
  assert.match(taskStart, /export async function startMobileTask/)
  assert.match(taskStart, /createAdminClient/)
  assert.match(taskStart, /SHIFT_NOT_ACTIVE|fetchActiveWorkTeamShift/)
  assert.doesNotMatch(taskStart, /isDemoPlatformReadOnlyUser/)
})

test("12. Demo task completion uses existing submit service", () => {
  assert.match(taskSubmit, /assertMobileTaskExecutionAccess/)
  assert.match(taskSubmit, /validateOperationalChecklistComplete|submit-for-approval/)
  assert.doesNotMatch(taskSubmit, /isDemoPlatformReadOnlyUser/)
  for (const definition of DEMO_MOBILE_TASK_DEFINITIONS) {
    assert.ok(definition.checklist.some((item) => item.fieldType === "fotografia"))
    assert.ok(definition.checklist.every((item) => item.required))
  }
})

test("13. /demo is a public landing page", () => {
  assert.equal(DEMO_LANDING_PATH, "/demo")
  assert.equal(isAuthPublicPath("/demo"), true)
  assert.equal(isAuthPublicPath("/api/demo/apk"), true)
  assert.equal(isAuthPublicPath("/"), false)
  assert.match(routes, /pathname === "\/demo"/)
  assert.match(page, /DemoLandingPage/)
  assert.match(landing, /BESPOKE DEMO/)
  assert.match(landing, /Probar Bespoke Operations/)
  assert.match(landing, /PROBAR OPERATIONS/)
  assert.match(landing, /Probar Bespoke Mobile/)
  assert.match(landing, /DESCARGAR BESPOKE MOBILE/)
  assert.match(landing, /Android/)
  assert.match(landing, /Versión/)
  assert.match(landing, /Tamaño aproximado/)
  assert.match(landing, /entorno completamente ficticio/)
  assert.match(landing, /href=\{LOGIN_PATH\}/)
  assert.match(layout, /BESPOKE DEMO/)
})

test("14. APK download URL stays on Bespoke", () => {
  assert.equal(DEMO_MOBILE_APK_DOWNLOAD_PATH, "/api/demo/apk")
  assert.match(landing, /DEMO_MOBILE_APK_DOWNLOAD_PATH/)
  assert.match(apkRoute, /BESPOKE_MOBILE_APK_URL/)
  assert.match(apkRoute, /resolveDemoMobileApkDownloadUrl/)
  assert.doesNotMatch(apkRoute, /join\(process\.cwd\(\), "public"/)
  assert.match(apkLib, /bespoke-app\.online/)
  assert.match(apkLib, /demo-downloads/)
  assert.match(apkLib, /bespoke-mobile\.apk/)
  assert.equal(
    isAllowedDemoApkRedirectUrl("https://bespoke-app.online/downloads/app.apk"),
    true
  )
  assert.equal(
    isAllowedDemoApkRedirectUrl("https://app-abnet.com.ar/app.apk"),
    false
  )
  assert.equal(
    isAllowedDemoApkRedirectUrl("https://drive.google.com/file/d/x"),
    false
  )
  assert.doesNotMatch(landing, /drive\.google/)
  assert.doesNotMatch(apkRoute, /app-abnet/)
})

test("15. No ABNet hardcode in demo page", () => {
  assert.doesNotMatch(page, /ABNet|abnet-7k5g|app-abnet|Demo2026!/)
  assert.doesNotMatch(landing, /ABNet|abnet-7k5g|app-abnet|Demo2026!/)
  assert.doesNotMatch(credentials, /Demo2026!/)
  assert.match(credentials, /DEMO_WEB_PASSWORD/)
  assert.match(credentials, /DEMO_MOBILE_PASSWORD/)
  assert.match(landing, /credentials\.companyName/)
  assert.match(landing, /credentials\.companyCode/)
  assert.match(landing, /credentials\.webUsername/)
  assert.match(landing, /credentials\.mobileUsername/)
  assert.match(constants, /bes-demo/)
  assert.doesNotMatch(landing, /demo\.operario@bespoke-app\.com\.ar/)
})

test("16. No ABNet hardcode in Mobile demo configuration", () => {
  assert.doesNotMatch(constants, /abnet-7k5g|app-abnet/)
  assert.doesNotMatch(provision, /abnet-7k5g|app-abnet/)
  assert.doesNotMatch(bootstrap, /abnet-7k5g/)
  assert.match(bootstrap, /mobile_code/)
  assert.match(bootstrap, /company_mobile_settings/)
  assertTenantScopedWrite(prepare, "company_mobile_settings")
  assert.match(seedCompany, /DEMO-OT-%/)
  assert.doesNotMatch(
    seedCompany.split("resetDemoDataDirect")[1]?.slice(0, 800) ?? "",
    /like\("code", "DEMO-%"\)/
  )
})

test("17. Commercial username bes-demo aliases distinct Auth emails", () => {
  assert.equal(DEMO_COMMERCIAL_USERNAME, "bes-demo")
  assert.equal(
    resolveDemoCommercialAuthEmail("bes-demo", "web"),
    DEMO_ADMIN_EMAIL
  )
  assert.equal(
    resolveDemoCommercialAuthEmail("BES-DEMO", "mobile"),
    DEMO_OPERARIO_EMAIL
  )
  assert.notEqual(DEMO_ADMIN_EMAIL, DEMO_OPERARIO_EMAIL)
  assert.equal(resolveDemoCommercialAuthEmail("demo@bespoke-app.com.ar", "web"), null)
  const authProvider = read("components/auth/auth-provider.tsx")
  const mobileLogin = read("lib/mobile/v1/auth/login-service.ts")
  assert.match(authProvider, /resolveDemoCommercialAuthEmail\(identifier, "web"\)/)
  assert.match(mobileLogin, /resolveDemoCommercialAuthEmail\(request\.email, "mobile"\)/)
  assert.doesNotMatch(constants, /demo123/)
  assert.doesNotMatch(landing, /demo123/)
  assert.doesNotMatch(credentials, /demo123/)
  assert.match(apkLib, /e1ef1deafcd47600988ce379fafbbff5461efb1cf056834bdcfbf72463241c37/)
})
