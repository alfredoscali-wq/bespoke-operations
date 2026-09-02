import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  PLANNING_MAP_BASE_LAYER_OPTIONS,
  PLANNING_MAP_BASE_LAYER_SESSION_KEY,
  PLANNING_MAP_DEFAULT_BASE_LAYER,
  isPlanningMapSelectableBaseLayerId,
  readPlanningMapBaseLayerFromSession,
  resolvePlanningMapBaseLayerConfig,
  writePlanningMapBaseLayerToSession,
} from "../lib/planificacion/planning-map-tiles.ts"

function withSessionStorage(initial, run) {
  const store = { ...initial }
  globalThis.window = {
    sessionStorage: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(store, key)
          ? store[key]
          : null
      },
      setItem(key, value) {
        store[key] = String(value)
      },
    },
  }

  try {
    return run(store)
  } finally {
    delete globalThis.window
  }
}

test("default y capas seleccionables: Calles OSM y Satélite Esri", () => {
  assert.equal(PLANNING_MAP_DEFAULT_BASE_LAYER, "street")
  assert.deepEqual(
    PLANNING_MAP_BASE_LAYER_OPTIONS.map((option) => option.id),
    ["street", "satellite"]
  )
  assert.match(
    PLANNING_MAP_BASE_LAYER_OPTIONS[0]?.label ?? "",
    /Calles/
  )
  assert.match(
    PLANNING_MAP_BASE_LAYER_OPTIONS[1]?.label ?? "",
    /Satélite/
  )

  const streets = resolvePlanningMapBaseLayerConfig("street")
  assert.match(streets.url, /^https:\/\/\{s\}\.tile\.openstreetmap\.org\//)
  assert.match(streets.options.attribution ?? "", /OpenStreetMap/)

  const satellite = resolvePlanningMapBaseLayerConfig("satellite")
  assert.match(satellite.url, /World_Imagery/)
  assert.match(satellite.options.attribution ?? "", /Esri/)

  assert.equal(isPlanningMapSelectableBaseLayerId("hybrid"), false)
})

test("sessionStorage recuerda Calles/Satélite sin tocar datos operativos", () => {
  withSessionStorage({}, () => {
    assert.equal(
      readPlanningMapBaseLayerFromSession(),
      PLANNING_MAP_DEFAULT_BASE_LAYER
    )
    writePlanningMapBaseLayerToSession("satellite")
    assert.equal(readPlanningMapBaseLayerFromSession(), "satellite")
    writePlanningMapBaseLayerToSession("street")
    assert.equal(readPlanningMapBaseLayerFromSession(), "street")
  })

  withSessionStorage(
    { [PLANNING_MAP_BASE_LAYER_SESSION_KEY]: "hybrid" },
    () => {
      assert.equal(
        readPlanningMapBaseLayerFromSession(),
        PLANNING_MAP_DEFAULT_BASE_LAYER
      )
    }
  )
})

test("selector y canvas cambian la capa sin resetear vista ni URLs locales", async () => {
  const tilesFile = await readFile(
    "lib/planificacion/planning-map-tiles.ts",
    "utf8"
  )
  const control = await readFile(
    "components/planificacion/planning-map-base-layer-control.tsx",
    "utf8"
  )
  const mapFile = await readFile(
    "components/planificacion/planning-map.tsx",
    "utf8"
  )
  const canvas = await readFile(
    "components/planificacion/planning-map-canvas.tsx",
    "utf8"
  )

  assert.match(tilesFile, /Calles/)
  assert.match(tilesFile, /Satélite/)
  assert.match(control, /PLANNING_MAP_BASE_LAYER_OPTIONS/)
  assert.match(control, /top-2 right-2/)
  assert.match(mapFile, /PlanningMapBaseLayerControl/)
  assert.match(mapFile, /writePlanningMapBaseLayerToSession/)
  assert.match(canvas, /baseLayerId/)
  assert.match(canvas, /resolvePlanningMapBaseLayerConfig\(baseLayerId\)/)
  assert.match(canvas, /tileLayerRef/)
  assert.doesNotMatch(canvas, /tile\.openstreetmap\.org/)
  assert.doesNotMatch(canvas, /World_Imagery/)

  const swapEffect = canvas.match(
    /useEffect\(\(\) => \{\r?\n\s*const map = mapRef\.current[\s\S]*?resolvePlanningMapBaseLayerConfig\(baseLayerId\)[\s\S]*?\}, \[baseLayerId\]\)/
  )
  assert.ok(swapEffect)
  assert.doesNotMatch(swapEffect[0], /refreshPlanningMapView/)
  assert.doesNotMatch(swapEffect[0], /setView/)
  assert.doesNotMatch(swapEffect[0], /fitBounds/)
  assert.doesNotMatch(swapEffect[0], /flyTo/)
})
