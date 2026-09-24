/**
 * Obra work report V1: project-scoped OT list, checklist, photos, PDF.
 * Does not depend on production data.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { buildProjectWorkReportData } from "../lib/projects/work-report/build-report-data.ts"
import { generateProjectWorkReportPdf } from "../lib/projects/work-report/generate-pdf.ts"
import { renderProjectWorkReportMarkup } from "../lib/projects/work-report/render-html.ts"
import {
  countProjectWorkReportPdfPages,
  isProjectWorkReportTechnicalCaption,
  projectWorkReportClientMeta,
} from "../lib/projects/work-report/work-order-presentation.ts"
import { associateProjectWorkReportPhotos } from "../lib/projects/work-report/photos.ts"
import { buildProjectWorkReportChecklistItems } from "../lib/projects/work-report/checklist.ts"
import {
  defaultProjectWorkReportSelectedTaskIds,
  filterProjectWorkReportTasksByScope,
  matchesProjectWorkReportTask,
  selectProjectWorkReportTasks,
} from "../lib/projects/work-report/select-tasks.ts"
import {
  isProjectWorkReportDeploymentTask,
} from "../lib/projects/work-report/deployment.ts"
import {
  parseProjectWorkReportOptions,
} from "../lib/projects/work-report/options.ts"
import {
  PROJECT_WORK_REPORT_SIGNED_URL_TTL_SECONDS,
  PROJECT_WORK_REPORT_TEMP_PREFIX,
  VERCEL_FUNCTION_RESPONSE_LIMIT_BYTES,
  buildProjectWorkReportSignedUrlPayload,
  buildProjectWorkReportTempStoragePath,
  isExpiredWorkReportTempObject,
  isWorkReportTempPathOwnedByCompany,
  resolveProjectWorkReportDeliveryMode,
  signedUrlPayloadFitsFunctionLimit,
} from "../lib/projects/work-report/delivery.ts"
import { persistProjectWorkReportPdf } from "../lib/projects/work-report/persist-temp.ts"
import { matchesProjectWorkOrderListQuery } from "../lib/tasks/task-list-scope.ts"
import {
  buildProjectWorkReportShareUrl,
  getBespokePublicReportOrigin,
  isTenantOperationsHost,
} from "../lib/projects/work-report/public-origin.ts"
import {
  evaluateProjectWorkReportShareAccess,
  shareBelongsToCompanyProject,
} from "../lib/projects/work-report/share-access.ts"
import {
  createProjectWorkReportShareToken,
  decryptProjectWorkReportShareToken,
  encryptProjectWorkReportShareToken,
  hashProjectWorkReportSharePassword,
  hashProjectWorkReportShareToken,
  verifyProjectWorkReportSharePassword,
} from "../lib/projects/work-report/share-crypto.ts"
import {
  sessionMatchesShare,
  signProjectWorkReportShareSession,
  verifyProjectWorkReportShareSession,
} from "../lib/projects/work-report/share-session.ts"
import {
  resolveProjectWorkReportShareExpiresAt,
} from "../lib/projects/work-report/share-options.ts"
import { isAuthPublicPath } from "../lib/auth/routes.ts"

const root = resolve(import.meta.dirname, "..")

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

const COMPANY_ID = "00000000-0000-4000-8000-000000000002"
const OTHER_COMPANY_ID = "00000000-0000-4000-8000-000000000099"
const CORTADEROS_ID = "35e36f76-7dcc-4d8a-b8d2-284692149401"
const OTHER_PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const cortaderosProject = {
  id: CORTADEROS_ID,
  code: "FO-CORT-2026",
  name: "LOS CORTADEROS",
  client: "Zabala Emiliano · LOS POLACOS",
  location: "X5147 Córdoba",
  description: "",
  startDate: "2026-09-03",
  endDate: "2026-09-11",
}

function makeTask(overrides = {}) {
  return {
    id: overrides.id ?? "ot-1",
    code: overrides.code ?? "TSK-1",
    title: overrides.title ?? "NAP 001",
    description: overrides.description ?? "",
    projectId: overrides.projectId ?? CORTADEROS_ID,
    projectCode: "FO-CORT-2026",
    projectName: "LOS CORTADEROS",
    type: "fiber",
    status: overrides.status ?? "finalizada",
    priority: "media",
    supervisor: overrides.supervisor ?? "",
    crewId: overrides.crewId ?? "crew-1",
    crew: overrides.crew ?? "Cuadrilla FO",
    startDate: overrides.startDate ?? "2026-09-03",
    dueDate: overrides.dueDate ?? "2026-09-03",
    estimatedDuration: "120",
    checklist: [],
    progress: 100,
    companyId: overrides.companyId ?? COMPANY_ID,
    deletedAt: overrides.deletedAt ?? null,
    taskMetadata: overrides.taskMetadata,
    observationsForCrew: overrides.observationsForCrew,
    completedAt: overrides.completedAt ?? "2026-09-11",
    ...overrides,
  }
}

function makeCortaderosTasks() {
  const codes = [
    20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56,
    58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 87,
  ]
  return codes.map((number, index) =>
    makeTask({
      id: `cort-${number}`,
      code: `TSK-FOCORT2026-${String(number).padStart(3, "0")}`,
      title: `NAP ${String(number).padStart(3, "0")}`,
      dueDate: `2026-09-${String((index % 9) + 3).padStart(2, "0")}`,
    })
  )
}

test("1. OT fuera del primer bloque de 1000 se incluye", () => {
  const historical = Array.from({ length: 1100 }, (_, index) =>
    makeTask({
      id: `old-${index}`,
      code: `TSK-OLD-${String(index).padStart(4, "0")}`,
      projectId: OTHER_PROJECT_ID,
      status: "finalizada",
      dueDate: "2026-01-01",
    })
  )
  const target = makeTask({
    id: "cort-late",
    code: "TSK-FOCORT2026-087",
    dueDate: "2026-09-11",
  })
  const selected = selectProjectWorkReportTasks(
    [...historical, target],
    COMPANY_ID,
    CORTADEROS_ID,
    "completed"
  )
  assert.equal(selected.length, 1)
  assert.equal(selected[0].code, "TSK-FOCORT2026-087")
})

test("2. company_id incorrecto no devuelve datos", () => {
  const task = makeTask({ code: "TSK-FOCORT2026-024" })
  assert.equal(
    matchesProjectWorkReportTask(task, OTHER_COMPANY_ID, CORTADEROS_ID, "all"),
    false
  )
  assert.equal(
    matchesProjectWorkOrderListQuery(task, OTHER_COMPANY_ID, CORTADEROS_ID),
    false
  )
  const selected = selectProjectWorkReportTasks(
    [task],
    OTHER_COMPANY_ID,
    CORTADEROS_ID,
    "completed"
  )
  assert.equal(selected.length, 0)
})

test("3. OT de otra Obra no aparece", () => {
  const other = makeTask({
    id: "sg-1",
    code: "TSK-FOSGABNET-002",
    projectId: OTHER_PROJECT_ID,
  })
  const selected = selectProjectWorkReportTasks(
    [other],
    COMPANY_ID,
    CORTADEROS_ID,
    "all"
  )
  assert.equal(selected.length, 0)
})

test("4. deleted_at != null no aparece", () => {
  const deleted = makeTask({
    code: "TSK-FOCORT2026-089",
    deletedAt: "2026-09-19T00:00:00Z",
  })
  assert.equal(
    matchesProjectWorkReportTask(deleted, COMPANY_ID, CORTADEROS_ID, "all"),
    false
  )
})

test("5. Solo finalizadas excluye activas y pending closure", () => {
  const tasks = [
    makeTask({ id: "fin", code: "TSK-FIN", status: "finalizada" }),
    makeTask({ id: "asig", code: "TSK-ASIG", status: "asignada" }),
    makeTask({
      id: "pc",
      code: "TSK-PC",
      status: "pendiente-cierre",
    }),
    makeTask({ id: "ap", code: "TSK-AP", status: "en-aprobacion" }),
    makeTask({ id: "can", code: "TSK-CAN", status: "cancelada" }),
  ]
  const selected = selectProjectWorkReportTasks(
    tasks,
    COMPANY_ID,
    CORTADEROS_ID,
    "completed"
  )
  assert.deepEqual(
    selected.map((task) => task.code),
    ["TSK-FIN"]
  )
})

test("6. Todas las OT incluye los estados seleccionados", () => {
  const tasks = [
    makeTask({ id: "fin", code: "TSK-FIN", status: "finalizada", dueDate: "2026-09-03" }),
    makeTask({ id: "asig", code: "TSK-ASIG", status: "asignada", dueDate: "2026-09-04" }),
    makeTask({
      id: "pc",
      code: "TSK-PC",
      status: "pendiente-cierre",
      dueDate: "2026-09-05",
    }),
  ]
  const selected = selectProjectWorkReportTasks(
    tasks,
    COMPANY_ID,
    CORTADEROS_ID,
    "all"
  )
  assert.deepEqual(
    selected.map((task) => task.code),
    ["TSK-FIN", "TSK-ASIG", "TSK-PC"]
  )
  assert.equal(filterProjectWorkReportTasksByScope(tasks, "all").length, 3)
})

test("7. Checklist extrae template + responses", () => {
  const task = makeTask({
    taskMetadata: {
      operationalChecklistTemplate: [
        {
          id: "chk-1",
          title: "Fusiono de fibras",
          fieldType: "confirmacion",
          required: true,
          sortOrder: 1,
        },
        {
          id: "chk-2",
          title: "Potencia medida",
          fieldType: "entrada-datos",
          required: false,
          sortOrder: 2,
        },
      ],
      operationalChecklistResponses: {
        "chk-1": { confirmed: true },
        "chk-2": { textValue: "-18 dBm" },
      },
    },
  })
  const items = buildProjectWorkReportChecklistItems(task)
  assert.ok(items)
  assert.equal(items.length, 2)
  assert.equal(items[0].label, "Fusiono de fibras")
  assert.equal(items[0].result, "Confirmado")
  assert.equal(items[0].completed, true)
  assert.equal(items[1].label, "Potencia medida")
  assert.equal(items[1].result, "-18 dBm")
})

test("fidelidad: el informe documenta lo registrado y no inventa datos", () => {
  const recorded = "Se fusionó al splitter 1x16"
  const trabajo = "Pelo utilizado: azul"
  const withRecorded = makeTask({
    id: "cort-24",
    code: "TSK-FOCORT2026-024",
    title: "NAP 024",
    description: recorded,
    supervisor: "Juan Pérez",
    taskMetadata: {
      trabajoRealizado: trabajo,
      operationalChecklistTemplate: [
        {
          id: "chk-1",
          title: "Fusiono de fibras",
          fieldType: "confirmacion",
          required: true,
          sortOrder: 1,
        },
        {
          id: "chk-2",
          title: "Potencia medida",
          fieldType: "entrada-datos",
          required: false,
          sortOrder: 2,
        },
        {
          id: "chk-3",
          title: "Foto de cierre",
          fieldType: "fotografia",
          required: false,
          sortOrder: 3,
        },
      ],
      operationalChecklistResponses: {
        "chk-1": { confirmed: true },
        "chk-3": { photoIds: ["photo-1", "photo-2"] },
      },
    },
  })
  const otherOt = makeTask({
    id: "cort-26",
    code: "TSK-FOCORT2026-026",
    title: "NAP 026",
    description: "OT distinta",
    observationsForCrew: "No copiar esta observación",
    taskMetadata: {
      trabajoRealizado: "Texto de otra OT",
    },
  })

  const report = buildProjectWorkReportData({
    companyId: COMPANY_ID,
    project: cortaderosProject,
    tasks: [withRecorded, otherOt],
    photos: [
      {
        taskId: "cort-24",
        description: "Cierre de manga",
        createdAt: "2026-09-04T15:30:00Z",
      },
      {
        taskId: "cort-26",
        description: "foto de otra OT",
        createdAt: "2026-09-04T16:00:00Z",
      },
    ],
    taskScope: "completed",
    generatedAt: "2026-09-23T21:00:00.000Z",
  })

  const order = report.workOrders.find((item) => item.code === "TSK-FOCORT2026-024")
  assert.ok(order)
  assert.equal(order.description, recorded)
  assert.equal(order.trabajoRealizado, trabajo)
  assert.equal(order.supervisor, "Juan Pérez")
  assert.equal(order.technicians, null)
  assert.equal(order.observations, null)

  const potencia = order.checklist?.find((item) => item.label === "Potencia medida")
  assert.ok(potencia)
  assert.equal(potencia.result, null)
  assert.equal(potencia.completed, false)

  const fotoItem = order.checklist?.find((item) => item.label === "Foto de cierre")
  assert.ok(fotoItem)
  assert.equal(fotoItem.result, null)
  assert.equal(fotoItem.completed, true)

  assert.equal(order.photos.length, 1)
  assert.equal(order.photos[0].description, "Cierre de manga")
  assert.ok(!order.photos.some((photo) => photo.description === "foto de otra OT"))
  assert.notEqual(order.trabajoRealizado, "Texto de otra OT")
  assert.notEqual(order.observations, "No copiar esta observación")

  const emptyClose = report.workOrders.find((item) => item.code === "TSK-FOCORT2026-026")
  assert.equal(emptyClose?.trabajoRealizado, "Texto de otra OT")

  const html = renderProjectWorkReportMarkup(report)
  assert.match(html, /Pelo utilizado: azul/)
  assert.match(html, /Fusiono de fibras/)
  assert.match(html, /Potencia medida/)
  assert.doesNotMatch(html, /Se fusionó al splitter 1x16/)
  assert.doesNotMatch(html, /Juan Pérez/)
  assert.doesNotMatch(html, /Cuadrilla FO/)
  assert.doesNotMatch(html, /instalado correctamente/)
  assert.doesNotMatch(html, /Configuración recomendada/)
  assert.doesNotMatch(html, /Potencia: OK/)
  assert.doesNotMatch(html, /trabajo realizado correctamente/i)
  assert.doesNotMatch(html, /instalación completada satisfactoriamente/i)
  assert.doesNotMatch(html, /equipamiento operativo/i)
  assert.doesNotMatch(html, /instalación en condiciones/i)
  assert.doesNotMatch(html, /conforme a normativa/i)

  const unanswered = buildProjectWorkReportChecklistItems(
    makeTask({
      taskMetadata: {
        operationalChecklistTemplate: [
          {
            id: "chk-p",
            title: "Potencia",
            fieldType: "entrada-datos",
            required: false,
            sortOrder: 1,
          },
        ],
        operationalChecklistResponses: {},
      },
    })
  )
  assert.equal(unanswered?.[0].result, null)
  assert.equal(unanswered?.[0].completed, false)
})

test("8. Fotos se asocian unicamente a su task", () => {
  const grouped = associateProjectWorkReportPhotos(
    ["cort-24", "cort-26"],
    [
      { taskId: "cort-24", description: "NAP 024", createdAt: "2026-09-04T10:00:00Z" },
      { taskId: "other-ot", description: "ajena", createdAt: "2026-09-04T11:00:00Z" },
      { taskId: "cort-26", description: "NAP 026", createdAt: "2026-09-04T12:00:00Z" },
    ]
  )
  assert.equal(grouped.get("cort-24")?.length, 1)
  assert.equal(grouped.get("cort-26")?.length, 1)
  assert.equal(grouped.get("other-ot"), undefined)
  assert.equal(grouped.get("cort-24")?.[0].description, "NAP 024")
})

test("9. Obra sin fotos genera el informe igualmente", async () => {
  const tasks = makeCortaderosTasks().slice(0, 2)
  const report = buildProjectWorkReportData({
    companyId: COMPANY_ID,
    project: cortaderosProject,
    tasks,
    photos: [],
    taskScope: "completed",
    generatedAt: "2026-09-23T21:00:00.000Z",
  })
  assert.equal(report.tasks.length, 2)
  assert.equal(report.tasks[0].photos.length, 0)
  const html = renderProjectWorkReportMarkup(report)
  assert.match(html, /Sin evidencia/)
  const pdf = await generateProjectWorkReportPdf(report)
  const header = Buffer.from(pdf).subarray(0, 5).toString("latin1")
  assert.equal(header, "%PDF-")
})

test("10. Los Cortaderos: 35 OT finalizadas", async () => {
  const extra = [
    makeTask({ id: "asig", code: "TSK-FOCORT2026-001", status: "asignada" }),
    makeTask({
      id: "pc",
      code: "TSK-FOCORT2026-002",
      status: "pendiente-cierre",
    }),
  ]
  const report = buildProjectWorkReportData({
    companyId: COMPANY_ID,
    project: cortaderosProject,
    tasks: [...makeCortaderosTasks(), ...extra],
    photos: [
      {
        taskId: "cort-24",
        description: "Cierre de manga",
        createdAt: "2026-09-04T15:30:00Z",
      },
    ],
    taskScope: "completed",
    generatedAt: "2026-09-23T21:00:00.000Z",
  })

  assert.equal(report.summary.includedCount, 35)
  assert.equal(report.summary.completedCount, 35)
  assert.equal(report.summary.activeCount, 0)
  assert.equal(report.summary.pendingClosureCount, 0)
  assert.equal(report.cover.projectName, "LOS CORTADEROS")
  assert.equal(report.cover.projectCode, "FO-CORT-2026")
  assert.equal(report.cover.client, "Zabala Emiliano · LOS POLACOS")
  assert.equal(report.cover.location, "X5147 Córdoba")
  assert.equal(report.cover.period, "03/09/2026 — 11/09/2026")
  assert.equal(report.cover.includedCountLabel, "35 OT")
  assert.equal(report.project.name, report.cover.projectName)
  assert.equal(report.project.code, report.cover.projectCode)
  assert.equal(report.workOrders.length, 35)
  assert.equal(report.workOrders, report.tasks)
  assert.equal(report.tasks[0].code, "TSK-FOCORT2026-020")
  assert.ok(report.workOrders.some((task) => task.code === "TSK-FOCORT2026-087"))
  assert.equal(
    report.tasks.find((task) => task.code === "TSK-FOCORT2026-024")?.photos.length,
    1
  )
  assert.equal(report.sections.design, false)

  const serialized = JSON.stringify(report)
  assert.doesNotMatch(serialized, new RegExp(COMPANY_ID))
  assert.doesNotMatch(serialized, new RegExp(CORTADEROS_ID))
  assert.doesNotMatch(serialized, /company_id/)
  assert.doesNotMatch(serialized, /project_id/)

  const html = renderProjectWorkReportMarkup(report)
  assert.match(html, /INFORME DE TRABAJOS REALIZADOS/)
  assert.match(html, /LOS CORTADEROS/)
  assert.match(html, /FO-CORT-2026/)
  assert.match(html, /TSK-FOCORT2026-020/)
  assert.doesNotMatch(html, new RegExp(COMPANY_ID))
  assert.doesNotMatch(html, new RegExp(CORTADEROS_ID))
  assert.doesNotMatch(html, /Cuadrilla/)
  assert.doesNotMatch(html, /Supervisor/)
  assert.doesNotMatch(html, /\bInicio\b/)
  assert.doesNotMatch(html, /\bFin\b/)
  const pdf = await generateProjectWorkReportPdf(report)
  assert.equal(Buffer.from(pdf).subarray(0, 5).toString("latin1"), "%PDF-")
  assert.equal(countProjectWorkReportPdfPages(pdf), 2 + report.workOrders.length)
})

test("arquitectura: reutiliza listado de OT de Obra y no usa fetchTasks", () => {
  const load = read("lib/projects/work-report/load-report.server.ts")
  assert.match(load, /export async function loadProjectWorkReport/)
  assert.match(load, /fetchProjectWorkOrderListTasks/)
  assert.match(load, /fetchLiveTaskPhotosForTaskIds/)
  assert.match(load, /buildProjectWorkReportData/)
  assert.doesNotMatch(load, /generateProjectWorkReportPdf|react-dom\/server|generate-pdf/)
  assert.match(load, /photoMode/)
  assert.match(load, /\.eq\("company_id", input\.companyId\)/)
  assert.doesNotMatch(load, /fetchProjectById/)
  assert.doesNotMatch(load, /fetchTasks\(/)
  assert.doesNotMatch(load, /listTasks\(/)

  const build = read("lib/projects/work-report/build-report-data.ts")
  assert.match(build, /readTrabajoRealizadoFromTask/)
  assert.doesNotMatch(build, /instalado correctamente|satisfactoriamente|conforme a normativa/)
  const view = read("components/obras/project-work-report-view.tsx")
  assert.doesNotMatch(view, /instalado correctamente|satisfactoriamente|conforme a normativa/)
  const pdfSource = read("lib/projects/work-report/generate-pdf.ts")
  assert.doesNotMatch(pdfSource, /instalado correctamente|satisfactoriamente|conforme a normativa/)
  assert.match(pdfSource, /renderProjectWorkReportHtml/)
  assert.match(pdfSource, /printHtmlToPdf/)
  assert.doesNotMatch(pdfSource, /jsPDF|writeWorkOrder|writeTaskSection|task\.fields/)
  assert.doesNotMatch(pdfSource, /from ["']react-dom\/server["']/)

  const buildPdf = read("lib/projects/work-report/build-pdf.server.ts")
  assert.match(buildPdf, /generateProjectWorkReportPdf/)
  assert.match(buildPdf, /loadProjectWorkReport/)
  assert.doesNotMatch(buildPdf, /from ["']react-dom\/server["']/)

  const printHtml = read("lib/projects/work-report/print-html.ts")
  assert.match(printHtml, /puppeteer/)
  assert.match(printHtml, /@sparticuz\/chromium|chromium/)
  assert.match(printHtml, /preferCSSPageSize/)

  const printCss = read("components/obras/project-work-report-print.css")
  assert.match(printCss, /@page/)
  assert.match(printCss, /break-before:\s*page|page-break-before:\s*always/)
  assert.match(printCss, /break-inside:\s*avoid/)

  const renderHtml = read("lib/projects/work-report/render-html.ts")
  assert.match(renderHtml, /ProjectWorkReportPrintDocument/)
  assert.match(renderHtml, /createRequire/)
  assert.doesNotMatch(renderHtml, /from ["']react-dom\/server["']/)
  assert.doesNotMatch(read("lib/projects/work-report/print-css.ts"), /from ["']@tailwindcss\/node["']/)

  const printDocument = read("lib/projects/work-report/print-document.tsx")
  assert.match(printDocument, /ProjectWorkReportView/)
  assert.match(printDocument, /variant="print"/)
  assert.doesNotMatch(printDocument, /react-dom\/server/)

  const section = read("components/obras/project-work-report-work-order-section.tsx")
  assert.match(section, /ProjectWorkReportWorkOrderSection/)
  assert.match(section, /projectWorkReportClientMeta/)
  assert.doesNotMatch(section, /Cuadrilla|Supervisor|Técnico/)
  assert.match(view, /ProjectWorkReportWorkOrderSection/)
  assert.match(view, /pwr-cover|pwr-summary|pwr-work-order/)
  assert.doesNotMatch(view, /label="Supervisor"|label="Técnico\/s"|label="Inicio"|label="Fin"/)
  assert.doesNotMatch(view, /label="Cuadrilla/)

  const route = read("app/api/projects/[projectId]/work-report/route.ts")
  assert.match(route, /getSessionUser/)
  assert.match(route, /sessionUser\.companyId/)
  assert.match(route, /parseProjectWorkReportOptions/)
  assert.match(route, /resolveProjectWorkReportDeliveryMode/)
  assert.match(route, /persistProjectWorkReportPdfForDownload/)
  assert.match(route, /buildProjectWorkReportSignedUrlPayload/)
  assert.match(route, /build-pdf\.server/)
  assert.doesNotMatch(route, /react-dom\/server/)
  assert.doesNotMatch(route, /body\.companyId|company_id/)
  assert.doesNotMatch(route, /fetchTasks\(/)

  const persist = read("lib/projects/work-report/persist-temp.ts")
  assert.match(persist, /AUTOMATIC_REPORTS_STORAGE_BUCKET/)
  assert.match(persist, /createSignedUrl/)
  assert.match(persist, /PROJECT_WORK_REPORT_SIGNED_URL_TTL_SECONDS/)
  assert.match(persist, /pruneExpiredProjectWorkReportTemps/)
  assert.doesNotMatch(persist, /task_photos/)
  assert.doesNotMatch(persist, /from\("tasks"\)/)

  const photosQuery = read("lib/supabase/task-photos.queries.ts")
  assert.match(photosQuery, /export async function fetchLiveTaskPhotosForTaskIds/)
  assert.doesNotMatch(
    read("lib/projects/work-report/load-report.server.ts"),
    /\.update\(|\.insert\(|\.delete\(/
  )

  const query = read("lib/supabase/task-photos.queries.ts")
  assert.match(query, /export async function fetchLiveTaskPhotosForTaskIds/)
  assert.match(query, /\.eq\("company_id", companyId\)/)
  assert.match(query, /\.in\("task_id", chunk\)/)
  assert.match(query, /\.is\("deleted_at", null\)/)

  const header = read("components/obras/project-detail-operational-header.tsx")
  assert.match(header, />\s*Informe\s*</)
  assert.match(header, /onExportReport/)
  assert.match(header, /<div className="mt-0.5 text-lg[\s\S]*<Skeleton/)
  assert.doesNotMatch(
    header,
    /<p className="mt-0.5 text-lg font-semibold[\s\S]*<Skeleton/
  )

  const dialog = read("components/obras/project-work-report-export-dialog.tsx")
  assert.match(dialog, /Informe de Obra/)
  assert.match(dialog, /Ver informe/)
  assert.match(dialog, /Descargar PDF/)
  assert.match(dialog, /Compartir informe/)
  assert.match(dialog, /Solo OT finalizadas/)
  assert.match(dialog, /Todas las OT/)
  assert.match(dialog, /Seleccionar OT/)
  assert.match(dialog, /Mostrar OT de despliegue/)
  assert.match(dialog, /OT seleccionadas/)
  assert.match(dialog, /DEFAULT_PROJECT_WORK_REPORT_TASK_SCOPE/)
  assert.match(dialog, /signedUrl/)
  assert.match(dialog, /bespoke-app\.online|share\.url|Copiar enlace/)
  assert.doesNotMatch(dialog, /app-abnet/)

  const origin = read("lib/projects/work-report/public-origin.ts")
  assert.match(origin, /https:\/\/bespoke-app\.online/)
  assert.match(origin, /BESPOKE_PUBLIC_REPORT_ORIGIN/)
  assert.doesNotMatch(origin, /headers\(\)|request\.headers/)
  assert.doesNotMatch(origin, /window\.location|request\.nextUrl/)

  const authRoutes = read("lib/auth/routes.ts")
  assert.match(authRoutes, /pathname === "\/informe"/)
  assert.match(authRoutes, /\/api\/informe\//)

  const migration = read("supabase/migrations/20261228000100_project_report_shares.sql")
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.project_report_shares/)
  assert.match(migration, /token_hash/)
  assert.match(migration, /password_hash/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /auth_user_company_id\(\)/)
  assert.doesNotMatch(migration, /GRANT SELECT ON TABLE public\.project_report_shares TO anon/)

  const publicPage = read("app/informe/[token]/page.tsx")
  assert.match(publicPage, /resolvePublicProjectReportShare/)
  assert.match(publicPage, /loadProjectWorkReport/)
  assert.match(publicPage, /createAdminClient/)
  assert.doesNotMatch(publicPage, /ABNet|app-abnet/)
  assert.doesNotMatch(publicPage, /generate-pdf|react-dom\/server|build-pdf\.server/)

  const informePage = read("app/(dashboard)/obras/[id]/informe/page.tsx")
  assert.match(informePage, /loadProjectWorkReport/)
  assert.doesNotMatch(informePage, /generate-pdf|react-dom\/server|build-pdf\.server/)

  const crypto = read("lib/projects/work-report/share-crypto.ts")
  assert.match(crypto, /scrypt/)
  assert.match(crypto, /aes-256-gcm/)
  assert.match(crypto, /sha256/)
  assert.doesNotMatch(crypto, /md5|sha1/i)
})

function createMemoryStorage() {
  const files = new Map()
  const signed = []
  const removed = []
  return {
    files,
    signed,
    removed,
    async upload(path, body) {
      files.set(path, Buffer.from(body))
      return { error: null }
    },
    async createSignedUrl(path, expiresIn, options) {
      signed.push({ path, expiresIn, options })
      return {
        data: {
          signedUrl: `https://storage.example/sign/${path}?exp=${expiresIn}`,
        },
        error: null,
      }
    },
    async list(folder) {
      const prefix = `${folder}/`
      const data = [...files.keys()]
        .filter((path) => path.startsWith(prefix))
        .map((path) => ({ name: path.slice(prefix.length) }))
      return { data, error: null }
    },
    async remove(paths) {
      for (const path of paths) {
        files.delete(path)
        removed.push(path)
      }
      return { error: null }
    },
  }
}

test("entrega: PDF pequeño local se puede devolver inline", () => {
  assert.equal(
    resolveProjectWorkReportDeliveryMode({ byteSize: 120_000, isVercel: false }),
    "inline"
  )
})

test("entrega: PDF grande no vuelve como body de Function", () => {
  const large = VERCEL_FUNCTION_RESPONSE_LIMIT_BYTES + 1
  assert.equal(
    resolveProjectWorkReportDeliveryMode({ byteSize: large, isVercel: false }),
    "signed-url"
  )
  assert.equal(
    resolveProjectWorkReportDeliveryMode({ byteSize: 120_000, isVercel: true }),
    "signed-url"
  )

  const payload = buildProjectWorkReportSignedUrlPayload({
    signedUrl: "https://storage.example/sign/tmp/file.pdf?token=abc",
    fileName: "informe-obra-FO-CORT-2026.pdf",
    byteSize: 10_054_840,
    expiresInSeconds: PROJECT_WORK_REPORT_SIGNED_URL_TTL_SECONDS,
    includedCount: 35,
  })
  assert.equal(payload.delivery, "signed-url")
  assert.ok(signedUrlPayloadFitsFunctionLimit(payload))
  assert.ok(
    Buffer.byteLength(JSON.stringify(payload), "utf8") <
      VERCEL_FUNCTION_RESPONSE_LIMIT_BYTES
  )
})

test("entrega: archivo temporal y signed URL con expiración y company_id", async () => {
  const storage = createMemoryStorage()
  const pdf = new Uint8Array([37, 80, 68, 70, 45])
  const fileName = "informe-obra-FO-CORT-2026.pdf"
  const generatedAtMs = 1_774_200_000_000

  const stored = await persistProjectWorkReportPdf({
    companyId: COMPANY_ID,
    projectId: CORTADEROS_ID,
    fileName,
    pdf,
    storage,
    generatedAtMs,
    uniqueId: "exp-1",
    nowMs: generatedAtMs,
  })

  assert.equal(stored.bucket, "automatic-reports")
  assert.equal(stored.expiresInSeconds, PROJECT_WORK_REPORT_SIGNED_URL_TTL_SECONDS)
  assert.equal(PROJECT_WORK_REPORT_SIGNED_URL_TTL_SECONDS, 600)
  assert.match(stored.storagePath, new RegExp(`^${PROJECT_WORK_REPORT_TEMP_PREFIX}/${COMPANY_ID}/`))
  assert.match(stored.storagePath, new RegExp(fileName.replaceAll(".", "\\.")))
  assert.ok(isWorkReportTempPathOwnedByCompany(stored.storagePath, COMPANY_ID))
  assert.equal(
    isWorkReportTempPathOwnedByCompany(stored.storagePath, OTHER_COMPANY_ID),
    false
  )
  assert.ok(storage.files.has(stored.storagePath))
  assert.equal(storage.signed[0].expiresIn, 600)
  assert.equal(storage.signed[0].options.download, fileName)
  assert.match(stored.signedUrl, /sign\//)

  const otherPath = buildProjectWorkReportTempStoragePath({
    companyId: OTHER_COMPANY_ID,
    projectId: CORTADEROS_ID,
    fileName,
    generatedAtMs,
    uniqueId: "x",
  })
  assert.equal(isWorkReportTempPathOwnedByCompany(otherPath, COMPANY_ID), false)
})

test("entrega: limpia temporales vencidos de la misma empresa", async () => {
  const storage = createMemoryStorage()
  const nowMs = 1_774_200_000_000
  const stalePath = buildProjectWorkReportTempStoragePath({
    companyId: COMPANY_ID,
    projectId: CORTADEROS_ID,
    fileName: "informe-obra-FO-CORT-2026.pdf",
    generatedAtMs: nowMs - 3 * 60 * 60 * 1000,
    uniqueId: "old",
  })
  storage.files.set(stalePath, Buffer.from("%PDF"))

  await persistProjectWorkReportPdf({
    companyId: COMPANY_ID,
    projectId: CORTADEROS_ID,
    fileName: "informe-obra-FO-CORT-2026.pdf",
    pdf: new Uint8Array([37, 80, 68, 70]),
    storage,
    generatedAtMs: nowMs,
    uniqueId: "new",
    nowMs,
  })

  assert.ok(storage.removed.includes(stalePath))
  assert.equal(
    isExpiredWorkReportTempObject({
      objectName: stalePath.split("/").at(-1),
      nowMs,
    }),
    true
  )
})

test("entrega: el PDF de Los Cortaderos conserva 35 OT y fotos", () => {
  const report = buildProjectWorkReportData({
    companyId: COMPANY_ID,
    project: cortaderosProject,
    tasks: [
      ...makeCortaderosTasks(),
      makeTask({ id: "asig", code: "TSK-LIVE", status: "asignada" }),
    ],
    photos: [
      {
        taskId: "cort-24",
        description: "Cierre de manga",
        createdAt: "2026-09-04T15:30:00Z",
      },
      {
        taskId: "foreign",
        description: "otra obra",
        createdAt: "2026-09-04T15:31:00Z",
      },
    ],
    taskScope: "completed",
    generatedAt: "2026-09-23T21:00:00.000Z",
  })

  assert.equal(report.summary.includedCount, 35)
  assert.equal(report.tasks.length, 35)
  assert.equal(
    report.tasks.find((task) => task.code === "TSK-FOCORT2026-024")?.photos.length,
    1
  )
  assert.equal(
    report.tasks.reduce((sum, task) => sum + task.photos.length, 0),
    1
  )
  assert.ok(!report.tasks.some((task) => task.code === "TSK-LIVE"))
})

test("modelo: 35 OT y 76 fotos en workOrders, sin IDs internos", () => {
  const tasks = makeCortaderosTasks()
  const photos = Array.from({ length: 76 }, (_, index) => ({
    taskId: tasks[index % tasks.length].id,
    description: `foto-${index + 1}`,
    createdAt: `2026-09-04T${String(10 + (index % 8)).padStart(2, "0")}:00:00Z`,
    signedUrl: `https://storage.example/sign/photo-${index + 1}.jpg`,
  }))
  const withChecklist = tasks.map((task, index) =>
    index === 0
      ? {
          ...task,
          supervisor: "Técnico 1",
          taskMetadata: {
            operationalChecklistTemplate: [
              {
                id: "chk-1",
                title: "Fusiono de fibras",
                fieldType: "confirmacion",
                required: true,
                sortOrder: 1,
              },
            ],
            operationalChecklistResponses: {
              "chk-1": { confirmed: true },
            },
          },
        }
      : task
  )

  const report = buildProjectWorkReportData({
    companyId: COMPANY_ID,
    project: cortaderosProject,
    tasks: withChecklist,
    photos,
    taskScope: "completed",
    generatedAt: "2026-09-23T21:00:00.000Z",
  })

  assert.equal(report.workOrders.length, 35)
  assert.equal(
    report.workOrders.reduce((sum, order) => sum + order.photos.length, 0),
    76
  )
  assert.equal(report.workOrders[0].supervisor, "Técnico 1")
  assert.equal(report.workOrders[0].technicians, null)
  assert.equal(report.workOrders[0].checklist?.[0].label, "Fusiono de fibras")
  assert.ok(report.workOrders[0].photos[0].url?.startsWith("https://"))
  const serialized = JSON.stringify(report)
  assert.doesNotMatch(serialized, new RegExp(COMPANY_ID))
  assert.doesNotMatch(serialized, new RegExp(CORTADEROS_ID))
  assert.doesNotMatch(serialized, /"id":"cort-/)
})

test("PDF y web consumen el mismo ProjectWorkReport", async () => {
  const report = buildProjectWorkReportData({
    companyId: COMPANY_ID,
    project: cortaderosProject,
    tasks: makeCortaderosTasks(),
    photos: [],
    taskScope: "completed",
    generatedAt: "2026-09-23T21:00:00.000Z",
  })
  assert.equal(report.workOrders, report.tasks)
  assert.equal(report.project.code, report.cover.projectCode)
  const html = renderProjectWorkReportMarkup(report)
  assert.match(html, /INFORME DE TRABAJOS REALIZADOS/)
  assert.match(html, /TSK-FOCORT2026-020/)
  assert.match(html, /TSK-FOCORT2026-087/)
  const pdf = await generateProjectWorkReportPdf(report)
  assert.equal(Buffer.from(pdf).subarray(0, 5).toString("latin1"), "%PDF-")
})

test("share: URL pública usa Bespoke y nunca el host del tenant", () => {
  const url = buildProjectWorkReportShareUrl("token-demo")
  assert.equal(url, "https://bespoke-app.online/informe/token-demo")
  assert.equal(getBespokePublicReportOrigin(), "https://bespoke-app.online")
  assert.equal(isTenantOperationsHost("app-abnet.com.ar"), true)
  assert.doesNotMatch(url, /app-abnet/)
  const overridden = buildProjectWorkReportShareUrl("abc", {
    BESPOKE_PUBLIC_REPORT_ORIGIN: "https://bespoke.example",
  })
  assert.equal(overridden, "https://bespoke.example/informe/abc")
  assert.equal(isAuthPublicPath("/informe/token-demo"), true)
  assert.equal(isAuthPublicPath("/api/informe/token-demo/pdf"), true)
  assert.equal(isAuthPublicPath("/api/projects/x/work-report/share"), false)
})

test("share: token aleatorio, hash y cifrado", () => {
  const tokenA = createProjectWorkReportShareToken()
  const tokenB = createProjectWorkReportShareToken()
  assert.notEqual(tokenA, tokenB)
  assert.ok(tokenA.length >= 32)
  const hash = hashProjectWorkReportShareToken(tokenA)
  assert.equal(hash.length, 64)
  assert.notEqual(hash, tokenA)
  const secret = "test-share-secret-key"
  const cipher = encryptProjectWorkReportShareToken(tokenA, secret)
  assert.notEqual(cipher, tokenA)
  assert.equal(decryptProjectWorkReportShareToken(cipher, secret), tokenA)
  assert.equal(decryptProjectWorkReportShareToken(cipher, "other"), null)
})

test("share: password scrypt, no se puede revertir", async () => {
  const hash = await hashProjectWorkReportSharePassword("ABC123")
  assert.match(hash, /^scrypt\$/)
  assert.doesNotMatch(hash, /ABC123/)
  assert.equal(await verifyProjectWorkReportSharePassword("ABC123", hash), true)
  assert.equal(await verifyProjectWorkReportSharePassword("wrong", hash), false)
  assert.equal(await verifyProjectWorkReportSharePassword("ABC123", null), false)
})

test("share: aislamiento, revocación y expiración", () => {
  const share = {
    companyId: COMPANY_ID,
    projectId: CORTADEROS_ID,
    revokedAt: null,
    expiresAt: null,
  }
  assert.equal(evaluateProjectWorkReportShareAccess(null).ok, false)
  assert.equal(evaluateProjectWorkReportShareAccess(null).reason, "not_found")
  assert.equal(evaluateProjectWorkReportShareAccess(share).ok, true)
  assert.equal(
    shareBelongsToCompanyProject(share, COMPANY_ID, CORTADEROS_ID),
    true
  )
  assert.equal(
    shareBelongsToCompanyProject(share, OTHER_COMPANY_ID, CORTADEROS_ID),
    false
  )
  assert.equal(
    shareBelongsToCompanyProject(share, COMPANY_ID, OTHER_PROJECT_ID),
    false
  )
  assert.equal(
    evaluateProjectWorkReportShareAccess({
      ...share,
      revokedAt: "2026-09-23T21:00:00.000Z",
    }).reason,
    "revoked"
  )
  assert.equal(
    evaluateProjectWorkReportShareAccess(
      {
        ...share,
        expiresAt: "2026-09-01T00:00:00.000Z",
      },
      new Date("2026-09-23T21:00:00.000Z")
    ).reason,
    "expired"
  )
  assert.equal(
    evaluateProjectWorkReportShareAccess(
      {
        ...share,
        expiresAt: resolveProjectWorkReportShareExpiresAt(
          "7",
          new Date("2026-09-23T00:00:00.000Z")
        ),
      },
      new Date("2026-09-24T00:00:00.000Z")
    ).ok,
    true
  )
})

test("share: sesión firmada y denegación por token inválido", () => {
  const secret = "session-secret"
  const payload = {
    sid: "share-1",
    th: hashProjectWorkReportShareToken("plain-token"),
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  const cookie = signProjectWorkReportShareSession(payload, secret)
  const verified = verifyProjectWorkReportShareSession(cookie, secret)
  assert.ok(verified)
  assert.equal(verified.sid, "share-1")
  assert.equal(
    sessionMatchesShare(verified, {
      id: "share-1",
      tokenHash: payload.th,
    }),
    true
  )
  assert.equal(
    sessionMatchesShare(verified, {
      id: "share-other",
      tokenHash: payload.th,
    }),
    false
  )
  assert.equal(
    verifyProjectWorkReportShareSession(`${cookie}tamper`, secret),
    null
  )
  assert.equal(verifyProjectWorkReportShareSession(cookie, "other-secret"), null)
  const expired = signProjectWorkReportShareSession(
    { ...payload, exp: Math.floor(Date.now() / 1000) - 10 },
    secret
  )
  assert.equal(verifyProjectWorkReportShareSession(expired, secret), null)
})

test("hidratación: el KPI no envuelve Skeleton en un p", () => {
  const header = read("components/obras/project-detail-operational-header.tsx")
  assert.match(header, /<div className="mt-0.5 text-lg[\s\S]*<Skeleton/)
  assert.doesNotMatch(
    header,
    /<p className="mt-0.5 text-lg font-semibold[\s\S]*<Skeleton/
  )
  assert.doesNotMatch(header, /<p>\s*<Skeleton/)
})

test("Todas las OT y Finalizadas excluyen DESPLIEGUE", () => {
  const tasks = [
    makeTask({ id: "nap", code: "TSK-NAP", title: "NAP 001", status: "finalizada", dueDate: "2026-09-03" }),
    makeTask({
      id: "dep-1",
      code: "TSK-DEP-1",
      title: "DESPLIEGUE 1",
      status: "finalizada",
    }),
    makeTask({
      id: "dep-2",
      code: "TSK-DEP-2",
      title: "Despliegue 2",
      status: "asignada",
    }),
    makeTask({ id: "live", code: "TSK-LIVE", title: "NAP 002", status: "asignada", dueDate: "2026-09-04" }),
  ]
  assert.equal(isProjectWorkReportDeploymentTask(tasks[1]), true)
  assert.equal(isProjectWorkReportDeploymentTask(tasks[2]), true)
  assert.equal(isProjectWorkReportDeploymentTask(tasks[0]), false)

  const all = selectProjectWorkReportTasks(tasks, COMPANY_ID, CORTADEROS_ID, "all")
  assert.deepEqual(
    all.map((task) => task.code),
    ["TSK-NAP", "TSK-LIVE"]
  )
  const completed = selectProjectWorkReportTasks(
    tasks,
    COMPANY_ID,
    CORTADEROS_ID,
    "completed"
  )
  assert.deepEqual(
    completed.map((task) => task.code),
    ["TSK-NAP"]
  )
  assert.equal(filterProjectWorkReportTasksByScope(tasks, "all").length, 2)
  assert.equal(filterProjectWorkReportTasksByScope(tasks, "completed").length, 1)
})

test("selección manual incluye solo las OT elegidas y no mezcla", () => {
  const nap = makeTask({
    id: "nap",
    code: "TSK-NAP",
    title: "NAP 001",
    description: "Se fusionó al splitter 1x16",
  })
  const other = makeTask({
    id: "other",
    code: "TSK-OTHER",
    title: "NAP 002",
    description: "No debe aparecer",
  })
  const deployment = makeTask({
    id: "dep-1",
    code: "TSK-DEP-1",
    title: "DESPLIEGUE 1",
  })
  const defaultIds = defaultProjectWorkReportSelectedTaskIds([
    nap,
    other,
    deployment,
  ])
  assert.deepEqual(defaultIds.sort(), ["nap", "other"])
  assert.ok(!defaultIds.includes("dep-1"))

  const report = buildProjectWorkReportData({
    companyId: COMPANY_ID,
    project: cortaderosProject,
    tasks: [nap, other, deployment],
    photos: [
      { taskId: "nap", description: "foto nap", createdAt: "2026-09-04T10:00:00Z" },
      { taskId: "other", description: "foto otra", createdAt: "2026-09-04T11:00:00Z" },
      { taskId: "dep-1", description: "foto despliegue", createdAt: "2026-09-04T12:00:00Z" },
    ],
    taskScope: "selected",
    selectedTaskIds: ["nap"],
    generatedAt: "2026-09-23T21:00:00.000Z",
  })

  assert.equal(report.workOrders.length, 1)
  assert.equal(report.workOrders[0].code, "TSK-NAP")
  assert.equal(report.workOrders[0].description, "Se fusionó al splitter 1x16")
  assert.equal(report.workOrders[0].photos.length, 1)
  assert.equal(report.workOrders[0].photos[0].description, "foto nap")
  assert.ok(!report.workOrders.some((order) => order.code === "TSK-DEP-1"))
  assert.ok(!report.workOrders.some((order) => order.code === "TSK-OTHER"))

  const withDeployment = buildProjectWorkReportData({
    companyId: COMPANY_ID,
    project: cortaderosProject,
    tasks: [nap, other, deployment],
    taskScope: "selected",
    selectedTaskIds: ["dep-1"],
    generatedAt: "2026-09-23T21:00:00.000Z",
  })
  assert.equal(withDeployment.workOrders.length, 1)
  assert.equal(withDeployment.workOrders[0].code, "TSK-DEP-1")

  const parsed = parseProjectWorkReportOptions({
    taskScope: "selected",
    selectedTaskIds: ["nap"],
  })
  assert.ok(parsed)
  const web = buildProjectWorkReportData({
    companyId: COMPANY_ID,
    project: cortaderosProject,
    tasks: [nap, other, deployment],
    taskScope: parsed.taskScope,
    selectedTaskIds: parsed.selectedTaskIds,
    generatedAt: "2026-09-23T21:00:00.000Z",
  })
  const html = renderProjectWorkReportMarkup(web)
  assert.equal(web.workOrders.map((order) => order.code).join(","), "TSK-NAP")
  assert.match(html, /TSK-NAP/)
  assert.doesNotMatch(html, /TSK-OTHER/)
  assert.doesNotMatch(html, /TSK-DEP-1/)
  assert.doesNotMatch(html, /No debe aparecer/)
})

test("PDF replica la OT de la web: salto de página y contenido de cliente", async () => {
  const first = makeTask({
    id: "ot-018",
    code: "TSK-FOCORT2026-018",
    title: "NAP 018",
    supervisor: "No imprimir supervisor",
    crew: "Cuadrilla FO",
    completedAt: "2026-09-04T18:00:00Z",
  })
  const second = makeTask({
    id: "ot-020",
    code: "TSK-FOCORT2026-020",
    title: "NAP 020",
    dueDate: "2026-09-05",
  })
  const photos = Array.from({ length: 12 }, (_, index) => ({
    taskId: "ot-018",
    description: `Checklist: ${CORTADEROS_ID} · 04/09/2026 15:30`,
    createdAt: `2026-09-04T${String(10 + (index % 8)).padStart(2, "0")}:00:00Z`,
  }))

  const both = buildProjectWorkReportData({
    companyId: COMPANY_ID,
    project: cortaderosProject,
    tasks: [first, second],
    photos,
    taskScope: "completed",
    generatedAt: "2026-09-23T21:00:00.000Z",
  })

  assert.deepEqual(
    both.workOrders.map((order) => order.code),
    ["TSK-FOCORT2026-018", "TSK-FOCORT2026-020"]
  )
  assert.equal(both.workOrders[0].photos.length, 12)
  assert.equal(both.workOrders[1].photos.length, 0)
  assert.deepEqual(projectWorkReportClientMeta(both.workOrders[0]).map((item) => item.label), [
    "Estado",
    "Fecha",
    "Tipo de trabajo",
  ])
  assert.equal(
    isProjectWorkReportTechnicalCaption(both.workOrders[0].photos[0].description),
    true
  )

  const html = renderProjectWorkReportMarkup(both)
  assert.match(html, /pwr-work-order/)
  assert.match(html, /TSK-FOCORT2026-018/)
  assert.match(html, /TSK-FOCORT2026-020/)
  assert.match(html, /Fecha/)
  assert.doesNotMatch(html, /Cuadrilla/)
  assert.doesNotMatch(html, /Supervisor/)
  assert.doesNotMatch(html, /No imprimir supervisor/)
  assert.doesNotMatch(html, /\bInicio\b/)
  assert.doesNotMatch(html, /\bFin\b/)
  assert.doesNotMatch(html, new RegExp(CORTADEROS_ID))
  assert.doesNotMatch(html, /Checklist: /)
  assert.doesNotMatch(html, /04\/09\/2026 15:30/)

  const pdfBoth = await generateProjectWorkReportPdf(both)
  const pagesBoth = countProjectWorkReportPdfPages(pdfBoth)
  assert.ok(pagesBoth >= 2 + both.workOrders.length)
  assert.equal(Buffer.from(pdfBoth).subarray(0, 5).toString("latin1"), "%PDF-")
})


