import assert from "node:assert/strict"
import test from "node:test"

import {
  formatActivityActionLabel,
  formatActivityModuleLabel,
  formatActivityOriginLabel,
  listActivityViewerAreas,
  listActivityViewerModules,
} from "../lib/activity/activity-viewer-labels.ts"
import {
  buildActivityViewerSearchParams,
  parseActivityViewerSearchParams,
  toActivityViewerServerQuery,
} from "../lib/activity/activity-viewer-query.ts"
import { ACTIVITY_VIEWER_PAGE_SIZE } from "../lib/activity/activity-viewer-types.ts"
import { ACTIVITY_ACTIONS, ACTIVITY_MODULES, ACTIVITY_ORIGINS } from "../lib/activity/types.ts"
import { resolveModuleKeyFromPathname } from "../lib/roles/app-modules.ts"
import { buildNavGroupsFromModuleVisibility } from "../lib/navigation/build-nav-from-modules.ts"
import { createFullModuleVisibility } from "../lib/roles/app-modules.ts"

test("parse/build Activity Viewer URL state round-trip", () => {
  const state = {
    from: "2026-07-21T03:00:00.000Z",
    to: "2026-07-22T02:59:59.000Z",
    userSearch: "Alfredo",
    area: "tecnica",
    module: ACTIVITY_MODULES.TASKS,
    action: ACTIVITY_ACTIONS.TASK_CREATE,
    origin: ACTIVITY_ORIGINS.WEB,
    offset: 50,
    limit: 50,
  }

  const params = buildActivityViewerSearchParams(state)
  const parsed = parseActivityViewerSearchParams(params)

  assert.equal(parsed.from, state.from)
  assert.equal(parsed.to, state.to)
  assert.equal(parsed.userSearch, state.userSearch)
  assert.equal(parsed.area, state.area)
  assert.equal(parsed.module, state.module)
  assert.equal(parsed.action, state.action)
  assert.equal(parsed.origin, state.origin)
  assert.equal(parsed.offset, 50)
  assert.equal(parsed.limit, ACTIVITY_VIEWER_PAGE_SIZE)
})

test("toActivityViewerServerQuery maps company + filters", () => {
  const query = toActivityViewerServerQuery("company-1", {
    module: ACTIVITY_MODULES.PLANNING,
    origin: ACTIVITY_ORIGINS.API,
    area: "rrhh",
  })

  assert.equal(query.companyId, "company-1")
  assert.equal(query.module, ACTIVITY_MODULES.PLANNING)
  assert.equal(query.origin, ACTIVITY_ORIGINS.API)
  assert.equal(query.area, "rrhh")
  assert.equal(query.offset, 0)
  assert.equal(query.limit, ACTIVITY_VIEWER_PAGE_SIZE)
})

test("labels: módulos, orígenes y acciones conocidas", () => {
  assert.equal(formatActivityModuleLabel(ACTIVITY_MODULES.TASKS), "Órdenes de Trabajo")
  assert.equal(formatActivityOriginLabel(ACTIVITY_ORIGINS.MOBILE), "Mobile")
  assert.equal(formatActivityActionLabel(ACTIVITY_ACTIONS.TASK_CREATE), "Crear OT")
  assert.ok(listActivityViewerModules().length >= 10)
  assert.ok(listActivityViewerAreas().some((area) => area.value === "administrador"))
})

test("ruta /activity resuelve al módulo history (acceso admin vía visibility)", () => {
  assert.equal(resolveModuleKeyFromPathname("/activity"), "history")
  assert.equal(resolveModuleKeyFromPathname("/activity?x=1".split("?")[0]), "history")
})

test("nav incluye Activity Engine cuando history está visible", () => {
  const groups = buildNavGroupsFromModuleVisibility(createFullModuleVisibility())
  const system = groups.find((group) => group.id === "system")
  assert.ok(system)
  const hrefs = system.items.map((item) => item.href)
  assert.ok(hrefs.includes("/historial"))
  assert.ok(hrefs.includes("/activity"))
})
