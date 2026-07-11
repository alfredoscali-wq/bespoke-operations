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

  assert.match(file, /min-h-\[3\.5rem\]/)
  assert.match(file, /text-xl/)
  assert.match(file, /Planificar/)
  assert.match(file, /Replanificar/)
  assert.match(file, /onSelectCrew/)
  assert.doesNotMatch(file, /min-h-\[8\.5rem\]/)
})

test("mapa usa altura significativamente mayor en escritorio", async () => {
  const file = await readFile("components/planificacion/planning-module.tsx", "utf8")

  assert.match(file, /lg:max-h-\[60vh\]/)
  assert.match(file, /h-\[52vh\]/)
  assert.match(file, /minmax\(15rem,1fr\)/)
  assert.doesNotMatch(file, /max-h-\[42vh\]/)
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
  assert.match(listFile, /min-h-0 flex-1/)
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

test("controles ▲ / ▼ existentes continúan disponibles", async () => {
  const rowFile = await readFile(
    "components/planificacion/planning-task-table-row.tsx",
    "utf8"
  )
  const moduleFile = await readFile(
    "components/planificacion/planning-module.tsx",
    "utf8"
  )

  assert.match(rowFile, /▲/)
  assert.match(rowFile, /▼/)
  assert.match(moduleFile, /handleMoveTaskOrder/)
  assert.match(moduleFile, /buildExecutionOrderSwapUpdates/)
})

test("toolbar mantiene selector de fecha con espaciado reducido", async () => {
  const file = await readFile("components/planificacion/planning-toolbar.tsx", "utf8")

  assert.match(file, /type="date"/)
  assert.match(file, /Ir a Órdenes de Trabajo/)
  assert.match(file, /gap-2/)
})

test("resolvePlanningMapBaseLayerConfig expone satélite por defecto sin API key", () => {
  assert.equal(PLANNING_MAP_DEFAULT_BASE_LAYER, "satellite")

  const config = resolvePlanningMapBaseLayerConfig()
  assert.equal(config.id, "satellite")
  assert.match(config.url, /World_Imagery/)
  assert.ok(config.options.attribution)
  assert.equal(config.options.maxZoom, 19)
})

test("planning map usa capa satelital Esri por defecto", async () => {
  const tilesFile = await readFile(
    "lib/planificacion/planning-map-tiles.ts",
    "utf8"
  )
  const canvasFile = await readFile(
    "components/planificacion/planning-map-canvas.tsx",
    "utf8"
  )

  assert.match(tilesFile, /PLANNING_MAP_DEFAULT_BASE_LAYER[\s\S]*"satellite"/)
  assert.match(tilesFile, /World_Imagery/)
  assert.match(tilesFile, /attribution:/)
  assert.match(canvasFile, /resolvePlanningMapBaseLayerConfig/)
  assert.doesNotMatch(canvasFile, /tile\.openstreetmap\.org/)
})
