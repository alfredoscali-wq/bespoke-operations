import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  buildExecutionOrderPersistPlan,
  buildExecutionOrderPositionUpdates,
  countOperationalOrderReorderablesForTask,
  parseOperationalOrderInput,
} from "../lib/planificacion/planning-execution-order.ts"
import {
  PLANNING_MAP_DEFAULT_BASE_LAYER,
  resolvePlanningMapBaseLayerConfig,
} from "../lib/planificacion/planning-map-tiles.ts"
import { resolveTaskRouteOrder } from "../lib/tasks/dispatch-order.ts"
import { buildPlanningMarkersViewKey } from "../lib/planificacion/planning-map-markers.ts"

const CREWS = [
  { id: "crew-a", name: "Cuadrilla A" },
  { id: "crew-b", name: "Cuadrilla B" },
]

function makeProgramadaTask(input) {
  const { overrides, ...rest } = input
  return {
    id: rest.id,
    code: rest.code ?? `OT-${rest.id}`,
    title: rest.title ?? "Cliente",
    description: "",
    projectCode: "PRJ",
    projectName: "Proyecto",
    type: "maintenance",
    status: "programada",
    priority: "media",
    supervisor: "Supervisor",
    crewId: rest.crewId ?? "crew-a",
    crew: rest.crew ?? "Cuadrilla A",
    startDate: "2026-07-10",
    dueDate: "2026-07-10",
    estimatedDuration: "45 min",
    checklist: [],
    progress: 0,
    executionOrder: rest.executionOrder ?? null,
    dispatchOrder: null,
    latitude: rest.latitude ?? -34.6,
    longitude: rest.longitude ?? -58.4,
    createdAt:
      rest.createdAt ??
      `2026-07-10T0${rest.executionOrder ?? 1}:00:00.000Z`,
    ...overrides,
  }
}

function buildSequenceTasks() {
  return [
    makeProgramadaTask({ id: "a", executionOrder: 1 }),
    makeProgramadaTask({ id: "b", executionOrder: 2 }),
    makeProgramadaTask({ id: "c", executionOrder: 3 }),
    makeProgramadaTask({ id: "d", executionOrder: 4 }),
    makeProgramadaTask({ id: "e", executionOrder: 5 }),
  ]
}

function resolveSequenceOrder(updates, tasks) {
  const nextById = new Map(tasks.map((task) => [task.id, task.executionOrder]))
  for (const update of updates) {
    nextById.set(update.taskId, update.executionOrder)
  }

  return [...tasks]
    .sort((left, right) => {
      const leftOrder = nextById.get(left.id) ?? 0
      const rightOrder = nextById.get(right.id) ?? 0
      return leftOrder - rightOrder
    })
    .map((task) => task.id)
}

test("summary compacto conserva información funcional", async () => {
  const file = await readFile(
    "components/planificacion/planning-operational-summary.tsx",
    "utf8"
  )

  // OPS 2.4 — denser KPI cards with occupancy second line
  assert.match(file, /min-h-\[3rem\]/)
  assert.match(file, /text-lg/)
  assert.match(file, /ocupación/)
  assert.match(file, /Planificar/)
  assert.match(file, /Replanificar/)
  assert.match(file, /onSelectCrew/)
  assert.doesNotMatch(file, /min-h-\[8\.5rem\]/)
})

test("mapa densificado cede espacio a la lista de OT", async () => {
  const file = await readFile("components/planificacion/planning-module.tsx", "utf8")

  // OPS 2.4 — map ~30% shorter so more OT rows stay on screen
  assert.match(file, /min-h-\[12rem\]/)
  assert.match(file, /minmax\(12rem,0\.85fr\)/)
  assert.match(file, /minmax\(16rem,1\.15fr\)/)
  assert.doesNotMatch(file, /max-h-\[42vh\]/)
  assert.doesNotMatch(file, /min-h-\[18rem\]/)
})

test("lista utiliza scroll independiente", async () => {
  const moduleFile = await readFile(
    "components/planificacion/planning-module.tsx",
    "utf8"
  )
  const listFile = await readFile(
    "components/planificacion/planning-task-list.tsx",
    "utf8"
  )

  assert.match(moduleFile, /min-h-0 flex-1/)
  assert.match(listFile, /ScrollArea/)
  assert.match(listFile, /min-h-0 min-w-0 flex-1/)
  // OPS 2.4.2 — no fixed min-width forcing horizontal scroll
  assert.doesNotMatch(listFile, /min-w-\[960px\]/)
  assert.match(listFile, /table-fixed/)
})

test("buildExecutionOrderPositionUpdates mueve 5 → 2", () => {
  const tasks = buildSequenceTasks()
  const updates = buildExecutionOrderPositionUpdates(tasks, "e", 2, CREWS)

  assert.ok(updates.length > 0)
  assert.deepEqual(resolveSequenceOrder(updates, tasks), ["a", "e", "b", "c", "d"])
})

test("posición ocupada desplaza OT intermedias", () => {
  const tasks = buildSequenceTasks()
  const updates = buildExecutionOrderPositionUpdates(tasks, "e", 2, CREWS)
  const moved = updates.find((update) => update.taskId === "b")

  assert.ok(moved)
  assert.equal(moved.executionOrder, 3)
})

test("input mayor que N clampea a N", () => {
  const tasks = buildSequenceTasks()
  const updates = buildExecutionOrderPositionUpdates(tasks, "e", 99, CREWS)

  assert.deepEqual(resolveSequenceOrder(updates, tasks), ["a", "b", "c", "d", "e"])
})

test("input vacío es inválido", () => {
  const parsed = parseOperationalOrderInput("   ")
  assert.equal(parsed.valid, false)
})

test("input 0 es inválido", () => {
  const parsed = parseOperationalOrderInput("0")
  assert.equal(parsed.valid, false)
})

test("input negativo es inválido", () => {
  const parsed = parseOperationalOrderInput("-3")
  assert.equal(parsed.valid, false)
})

test("input no numérico es inválido", () => {
  const parsed = parseOperationalOrderInput("abc")
  assert.equal(parsed.valid, false)
})

test("mismo orden produce no-op a nivel de handler", async () => {
  const moduleFile = await readFile(
    "components/planificacion/planning-module.tsx",
    "utf8"
  )

  assert.match(moduleFile, /currentOrder === targetPosition/)
  assert.match(moduleFile, /handleMoveTaskToPosition/)
})

test("fila y mapa usan el mismo handler", async () => {
  const moduleFile = await readFile(
    "components/planificacion/planning-module.tsx",
    "utf8"
  )

  assert.match(moduleFile, /onMoveTaskToPosition=\{\s*isEditingMode \? handleMoveTaskToPosition/)
  assert.match(moduleFile, /onMoveTaskToPosition: isEditingMode \? handleMoveTaskToPosition/)
})

test("input de fila usa stopPropagation", async () => {
  const rowFile = await readFile(
    "components/planificacion/planning-task-table-row.tsx",
    "utf8"
  )
  const inputFile = await readFile(
    "components/planificacion/planning-task-order-input.tsx",
    "utf8"
  )

  assert.match(rowFile, /PlanningTaskOrderInput/)
  assert.match(inputFile, /stopPropagation/)
})

test("OT no reorderable no permite edición", async () => {
  const rowFile = await readFile(
    "components/planificacion/planning-task-table-row.tsx",
    "utf8"
  )

  assert.match(rowFile, /isOperationalOrderReorderable/)
  assert.match(rowFile, /canEditOrder/)
})

test("scope de orden es cuadrilla + fecha", () => {
  const tasks = [
    ...buildSequenceTasks(),
    makeProgramadaTask({
      id: "other-crew",
      crewId: "crew-b",
      crew: "Cuadrilla B",
      executionOrder: 1,
    }),
  ]

  assert.equal(countOperationalOrderReorderablesForTask(tasks, "e", CREWS), 5)
  assert.equal(countOperationalOrderReorderablesForTask(tasks, "other-crew", CREWS), 1)
})

test("persistencia usa applyExecutionOrderUpdates", async () => {
  const moduleFile = await readFile(
    "components/planificacion/planning-module.tsx",
    "utf8"
  )

  assert.match(moduleFile, /applyExecutionOrderUpdates\(updates, crews\)/)
})

test("persistencia conserva plan de dos fases", () => {
  const tasks = buildSequenceTasks()
  const updates = buildExecutionOrderPositionUpdates(tasks, "e", 2, CREWS)
  const plan = buildExecutionOrderPersistPlan(updates, tasks, CREWS)

  assert.equal(plan.phases.length, 2)
  assert.ok(plan.phases[0]?.length > 0)
  assert.ok(plan.phases[1]?.length > 0)
  assert.ok(plan.phases[0]?.every((update) => update.executionOrder === null))
})

test("marker actualiza número desde executionOrder", () => {
  const task = makeProgramadaTask({ id: "a", executionOrder: 1 })
  const keyBefore = buildPlanningMarkersViewKey([
    {
      task,
      coordinates: { latitude: -34.6, longitude: -58.4 },
    },
  ])

  const keyAfter = buildPlanningMarkersViewKey([
    {
      task: { ...task, executionOrder: 4 },
      coordinates: { latitude: -34.6, longitude: -58.4 },
    },
  ])

  assert.notEqual(keyBefore, keyAfter)
  assert.equal(resolveTaskRouteOrder({ ...task, executionOrder: 4 }), 4)
})

test("tabla actualiza posición vía sortTasksByDispatchRoute", async () => {
  const listFile = await readFile(
    "components/planificacion/planning-task-list.tsx",
    "utf8"
  )

  assert.match(listFile, /sortTasksByDispatchRoute/)
})

test("selectedTaskId se conserva tras reorder", async () => {
  const moduleFile = await readFile(
    "components/planificacion/planning-module.tsx",
    "utf8"
  )

  const handlerMatch = moduleFile.match(
    /const handleMoveTaskToPosition = useCallback\([\s\S]*?\n  \)/
  )

  assert.ok(handlerMatch)
  assert.doesNotMatch(handlerMatch[0], /setSelectedTaskId/)
})

test("overlay de orden aparece en edit mode", async () => {
  const mapFile = await readFile("components/planificacion/planning-map.tsx", "utf8")

  assert.match(mapFile, /PlanningMapSelectedTaskOverlay/)
  assert.match(mapFile, /canEditOrder/)
  assert.match(mapFile, /isEditMode/)
  assert.match(mapFile, /PlanningTaskOrderInput/)
})

test("no se usa UPDATE directo de executionOrder", async () => {
  const moduleFile = await readFile(
    "components/planificacion/planning-module.tsx",
    "utf8"
  )

  assert.doesNotMatch(moduleFile, /editTask\([\s\S]*executionOrder/)
  assert.match(moduleFile, /buildExecutionOrderPositionUpdates/)
})

test("Planificación no usa fetchNextExecutionOrderForCrewDate", async () => {
  const moduleFile = await readFile(
    "components/planificacion/planning-module.tsx",
    "utf8"
  )

  assert.doesNotMatch(moduleFile, /fetchNextExecutionOrderForCrewDate/)
})

test("OPS 2.4.7 — sin flechas; orden por número; código OT corto", async () => {
  const rowFile = await readFile(
    "components/planificacion/planning-task-table-row.tsx",
    "utf8"
  )
  const listFile = await readFile(
    "components/planificacion/planning-task-list.tsx",
    "utf8"
  )
  const moduleFile = await readFile(
    "components/planificacion/planning-module.tsx",
    "utf8"
  )

  assert.doesNotMatch(rowFile, /▲/)
  assert.doesNotMatch(rowFile, /▼/)
  assert.doesNotMatch(listFile, /aria-label="Mover orden"/)
  assert.match(rowFile, /formatTaskAdminDisplayCode/)
  assert.match(rowFile, /PlanningTaskOrderInput/)
  assert.match(moduleFile, /handleMoveTaskToPosition/)
  assert.match(listFile, /PLANNING_TABLE_COLUMN_COUNT = 9/)
  assert.match(listFile, /w-\[4\.25rem\]/)
  assert.match(listFile, /w-\[26%\]/)
})

test("toolbar mantiene selector de fecha con espaciado reducido", async () => {
  const file = await readFile("components/planificacion/planning-toolbar.tsx", "utf8")

  assert.match(file, /type="date"/)
  assert.match(file, /Ir a Órdenes de Trabajo/)
  assert.match(file, /gap-2/)
})

test("resolvePlanningMapBaseLayerConfig expone OSM street por defecto sin API key", () => {
  assert.equal(PLANNING_MAP_DEFAULT_BASE_LAYER, "street")

  const config = resolvePlanningMapBaseLayerConfig()
  assert.equal(config.id, "street")
  assert.match(config.url, /^https:\/\/\{s\}\.tile\.openstreetmap\.org\//)
  assert.match(config.options.attribution ?? "", /OpenStreetMap/)
  assert.equal(config.options.maxZoom, 19)
  assert.equal(config.options.maxNativeZoom, 19)

  const satellite = resolvePlanningMapBaseLayerConfig("satellite")
  assert.equal(satellite.id, "satellite")
  assert.match(satellite.url, /World_Imagery/)
})

test("planning map usa capa OSM street centralizada, sin URL en el canvas", async () => {
  const tilesFile = await readFile(
    "lib/planificacion/planning-map-tiles.ts",
    "utf8"
  )
  const canvasFile = await readFile(
    "components/planificacion/planning-map-canvas.tsx",
    "utf8"
  )

  assert.match(tilesFile, /PLANNING_MAP_DEFAULT_BASE_LAYER[\s\S]*"street"/)
  assert.match(tilesFile, /https:\/\/\{s\}\.tile\.openstreetmap\.org/)
  assert.match(tilesFile, /OpenStreetMap/)
  assert.doesNotMatch(tilesFile, /prefetch|bulk download|preloadTiles/)
  assert.match(canvasFile, /resolvePlanningMapBaseLayerConfig\(baseLayerId\)/)
  assert.doesNotMatch(canvasFile, /tile\.openstreetmap\.org/)
  assert.doesNotMatch(canvasFile, /World_Imagery/)
})

test("OPS 2.4.6 — duración siempre en minutos; Turno sin truncate", async () => {
  const { formatPlanningDurationCompact } = await import(
    "../lib/planificacion/planning-ui-density.ts"
  )

  assert.equal(formatPlanningDurationCompact("25 min"), "25 min")
  assert.equal(formatPlanningDurationCompact("60 min"), "60 min")
  assert.equal(formatPlanningDurationCompact("90 min"), "90 min")
  assert.equal(formatPlanningDurationCompact("120 min"), "120 min")
  assert.equal(formatPlanningDurationCompact("1.5h"), "90 min")
  assert.doesNotMatch(formatPlanningDurationCompact("90 min"), /h/)

  const listFile = await readFile(
    "components/planificacion/planning-task-list.tsx",
    "utf8"
  )
  const rowFile = await readFile(
    "components/planificacion/planning-task-table-row.tsx",
    "utf8"
  )

  assert.match(listFile, /w-\[4\.5rem\]/)
  assert.match(listFile, /w-\[4rem\]/)
  assert.match(listFile, /w-\[6\.75rem\]/)
  assert.doesNotMatch(listFile, /min-w-\[960px\]/)
  assert.match(rowFile, /whitespace-nowrap[\s\S]*shiftLabel/)
  assert.doesNotMatch(
    rowFile,
    /shiftLabel[\s\S]{0,80}truncate/
  )
})
