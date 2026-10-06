/**
 * Topology curated forest: filter visible tree by the existing Core selector.
 * Does not rebuild hierarchy from Discovery or network_links.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  collectCuratedDeviceIds,
  findCuratedNodeByDeviceId,
  selectCuratedForestForCore,
} from "../lib/network/topology/curated-select.ts"

const ROOT = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

function node(deviceId, label, children = []) {
  return {
    deviceId,
    label,
    hostname: label,
    ipAddress: null,
    status: null,
    children,
  }
}

const MALAGUENO = "core-malagueno"
const RIO_SEGUNDO = "core-rio-segundo"
const CORDOBA = "core-cordoba"
const POWERBOX = "powerbox-malagueno"
const AS5 = "as5"
const AS6 = "as6"
const AS7 = "as7"
const PB_RIO = "powerbox-rio"

function companyForest() {
  return {
    roots: [
      node(MALAGUENO, "RB3011 - Core Malagueño", [
        node(POWERBOX, "PowerBox Malagueño", [
          node(AS5, "AS5"),
          node(AS6, "AS6"),
          node(AS7, "AS7"),
        ]),
      ]),
      node(RIO_SEGUNDO, "RB3011 - Core Río Segundo", [
        node(PB_RIO, "PowerBox Río Segundo"),
      ]),
      node(CORDOBA, "Core Córdoba"),
    ],
  }
}

test("1: Core Malagueño seleccionado → solo ese root", () => {
  const visible = selectCuratedForestForCore(companyForest(), MALAGUENO)
  assert.equal(visible.roots.length, 1)
  assert.equal(visible.roots[0].deviceId, MALAGUENO)
  assert.equal(visible.roots[0].label, "RB3011 - Core Malagueño")
})

test("2: los descendientes de Malagueño permanecen completos", () => {
  const forest = companyForest()
  const original = forest.roots[0]
  const visible = selectCuratedForestForCore(forest, MALAGUENO)
  const root = visible.roots[0]
  assert.equal(root.children.length, 1)
  assert.equal(root.children[0].deviceId, POWERBOX)
  const asIds = root.children[0].children.map((child) => child.deviceId)
  assert.deepEqual(asIds, [AS5, AS6, AS7])
  assert.equal(root, original)
  assert.equal(root.children[0], original.children[0])
})

test("3: Core Río Segundo seleccionado → no aparece Malagueño", () => {
  const visible = selectCuratedForestForCore(companyForest(), RIO_SEGUNDO)
  const ids = [...collectCuratedDeviceIds(visible)]
  assert.equal(visible.roots[0].deviceId, RIO_SEGUNDO)
  assert.equal(ids.includes(MALAGUENO), false)
  assert.equal(ids.includes(POWERBOX), false)
  assert.equal(ids.includes(AS5), false)
  assert.equal(ids.includes(PB_RIO), true)
})

test("4: cambiar de Core cambia el árbol visible", () => {
  const forest = companyForest()
  const malagueno = selectCuratedForestForCore(forest, MALAGUENO)
  const rio = selectCuratedForestForCore(forest, RIO_SEGUNDO)
  assert.equal(malagueno.roots[0].deviceId, MALAGUENO)
  assert.equal(rio.roots[0].deviceId, RIO_SEGUNDO)
  assert.notEqual(malagueno.roots[0].deviceId, rio.roots[0].deviceId)
})

test("5: Core sin placement curado → forest vacío, sin inventar árbol", () => {
  const visible = selectCuratedForestForCore(
    companyForest(),
    "core-sin-placement"
  )
  assert.deepEqual(visible.roots, [])
  assert.equal(findCuratedNodeByDeviceId(visible, MALAGUENO), null)
})

test("6: no se usa network_links para construir el árbol filtrado", () => {
  const selectSrc = read("lib/network/topology/curated-select.ts")
  const viewSrc = read("lib/network/topology/curated-view.ts")
  assert.doesNotMatch(selectSrc, /network_links/)
  assert.doesNotMatch(selectSrc, /selectTopologyRootIds/)
  assert.doesNotMatch(selectSrc, /buildLocalCoreTopologyView/)
  assert.doesNotMatch(viewSrc, /network_links/)
  assert.match(viewSrc, /loadActiveTopologyPlacements/)
  assert.match(viewSrc, /listRootTopologyPlacements/)
})

test("7: NOC no filtra por el selector de Topología", () => {
  const nocScreen = read("components/network/noc-monitor-screen.tsx")
  const nocTree = read("components/network/noc-topology-tree.tsx")
  const nocView = read("lib/network/noc/view.ts")
  const nocPage = read("app/(dashboard)/network/noc/page.tsx")
  assert.doesNotMatch(nocScreen, /selectCuratedForestForCore/)
  assert.doesNotMatch(nocScreen, /visibleCurated/)
  assert.doesNotMatch(nocTree, /selectCuratedForestForCore/)
  assert.doesNotMatch(nocView, /selectCuratedForestForCore/)
  assert.doesNotMatch(nocPage, /selectCuratedForestForCore/)
  assert.match(nocTree, /RED \/ EMPRESA/)
  assert.match(nocScreen, /data\?\.topology/)
})

test("8: el detalle solo resuelve nodos del árbol filtrado", () => {
  const visible = selectCuratedForestForCore(companyForest(), MALAGUENO)
  assert.equal(findCuratedNodeByDeviceId(visible, AS5)?.label, "AS5")
  assert.equal(findCuratedNodeByDeviceId(visible, POWERBOX)?.label, "PowerBox Malagueño")
  assert.equal(findCuratedNodeByDeviceId(visible, RIO_SEGUNDO), null)
  assert.equal(findCuratedNodeByDeviceId(visible, PB_RIO), null)
  const screen = read("components/network/network-topology-screen.tsx")
  assert.match(screen, /findCuratedNodeByDeviceId\(/)
  assert.match(screen, /visibleCurated/)
  assert.match(screen, /if \(!curatedNode\) return null/)
})

test("9: cambiar de Core no llama a placements", () => {
  const screen = read("components/network/network-topology-screen.tsx")
  const onChange = screen.slice(
    screen.indexOf("onChange={(event) => {"),
    screen.indexOf("</select>")
  )
  assert.match(onChange, /setSelectedCoreId/)
  assert.match(onChange, /selectCoreNode/)
  assert.doesNotMatch(onChange, /\/api\/network\/topology\/placements/)
  assert.doesNotMatch(onChange, /postPlacement|patchPlacement|deletePlacement/)
  assert.match(screen, /selectCuratedForestForCore\(curated, activeCoreId\)/)
  assert.doesNotMatch(screen, /Todos los Cores/)
})

test("la pantalla conecta el selector existente con curated.roots", () => {
  const screen = read("components/network/network-topology-screen.tsx")
  const editor = read("components/network/curated-topology-editor.tsx")
  assert.match(screen, /value=\{activeCoreId/)
  assert.match(screen, /forest=\{visibleCurated\}/)
  assert.match(
    screen,
    /Todavía no hay una topología curada para este Core\./
  )
  assert.match(editor, /emptyMessage/)
  assert.match(editor, /placedDeviceIds/)
})

test("sin Core seleccionado se conservan todos los roots", () => {
  const forest = companyForest()
  const visible = selectCuratedForestForCore(forest, null)
  assert.equal(visible.roots.length, 3)
  assert.deepEqual(
    visible.roots.map((root) => root.deviceId),
    [MALAGUENO, RIO_SEGUNDO, CORDOBA]
  )
})
