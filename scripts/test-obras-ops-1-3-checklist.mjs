import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  OPERATIONAL_CHECKLIST_TEMPLATE_KEY,
  createOperationalChecklistTemplateItem,
  mapTemplateToMobileItems,
  mergeTaskMetadataWithTemplate,
  normalizeOperationalChecklistTemplate,
  readOperationalChecklistTemplate,
  shouldShowOperationalChecklistForTask,
  taskHasEmbeddedOperationalChecklistTemplate,
} from "../lib/tasks/operational-checklist-template.ts"
import {
  OPERATIONAL_CHECKLIST_RESPONSES_KEY,
  buildOperationalChecklistDisplayItems,
  operationalChecklistResponseHasValue,
  readOperationalChecklistResponses,
} from "../lib/tasks/operational-checklist-responses.ts"
import { isWorkOrderTask } from "../lib/tasks/work-order.ts"

function mergeChecklistWithResponses(template, responses) {
  return template.map((item) => {
    const response = responses[item.id]
    const completed = operationalChecklistResponseHasValue(item.fieldType, response)

    return {
      id: item.id,
      label: item.title,
      fieldType: item.fieldType,
      required: item.required,
      sortOrder: item.sortOrder,
      confirmed: response?.confirmed ?? null,
      textValue: response?.textValue ?? null,
      photoIds: response?.photoIds ?? [],
      completed,
    }
  })
}

function validateOperationalChecklistComplete(template, responses) {
  const missingLabels = []

  for (const item of template) {
    if (!item.required) {
      continue
    }

    if (!operationalChecklistResponseHasValue(item.fieldType, responses[item.id])) {
      missingLabels.push(item.title)
    }
  }

  if (missingLabels.length === 0) {
    return { allowed: true }
  }

  return {
    allowed: false,
    missingLabels,
  }
}

const PROJECT_TASK_DIALOG_PATH = join(
  process.cwd(),
  "components/obras/project-task-dialog.tsx"
)
const TASKS_TAB_PATH = join(
  process.cwd(),
  "components/obras/project-tabs/tasks-tab.tsx"
)
const ADMIN_CHECKLIST_PATH = join(
  process.cwd(),
  "components/tareas/task-admin-operational-checklist.tsx"
)
const CHECKLIST_EXECUTION_PATH = join(
  process.cwd(),
  "lib/mobile/v1/tasks/checklist-execution.ts"
)
const TASK_SERVICE_PATH = join(
  process.cwd(),
  "lib/mobile/v1/tasks/task-service.ts"
)

const ITEM_A_ID = "item-a-1111-1111-1111-111111111111"
const ITEM_B_ID = "item-b-2222-2222-2222-222222222222"

function makeObraTask(overrides = {}) {
  return {
    id: "task-obra-1",
    projectId: "project-1",
    serviceType: null,
    taskMetadata: {},
    ...overrides,
  }
}

function makeNormalOtTask(overrides = {}) {
  return {
    id: "task-ot-1",
    projectId: null,
    projectCode: "OT",
    serviceType: "instalacion-fibra",
    taskMetadata: {},
    ...overrides,
  }
}

function makeTemplateSnapshot() {
  return [
    {
      id: ITEM_A_ID,
      title: "Confirmar empalme",
      fieldType: "confirmacion",
      required: true,
      sortOrder: 1,
    },
    {
      id: ITEM_B_ID,
      title: "Observaciones",
      fieldType: "entrada-datos",
      required: false,
      sortOrder: 2,
    },
  ]
}

test("1. obra task con template snapshot resuelve checklist", () => {
  const task = makeObraTask({
    taskMetadata: {
      [OPERATIONAL_CHECKLIST_TEMPLATE_KEY]: makeTemplateSnapshot(),
    },
  })

  const template = readOperationalChecklistTemplate(task)
  assert.equal(template.length, 2)
  assert.equal(template[0].id, ITEM_A_ID)

  const mobile = mapTemplateToMobileItems(template)
  assert.equal(mobile.length, 2)
  assert.equal(mobile[0].title, "Confirmar empalme")
})

test("2. OT normal sigue resolviendo por service_type (sin snapshot embebido)", () => {
  const task = makeNormalOtTask()

  assert.equal(taskHasEmbeddedOperationalChecklistTemplate(task), false)
  assert.equal(shouldShowOperationalChecklistForTask(task), true)
  assert.equal(readOperationalChecklistTemplate(task).length, 0)
})

test("3. sin template ni service_type devuelve checklist vacío", () => {
  const task = {
    projectId: null,
    serviceType: null,
    taskMetadata: {},
  }

  assert.equal(readOperationalChecklistTemplate(task).length, 0)
  assert.equal(shouldShowOperationalChecklistForTask(task), false)
  assert.equal(mapTemplateToMobileItems([]).length, 0)
})

test("hotfix: agregar ítem conserva fila borrador con título vacío en editor", () => {
  const draftItem = createOperationalChecklistTemplateItem(1)

  const editorItems = normalizeOperationalChecklistTemplate(
    [draftItem],
    { dropEmptyTitles: false }
  )

  assert.equal(editorItems.length, 1)
  assert.equal(editorItems[0].id, draftItem.id)
  assert.equal(editorItems[0].title, "")
  assert.equal(editorItems[0].sortOrder, 1)

  const persistedItems = normalizeOperationalChecklistTemplate(editorItems)

  assert.equal(persistedItems.length, 0)
})

test("hotfix: simular handler Agregar ítem agrega fila editable", () => {
  const existing = makeTemplateSnapshot()
  const nextItem = createOperationalChecklistTemplateItem(existing.length + 1)

  const afterAdd = normalizeOperationalChecklistTemplate(
    [...existing, nextItem],
    { dropEmptyTitles: false }
  )

  assert.equal(afterAdd.length, 3)
  assert.equal(afterAdd[2].id, nextItem.id)
  assert.equal(afterAdd[2].title, "")
})

test("4. crear OT persiste template en task_metadata", () => {
  const items = normalizeOperationalChecklistTemplate([
    {
      ...createOperationalChecklistTemplateItem(1),
      title: "Verificar material",
    },
    {
      id: ITEM_A_ID,
      title: "Foto final",
      fieldType: "fotografia",
      required: true,
      sortOrder: 2,
    },
  ])

  const metadata = mergeTaskMetadataWithTemplate({}, items)

  assert.ok(Array.isArray(metadata[OPERATIONAL_CHECKLIST_TEMPLATE_KEY]))
  assert.equal(metadata[OPERATIONAL_CHECKLIST_TEMPLATE_KEY].length, 2)
  assert.equal(
    metadata[OPERATIONAL_CHECKLIST_TEMPLATE_KEY][0].title,
    "Verificar material"
  )
})

test("5. editar mantiene IDs existentes", () => {
  const existing = makeTemplateSnapshot()
  const task = makeObraTask({
    taskMetadata: {
      [OPERATIONAL_CHECKLIST_TEMPLATE_KEY]: existing,
    },
  })

  const edited = normalizeOperationalChecklistTemplate([
    { ...existing[0], title: "Confirmar empalme actualizado" },
    existing[1],
    {
      id: "item-c-3333-3333-3333-333333333333",
      title: "Nuevo ítem",
      fieldType: "confirmacion",
      required: false,
      sortOrder: 3,
    },
  ])

  const metadata = mergeTaskMetadataWithTemplate(task, edited)
  const persisted = metadata[OPERATIONAL_CHECKLIST_TEMPLATE_KEY]

  assert.equal(persisted[0].id, ITEM_A_ID)
  assert.equal(persisted[1].id, ITEM_B_ID)
  assert.equal(persisted[0].title, "Confirmar empalme actualizado")
})

test("6. editar preserva metadata y operationalChecklistResponses", () => {
  const responses = {
    [ITEM_A_ID]: { confirmed: true },
  }

  const task = makeObraTask({
    taskMetadata: {
      customFlag: true,
      [OPERATIONAL_CHECKLIST_RESPONSES_KEY]: responses,
      [OPERATIONAL_CHECKLIST_TEMPLATE_KEY]: makeTemplateSnapshot(),
    },
  })

  const metadata = mergeTaskMetadataWithTemplate(task, makeTemplateSnapshot())

  assert.equal(metadata.customFlag, true)
  assert.deepEqual(metadata[OPERATIONAL_CHECKLIST_RESPONSES_KEY], responses)
  assert.deepEqual(
    readOperationalChecklistResponses({ taskMetadata: metadata }),
    responses
  )
})

test("7. mobile detail usa checklist embebido de obra", () => {
  const task = makeObraTask({
    taskMetadata: {
      [OPERATIONAL_CHECKLIST_TEMPLATE_KEY]: makeTemplateSnapshot(),
    },
  })

  const checklist = mergeChecklistWithResponses(
    mapTemplateToMobileItems(readOperationalChecklistTemplate(task)),
    {}
  )

  assert.equal(checklist.length, 2)
  assert.equal(checklist[0].label, "Confirmar empalme")
  assert.equal(checklist[0].completed, false)
})

test("8. guardar respuesta usa template correcto (ítem válido en snapshot)", () => {
  const template = mapTemplateToMobileItems(makeTemplateSnapshot())
  const item = template.find((entry) => entry.id === ITEM_A_ID)

  assert.ok(item)
  assert.equal(item.fieldType, "confirmacion")

  const merged = mergeChecklistWithResponses(template, {
    [ITEM_A_ID]: { confirmed: true },
  })

  assert.equal(merged[0].completed, true)
  assert.equal(merged[0].confirmed, true)
})

test("9. fotos usan template correcto (ítem fotografia del snapshot)", () => {
  const photoItem = {
    id: "photo-item-4444-4444-4444-444444444444",
    title: "Foto evidencia",
    fieldType: "fotografia",
    required: true,
    sortOrder: 1,
  }

  const template = mapTemplateToMobileItems([photoItem])
  const merged = mergeChecklistWithResponses(template, {
    [photoItem.id]: { photoIds: ["photo-1"] },
  })

  assert.equal(merged[0].fieldType, "fotografia")
  assert.deepEqual(merged[0].photoIds, ["photo-1"])
  assert.equal(merged[0].completed, true)
})

test("10. submit con required incompleto bloqueado", () => {
  const template = mapTemplateToMobileItems(makeTemplateSnapshot())
  const validation = validateOperationalChecklistComplete(template, {})

  assert.equal(validation.allowed, false)
  assert.ok(validation.missingLabels?.includes("Confirmar empalme"))
})

test("11. submit completo permitido", () => {
  const template = mapTemplateToMobileItems(makeTemplateSnapshot())
  const validation = validateOperationalChecklistComplete(template, {
    [ITEM_A_ID]: { confirmed: true },
  })

  assert.equal(validation.allowed, true)
})

test("12. obra sin checklist permite submit", () => {
  const task = makeObraTask()
  const template = mapTemplateToMobileItems(readOperationalChecklistTemplate(task))
  const validation = validateOperationalChecklistComplete(template, {})

  assert.equal(template.length, 0)
  assert.equal(validation.allowed, true)
})

test("13. revisar cierre muestra checklist de obra (guarda focalizada)", () => {
  const task = makeObraTask({
    taskMetadata: {
      [OPERATIONAL_CHECKLIST_TEMPLATE_KEY]: makeTemplateSnapshot(),
    },
  })

  assert.equal(isWorkOrderTask(task), false)
  assert.equal(shouldShowOperationalChecklistForTask(task), true)
  assert.equal(taskHasEmbeddedOperationalChecklistTemplate(task), true)

  const adminSource = readFileSync(ADMIN_CHECKLIST_PATH, "utf8")
  assert.match(adminSource, /shouldShowOperationalChecklistForTask/)
  assert.match(adminSource, /readOperationalChecklistTemplate/)
})

test("14. respuestas visibles en revisión", () => {
  const task = makeObraTask({
    taskMetadata: {
      [OPERATIONAL_CHECKLIST_TEMPLATE_KEY]: makeTemplateSnapshot(),
      [OPERATIONAL_CHECKLIST_RESPONSES_KEY]: {
        [ITEM_A_ID]: { confirmed: true },
        [ITEM_B_ID]: { textValue: "Sin novedades" },
      },
    },
  })

  const items = buildOperationalChecklistDisplayItems({
    template: readOperationalChecklistTemplate(task),
    responses: readOperationalChecklistResponses(task),
    includeUnanswered: false,
  })

  assert.equal(items.length, 2)
  assert.equal(items[0].confirmed, true)
  assert.equal(items[1].textValue, "Sin novedades")
})

test("15. sin regresión OT normal (service_type, no snapshot embebido)", () => {
  const task = makeNormalOtTask()

  assert.equal(isWorkOrderTask(task), true)
  assert.equal(taskHasEmbeddedOperationalChecklistTemplate(task), false)
  assert.equal(shouldShowOperationalChecklistForTask(task), true)

  const taskServiceSource = readFileSync(TASK_SERVICE_PATH, "utf8")
  assert.match(taskServiceSource, /fetchOperationalChecklistTemplateForTask/)
})

test("wiring: project dialog integra editor de checklist", () => {
  const dialogSource = readFileSync(PROJECT_TASK_DIALOG_PATH, "utf8")
  assert.match(dialogSource, /ProjectTaskChecklistEditor/)
  assert.match(dialogSource, /operationalChecklistTemplate/)
  assert.doesNotMatch(dialogSource, /checklist:\s*defaultChecklist/)
})

test("wiring: tasks tab persiste snapshot y no usa checklist legacy", () => {
  const tabSource = readFileSync(TASKS_TAB_PATH, "utf8")
  assert.match(tabSource, /mergeTaskMetadataWithTemplate/)
  assert.match(tabSource, /checklist:\s*\[\]/)
  assert.doesNotMatch(tabSource, /defaultChecklist/)
})

test("wiring: mobile resolver unificado en checklist-execution", () => {
  const source = readFileSync(CHECKLIST_EXECUTION_PATH, "utf8")
  assert.match(source, /fetchOperationalChecklistTemplateForTask/)
  assert.match(source, /readOperationalChecklistTemplate/)
})
