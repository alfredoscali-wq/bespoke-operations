import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  mapCreateProposalToInsert,
  mapProjectDesignOtProposalRow,
  mapUpdateProposalToUpdate,
} from "../lib/supabase/project-design-ot.mapper.ts"
import {
  PROJECT_DESIGN_SOURCE_METADATA_KEY,
  PROJECT_DESIGN_WORK_TYPE_METADATA_KEY,
  buildCreatedProposalPatch,
  buildObraTaskCreatePayloadFromProposal,
  buildProjectDesignOtProposalTitle,
  buildProposalEditPatch,
  buildProposalFromDesignElement,
  canCancelProjectDesignOtProposal,
  findActiveProposalForElement,
  isActiveProjectDesignOtProposalStatus,
  isPendingProjectDesignOtProposalStatus,
  listProposalCreateMissingFields,
  mergeProjectDesignSourceIntoMetadata,
  planProjectDesignOtProposals,
  readProjectDesignSourceMetadata,
  validateProposalForObraTaskCreate,
} from "../lib/projects/design/ot-proposals.ts"
import { shouldApplyPlanningQueueSideEffectsForTask } from "../lib/projects/project-start-dispatch.ts"
import { canReleaseProjectTaskToField } from "../lib/projects/project-task-field-release.ts"
import { OPERATIONAL_CHECKLIST_TEMPLATE_KEY } from "../lib/tasks/operational-checklist-template.ts"
import { getProjectActions } from "../lib/projects/utils.ts"
import {
  countOpenTasksForProjectFinalize,
  validateFinalizeProject,
} from "../lib/projects/project-finalize.ts"
import {
  PROJECT_DESIGN_OT_PROPOSAL_STATUSES,
  PROJECT_DESIGN_OT_WORK_TYPES,
} from "../lib/types/project-design-ot.ts"

const COMPANY_A = "00000000-0000-4000-8000-00000000000a"
const PROJECT_A = "11111111-1111-4111-8111-111111111111"
const NODE_ID = "22222222-2222-4222-8222-222222222221"
const NAP_ID = "22222222-2222-4222-8222-222222222222"
const TASK_ID = "33333333-3333-4333-8333-333333333333"
const CREW_ID = "44444444-4444-4444-8444-444444444444"

function element(overrides = {}) {
  return {
    id: NODE_ID,
    kind: "node",
    name: "Node-01",
    latitude: -31.42012,
    longitude: -64.18891,
    color: "#111827",
    icon: "square",
    gainM: 5,
    ...overrides,
  }
}

function proposal(overrides = {}) {
  return {
    id: "prop-node",
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    sourceElementId: NODE_ID,
    sourceElementKind: "node",
    status: "draft",
    title: "Instalación Node Node-01",
    workType: "node",
    priority: null,
    crewId: null,
    startDate: null,
    dueDate: null,
    latitude: -31.42012,
    longitude: -64.18891,
    observations: "",
    designName: "Node-01",
    designColor: "#111827",
    designIcon: "square",
    designGainM: 5,
    operationalChecklistTemplate: [],
    taskId: null,
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
    ...overrides,
  }
}

function readyProposal(overrides = {}) {
  return proposal({
    status: "ready",
    crewId: CREW_ID,
    startDate: "2026-09-20",
    dueDate: "2026-09-22",
    ...overrides,
  })
}

test("propuestas OT son tenant-safe y no insertan tasks", () => {
  const queries = readFileSync(
    join(process.cwd(), "lib/supabase/project-design-ot.queries.ts"),
    "utf8"
  )
  assert.match(queries, /from\("project_design_ot_proposals"\)/)
  assert.match(queries, /\.eq\("company_id", companyId\)/)
  assert.doesNotMatch(queries, /INSERT INTO public\.tasks/i)
  assert.doesNotMatch(queries, /execution_order/)
  assert.doesNotMatch(queries, /CREATE EXTENSION/i)
  assert.doesNotMatch(queries, /ALTER TABLE public\.tasks/)

  const insert = mapCreateProposalToInsert({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    sourceElementId: NODE_ID,
    sourceElementKind: "node",
    title: "Instalación Node Node-01",
    workType: "node",
  })
  assert.equal(insert.company_id, COMPANY_A)
  assert.equal(insert.project_id, PROJECT_A)
  assert.equal(insert.status, "draft")
  assert.equal(insert.work_type, "node")
  assert.equal("task_id" in insert, false)
  assert.equal("execution_order" in insert, false)

  assert.deepEqual(
    [...PROJECT_DESIGN_OT_PROPOSAL_STATUSES],
    ["draft", "ready", "created", "cancelled"]
  )
  assert.deepEqual(
    [...PROJECT_DESIGN_OT_WORK_TYPES],
    ["node", "nap", "tendido", "drop", "otro"]
  )

  const active = findActiveProposalForElement(
    [
      { sourceElementId: NODE_ID, status: "draft" },
      { sourceElementId: NAP_ID, status: "cancelled" },
    ],
    NODE_ID
  )
  assert.equal(active?.sourceElementId, NODE_ID)
  assert.equal(
    findActiveProposalForElement(
      [{ sourceElementId: NODE_ID, status: "cancelled" }],
      NODE_ID
    ),
    undefined
  )
  assert.equal(isActiveProjectDesignOtProposalStatus("cancelled"), false)
  assert.equal(isActiveProjectDesignOtProposalStatus("created"), true)
})

test("1. genera preliminar para Node", () => {
  const built = buildProposalFromDesignElement(
    COMPANY_A,
    PROJECT_A,
    element()
  )
  assert.equal(built.workType, "node")
  assert.equal(built.sourceElementKind, "node")
  assert.equal(built.title, "Instalación Node Node-01")
  assert.equal(built.status, "draft")
  assert.equal(built.crewId, undefined)
  assert.equal(built.startDate, undefined)
})

test("2. genera preliminar para NAP", () => {
  const built = buildProposalFromDesignElement(
    COMPANY_A,
    PROJECT_A,
    element({
      id: NAP_ID,
      kind: "nap",
      name: "NAP-01",
      gainM: 10,
      icon: "circle",
    })
  )
  assert.equal(built.workType, "nap")
  assert.equal(built.title, "Instalación NAP NAP-01")
  assert.equal(built.designName, "NAP-01")
  assert.equal(built.designGainM, 10)
})

test("3. copia GPS del elemento de diseño", () => {
  const built = buildProposalFromDesignElement(
    COMPANY_A,
    PROJECT_A,
    element({ latitude: -31.5, longitude: -64.2 })
  )
  assert.equal(built.latitude, -31.5)
  assert.equal(built.longitude, -64.2)
})

test("4. copia ganancia planificada", () => {
  const nap = buildProposalFromDesignElement(
    COMPANY_A,
    PROJECT_A,
    element({ id: NAP_ID, kind: "nap", name: "NAP-01", gainM: 10 })
  )
  assert.equal(nap.designGainM, 10)
  const node = buildProposalFromDesignElement(
    COMPANY_A,
    PROJECT_A,
    element({ gainM: 5 })
  )
  assert.equal(node.designGainM, 5)
})

test("5. no genera duplicados de propuestas activas", () => {
  const plan = planProjectDesignOtProposals({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    elements: [
      element(),
      element({ id: NAP_ID, kind: "nap", name: "NAP-01", gainM: 10 }),
    ],
    existing: [
      { sourceElementId: NODE_ID, status: "draft" },
      { sourceElementId: NAP_ID, status: "created" },
    ],
  })
  assert.equal(plan.nodeNew, 0)
  assert.equal(plan.napNew, 0)
  assert.equal(plan.reused, 2)
  assert.equal(plan.payloads.length, 0)
  assert.ok(findActiveProposalForElement(
    [{ sourceElementId: NODE_ID, status: "draft" }],
    NODE_ID
  ))
})

test("6. editar preliminar actualiza datos y pasa a lista si está completa", () => {
  const patch = buildProposalEditPatch(proposal(), {
    title: "Instalación Node Node-01 revisada",
    crewId: CREW_ID,
    startDate: "2026-09-20",
    dueDate: "2026-09-22",
    observations: "Llevar fusiones",
  })
  assert.equal(patch.title, "Instalación Node Node-01 revisada")
  assert.equal(patch.crewId, CREW_ID)
  assert.equal(patch.status, "ready")
  assert.equal(patch.observations, "Llevar fusiones")
})

test("7. validar campos obligatorios de OT de Obra", () => {
  const missing = listProposalCreateMissingFields(proposal())
  assert.deepEqual(missing, [
    "cuadrilla",
    "fecha de inicio",
  ])
  const invalid = validateProposalForObraTaskCreate(proposal({ title: "   " }))
  assert.equal(invalid.ok, false)
  if (!invalid.ok) {
    assert.match(invalid.message, /título/)
    assert.match(invalid.message, /cuadrilla/)
  }
  const valid = validateProposalForObraTaskCreate(readyProposal({ dueDate: null }))
  assert.equal(valid.ok, true)
})

test("8-14. crear OT real conserva obra, tipo, metadata y ganancia", () => {
  const napProposal = readyProposal({
    id: "prop-nap",
    sourceElementId: NAP_ID,
    sourceElementKind: "nap",
    workType: "nap",
    title: "Instalación NAP NAP-01",
    designName: "NAP-01",
    designGainM: 10,
    latitude: -31.41,
    longitude: -64.19,
  })
  const built = buildObraTaskCreatePayloadFromProposal({
    project: {
      id: PROJECT_A,
      code: "OBR-001",
      name: "Obra Norte",
      type: "fiber",
      status: "planned",
    },
    proposal: napProposal,
    crewName: "Cuadrilla 1",
    supervisor: "Ana",
  })
  assert.equal(built.ok, true)
  if (!built.ok) return

  assert.equal(built.payload.type, "fiber")
  assert.equal(built.payload.projectId, PROJECT_A)
  assert.equal(built.payload.projectCode, "OBR-001")
  assert.equal(built.status, "programada")
  assert.equal(built.payload.title, "Instalación NAP NAP-01")
  assert.equal(built.payload.crewId, CREW_ID)
  assert.equal(built.payload.latitude, -31.41)
  assert.equal(built.payload.longitude, -64.19)

  const source = readProjectDesignSourceMetadata(built.payload.taskMetadata)
  assert.ok(source)
  assert.equal(source.kind, "nap")
  assert.equal(source.elementId, NAP_ID)
  assert.equal(source.proposalId, "prop-nap")
  assert.equal(source.identifier, "NAP-01")
  assert.equal(source.plannedGainM, 10)
  assert.equal(
    built.payload.taskMetadata[PROJECT_DESIGN_WORK_TYPE_METADATA_KEY],
    "nap"
  )
  assert.ok(built.payload.taskMetadata[PROJECT_DESIGN_SOURCE_METADATA_KEY])

  const createdPatch = buildCreatedProposalPatch(TASK_ID)
  assert.equal(createdPatch.status, "created")
  assert.equal(createdPatch.taskId, TASK_ID)

  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({
      projectId: PROJECT_A,
      status: built.status,
    }),
    false
  )
})

test("9-10. al crear, la propuesta queda created y asociada a la OT", () => {
  const patch = buildCreatedProposalPatch(TASK_ID)
  const mapped = mapUpdateProposalToUpdate(patch)
  assert.equal(mapped.status, "created")
  assert.equal(mapped.task_id, TASK_ID)
})

test("11. el payload de OT usa project_id de la propuesta/obra", () => {
  const built = buildObraTaskCreatePayloadFromProposal({
    project: {
      id: PROJECT_A,
      code: "OBR-001",
      name: "Obra Norte",
      type: "fiber",
      status: "active",
    },
    proposal: readyProposal(),
    crewName: "Cuadrilla 1",
    supervisor: "Ana",
  })
  assert.equal(built.ok, true)
  if (!built.ok) return
  assert.equal(built.payload.projectId, PROJECT_A)
  assert.equal(built.status, "programada")
})

test("12. task.type conserva el tipo de la Obra, no node/nap", () => {
  const built = buildObraTaskCreatePayloadFromProposal({
    project: {
      id: PROJECT_A,
      code: "OBR-001",
      name: "Obra Norte",
      type: "camera",
      status: "planned",
    },
    proposal: readyProposal(),
    crewName: "Cuadrilla 1",
    supervisor: "Ana",
  })
  assert.equal(built.ok, true)
  if (!built.ok) return
  assert.equal(built.payload.type, "camera")
  assert.notEqual(built.payload.type, "node")
  assert.notEqual(built.payload.type, "nap")
})

test("13-14. task_metadata conserva projectDesignSource y plannedGainM", () => {
  const metadata = mergeProjectDesignSourceIntoMetadata({}, readyProposal({
    id: "prop-nap",
    sourceElementKind: "nap",
    workType: "nap",
    sourceElementId: NAP_ID,
    designName: "NAP-01",
    designGainM: 10,
  }))
  const source = readProjectDesignSourceMetadata(metadata)
  assert.deepEqual(source, {
    kind: "nap",
    elementId: NAP_ID,
    proposalId: "prop-nap",
    identifier: "NAP-01",
    plannedGainM: 10,
  })
})

test("15. cancelar preliminar no la elimina, cambia status", () => {
  assert.equal(canCancelProjectDesignOtProposal(proposal()), true)
  assert.equal(canCancelProjectDesignOtProposal(proposal({ status: "ready" })), true)
  assert.equal(canCancelProjectDesignOtProposal(proposal({ status: "created" })), false)
  const mapped = mapUpdateProposalToUpdate({ status: "cancelled" })
  assert.equal(mapped.status, "cancelled")
  assert.equal(mapped.task_id, undefined)
  assert.equal(isActiveProjectDesignOtProposalStatus("cancelled"), false)
})

test("16. una propuesta cancelada puede regenerarse", () => {
  const plan = planProjectDesignOtProposals({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    elements: [element()],
    existing: [{ sourceElementId: NODE_ID, status: "cancelled" }],
  })
  assert.equal(plan.nodeNew, 1)
  assert.equal(plan.payloads.length, 1)
  assert.equal(plan.payloads[0].sourceElementId, NODE_ID)
})

test("17. una OT creada no puede volver a crearse desde la misma propuesta", () => {
  const created = validateProposalForObraTaskCreate(
    proposal({ status: "created", taskId: TASK_ID, crewId: CREW_ID, startDate: "2026-09-20", dueDate: "2026-09-22" })
  )
  assert.equal(created.ok, false)
  if (!created.ok) {
    assert.match(created.message, /ya tiene una OT creada/)
  }
  const withTaskId = validateProposalForObraTaskCreate(
    readyProposal({ status: "draft", taskId: TASK_ID })
  )
  assert.equal(withTaskId.ok, false)
  assert.equal(canCancelProjectDesignOtProposal(proposal({ status: "created" })), false)
})

test("18. generar preliminares no crea tasks", () => {
  const plan = planProjectDesignOtProposals({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    elements: [
      element(),
      element({ id: NAP_ID, kind: "nap", name: "NAP-01", gainM: 10 }),
      element({ id: "seg-like", kind: "tendido", name: "Tramo 1" }),
    ],
    existing: [],
  })
  assert.equal(plan.nodeNew, 1)
  assert.equal(plan.napNew, 1)
  assert.equal(plan.payloads.length, 2)
  for (const payload of plan.payloads) {
    assert.equal(payload.status, "draft")
    assert.equal("taskId" in payload, false)
    const inserted = mapCreateProposalToInsert(payload)
    assert.equal(inserted.task_id, undefined)
    assert.equal(inserted.status, "draft")
  }
})

test("títulos de Node y NAP siguen el formato pedido", () => {
  assert.equal(buildProjectDesignOtProposalTitle("node", "Node-01"), "Instalación Node Node-01")
  assert.equal(buildProjectDesignOtProposalTitle("nap", "NAP-01"), "Instalación NAP NAP-01")
})

test("el mapper roundtrip conserva GPS, ganancia e icono", () => {
  const input = buildProposalFromDesignElement(
    COMPANY_A,
    PROJECT_A,
    element({
      id: NAP_ID,
      kind: "nap",
      name: "NAP-01",
      gainM: 10,
      color: "#dc2626",
      icon: "hexagon",
    })
  )
  const inserted = mapCreateProposalToInsert(input)
  const mapped = mapProjectDesignOtProposalRow({
    id: "prop-mapped",
    company_id: inserted.company_id,
    project_id: inserted.project_id,
    source_element_id: inserted.source_element_id,
    source_element_kind: inserted.source_element_kind,
    status: inserted.status ?? "draft",
    title: inserted.title,
    work_type: inserted.work_type,
    priority: inserted.priority ?? null,
    crew_id: inserted.crew_id ?? null,
    start_date: inserted.start_date ?? null,
    due_date: inserted.due_date ?? null,
    latitude: inserted.latitude ?? null,
    longitude: inserted.longitude ?? null,
    observations: inserted.observations ?? null,
    design_name: inserted.design_name ?? null,
    design_color: inserted.design_color ?? null,
    design_icon: inserted.design_icon ?? null,
    design_gain_m: inserted.design_gain_m ?? null,
    operational_checklist_template: inserted.operational_checklist_template ?? [],
    task_id: null,
    created_at: "2026-09-14T00:00:00.000Z",
    updated_at: "2026-09-14T00:00:00.000Z",
  })
  assert.equal(mapped.workType, "nap")
  assert.equal(mapped.latitude, -31.42012)
  assert.equal(mapped.longitude, -64.18891)
  assert.equal(mapped.designGainM, 10)
  assert.equal(mapped.designIcon, "hexagon")
  assert.equal(mapped.taskId, null)
  assert.equal(mapped.status, "draft")
  assert.deepEqual(mapped.operationalChecklistTemplate, [])
})

test("5b. created no aparece como preliminar pendiente", () => {
  assert.equal(isPendingProjectDesignOtProposalStatus("draft"), true)
  assert.equal(isPendingProjectDesignOtProposalStatus("ready"), true)
  assert.equal(isPendingProjectDesignOtProposalStatus("created"), false)
  assert.equal(isPendingProjectDesignOtProposalStatus("cancelled"), false)
  assert.equal(isActiveProjectDesignOtProposalStatus("created"), true)
})

test("9-11. dueDate es opcional y permite crear", () => {
  const withoutDue = validateProposalForObraTaskCreate(readyProposal({ dueDate: null }))
  assert.equal(withoutDue.ok, true)
  const built = buildObraTaskCreatePayloadFromProposal({
    project: {
      id: PROJECT_A,
      code: "OBR-001",
      name: "Obra Norte",
      type: "fiber",
      status: "planned",
    },
    proposal: readyProposal({ dueDate: null }),
    crewName: "Cuadrilla 1",
    supervisor: "Ana",
  })
  assert.equal(built.ok, true)
  if (!built.ok) return
  assert.equal(built.payload.dueDate, "")
  assert.equal(built.status, "programada")

  const withDue = buildObraTaskCreatePayloadFromProposal({
    project: {
      id: PROJECT_A,
      code: "OBR-001",
      name: "Obra Norte",
      type: "fiber",
      status: "planned",
    },
    proposal: readyProposal({ dueDate: "2026-09-22" }),
    crewName: "Cuadrilla 1",
    supervisor: "Ana",
  })
  assert.equal(withDue.ok, true)
  if (!withDue.ok) return
  assert.equal(withDue.payload.dueDate, "2026-09-22")

  const inverted = validateProposalForObraTaskCreate(
    readyProposal({ startDate: "2026-09-22", dueDate: "2026-09-20" })
  )
  assert.equal(inverted.ok, false)
})

test("12-16. checklist individual se copia y no es obligatorio", () => {
  const checklist = [
    {
      id: "chk-1",
      title: "Instalar caja",
      fieldType: "checkbox",
      required: true,
      sortOrder: 1,
    },
    {
      id: "chk-2",
      title: "Fusionar",
      fieldType: "checkbox",
      required: false,
      sortOrder: 2,
    },
  ]
  const nap1 = readyProposal({
    id: "prop-nap-1",
    operationalChecklistTemplate: checklist,
  })
  const nap2 = readyProposal({
    id: "prop-nap-2",
    operationalChecklistTemplate: [
      {
        id: "chk-a",
        title: "Medir potencia",
        fieldType: "checkbox",
        required: true,
        sortOrder: 1,
      },
    ],
  })
  const empty = readyProposal({
    id: "prop-empty",
    operationalChecklistTemplate: [],
  })

  const built1 = buildObraTaskCreatePayloadFromProposal({
    project: {
      id: PROJECT_A,
      code: "OBR-001",
      name: "Obra Norte",
      type: "fiber",
      status: "planned",
    },
    proposal: nap1,
    crewName: "Cuadrilla 1",
    supervisor: "Ana",
  })
  const built2 = buildObraTaskCreatePayloadFromProposal({
    project: {
      id: PROJECT_A,
      code: "OBR-001",
      name: "Obra Norte",
      type: "fiber",
      status: "planned",
    },
    proposal: nap2,
    crewName: "Cuadrilla 1",
    supervisor: "Ana",
  })
  const builtEmpty = buildObraTaskCreatePayloadFromProposal({
    project: {
      id: PROJECT_A,
      code: "OBR-001",
      name: "Obra Norte",
      type: "fiber",
      status: "planned",
    },
    proposal: empty,
    crewName: "Cuadrilla 1",
    supervisor: "Ana",
  })

  assert.equal(built1.ok, true)
  assert.equal(built2.ok, true)
  assert.equal(builtEmpty.ok, true)
  if (!built1.ok || !built2.ok || !builtEmpty.ok) return

  assert.deepEqual(
    built1.payload.taskMetadata[OPERATIONAL_CHECKLIST_TEMPLATE_KEY],
    checklist
  )
  assert.equal(
    built2.payload.taskMetadata[OPERATIONAL_CHECKLIST_TEMPLATE_KEY][0].title,
    "Medir potencia"
  )
  assert.notEqual(
    built1.payload.taskMetadata[OPERATIONAL_CHECKLIST_TEMPLATE_KEY][0].title,
    built2.payload.taskMetadata[OPERATIONAL_CHECKLIST_TEMPLATE_KEY][0].title
  )
  assert.equal(
    builtEmpty.payload.taskMetadata[OPERATIONAL_CHECKLIST_TEMPLATE_KEY],
    undefined
  )
})

test("25-29. OT queda programada y se puede enviar a cuadrilla con Obra planned", () => {
  const built = buildObraTaskCreatePayloadFromProposal({
    project: {
      id: PROJECT_A,
      code: "OBR-001",
      name: "Obra Norte",
      type: "fiber",
      status: "planned",
    },
    proposal: readyProposal(),
    crewName: "Cuadrilla A",
    supervisor: "Ana",
  })
  assert.equal(built.ok, true)
  if (!built.ok) return
  assert.equal(built.status, "programada")
  assert.equal(
    canReleaseProjectTaskToField({
      projectId: PROJECT_A,
      status: built.status,
      crewId: CREW_ID,
      crew: "Cuadrilla A",
    }),
    true
  )
})

test("30-33. no hay Iniciar Obra; finalize sigue en active", () => {
  const plannedActions = getProjectActions("planned").map((action) => action.id)
  assert.equal(plannedActions.includes("start"), false)
  assert.equal(getProjectActions("active").some((action) => action.id === "finalize"), true)
})

test("34-40. finalizar bloquea OTs no terminales y no bloquea preliminares", () => {
  const base = { projectStatus: "active", projectId: PROJECT_A }
  assert.equal(
    validateFinalizeProject({
      ...base,
      tasks: [{ id: "t1", status: "programada", projectId: PROJECT_A }],
    }).ok,
    false
  )
  assert.equal(
    validateFinalizeProject({
      ...base,
      tasks: [{ id: "t1", status: "asignada", projectId: PROJECT_A }],
    }).ok,
    false
  )
  assert.equal(
    validateFinalizeProject({
      ...base,
      tasks: [{ id: "t1", status: "en-curso", projectId: PROJECT_A }],
    }).ok,
    false
  )
  assert.equal(
    validateFinalizeProject({
      ...base,
      tasks: [
        { id: "t1", status: "finalizada", projectId: PROJECT_A },
        { id: "t2", status: "cancelada", projectId: PROJECT_A },
      ],
    }).ok,
    true
  )
  assert.equal(
    countOpenTasksForProjectFinalize(
      [{ id: "t1", status: "programada", projectId: PROJECT_A }],
      PROJECT_A
    ),
    1
  )
})

test("ubicacion: Generar preliminares solo en Obra → OTs", () => {
  const tasksTab = readFileSync(
    join(process.cwd(), "components/obras/project-tabs/tasks-tab.tsx"),
    "utf8"
  )
  const workspace = readFileSync(
    join(process.cwd(), "components/obras/design/project-design-workspace.tsx"),
    "utf8"
  )
  assert.match(tasksTab, /Generar OTs preliminares/)
  assert.doesNotMatch(workspace, /Generar OTs preliminares/)
})

test("16. checklist global no se modifica al editar preliminar", () => {
  const dialog = readFileSync(
    join(process.cwd(), "components/obras/project-design-ot-proposal-dialog.tsx"),
    "utf8"
  )
  assert.match(dialog, /ProjectTaskChecklistEditor/)
  assert.doesNotMatch(dialog, /saveWorkOrderTypeChecklist/)
  assert.doesNotMatch(dialog, /work-order-type-checklist/)
})
