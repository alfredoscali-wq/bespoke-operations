import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { deriveConsultationStatusFromResultado } from "../lib/customer-atenciones/consultation.ts"
import {
  formatCustomerAtencionNextStepLabel,
  formatCustomerAtencionStatusLabel,
} from "../lib/customer-atenciones/format.ts"
import {
  computeSharedInboxKpis,
  filterSharedInboxRows,
  isConsultationResolvedToday,
  mapSharedInboxKpiToStatusFilter,
  sortSharedInboxRows,
} from "../lib/customer-atenciones/shared-inbox.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const modulePath = join(
  __dirname,
  "../components/atencion-cliente/atencion-cliente-module.tsx"
)
const inboxCardPath = join(
  __dirname,
  "../components/atencion-cliente/consultation-inbox-section.tsx"
)
const queriesPath = join(
  __dirname,
  "../lib/supabase/customer-atenciones.queries.ts"
)

const referenceDate = new Date("2026-07-12T15:00:00.000Z")

function row(overrides) {
  return {
    customerId: "customer-1",
    customerName: "Juan Pérez",
    channel: "whatsapp",
    motivo: "facturacion",
    detail: "No recibió cupón de pago",
    status: "nueva",
    nextStep: null,
    attendedByEmployeeId: "employee-1",
    attendedByEmployeeName: "Cintia",
    activeManagementEmployeeId: null,
    activeManagementEmployeeName: null,
    activeManagementStartedAt: null,
    createdAt: "2026-07-12T10:32:00.000Z",
    updatedAt: "2026-07-12T10:32:00.000Z",
    ...overrides,
  }
}

const sampleRows = [
  row({ id: "1", status: "nueva", attendedByEmployeeId: "employee-1" }),
  row({
    id: "2",
    status: "para_resolver",
    nextStep: "realizar_retencion",
    attendedByEmployeeId: "employee-2",
    attendedByEmployeeName: "María",
    createdAt: "2026-07-11T09:00:00.000Z",
    updatedAt: "2026-07-11T09:00:00.000Z",
  }),
  row({
    id: "3",
    status: "en_gestion",
    nextStep: "derivar_admin_facturacion",
    attendedByEmployeeId: "employee-1",
    activeManagementEmployeeId: "employee-3",
    activeManagementEmployeeName: "Pedro",
    activeManagementStartedAt: "2026-07-12T11:00:00.000Z",
  }),
  row({
    id: "4",
    status: "pendiente",
    nextStep: "esperar_cliente",
    attendedByEmployeeId: "employee-2",
    attendedByEmployeeName: "María",
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:00:00.000Z",
  }),
  row({
    id: "5",
    status: "resuelta",
    attendedByEmployeeId: "employee-1",
    updatedAt: "2026-07-12T14:00:00.000Z",
  }),
  row({
    id: "6",
    status: "resuelta",
    attendedByEmployeeId: "employee-2",
    attendedByEmployeeName: "María",
    createdAt: "2026-07-11T10:00:00.000Z",
    updatedAt: "2026-07-11T14:00:00.000Z",
  }),
]

test("1. KPI Consultas Recibidas Hoy cuenta todas las creadas hoy", () => {
  // ids 1, 3 y 5 (resuelta) fueron creadas hoy; 2/4/6 no
  assert.equal(computeSharedInboxKpis(sampleRows, referenceDate).nuevas, 3)
})

test("2. KPI Para resolver cuenta trabajo interno pendiente", () => {
  assert.equal(computeSharedInboxKpis(sampleRows, referenceDate).para_resolver, 2)
})

test("3. KPI Pendientes cuenta espera de actor externo", () => {
  assert.equal(computeSharedInboxKpis(sampleRows, referenceDate).pendientes, 1)
})

test("4. KPI Resueltas hoy cuenta resuelta del día", () => {
  assert.equal(computeSharedInboxKpis(sampleRows, referenceDate).resueltas_hoy, 1)
})

test("5. Resueltas anteriores no cuentan en Resueltas hoy", () => {
  const onlyOld = sampleRows.filter((item) => item.id === "6")
  assert.equal(computeSharedInboxKpis(onlyOld, referenceDate).resueltas_hoy, 0)
})

test("6. en_gestion con próximo paso interno cuenta en Para resolver", () => {
  const kpis = computeSharedInboxKpis(sampleRows, referenceDate)
  assert.equal(kpis.para_resolver, 2)
  assert.equal(
    sampleRows.filter((item) => item.status === "en_gestion").length,
    1
  )
})

test("7. KPIs no filtran por attended_by_employee_id", () => {
  const employeeOneOnly = sampleRows.filter(
    (item) => item.attendedByEmployeeId === "employee-1"
  )
  const employeeTwoOnly = sampleRows.filter(
    (item) => item.attendedByEmployeeId === "employee-2"
  )

  assert.notEqual(employeeOneOnly.length, sampleRows.length)
  assert.notEqual(employeeTwoOnly.length, sampleRows.length)
  assert.equal(computeSharedInboxKpis(sampleRows, referenceDate).nuevas, 3)
  assert.equal(computeSharedInboxKpis(employeeOneOnly, referenceDate).nuevas, 3)
})

test("8. Bandeja contiene Consultas de distintos empleados", () => {
  const employeeIds = new Set(
    sampleRows.map((item) => item.attendedByEmployeeId)
  )
  assert.ok(employeeIds.size >= 2)
})

test("9. filtro Todas", () => {
  assert.equal(
    filterSharedInboxRows(sampleRows, {
      statusFilter: "all",
      motivo: "all",
      channel: "all",
    }).length,
    sampleRows.length
  )
})

test("10. filtro Ingresadas (creadas en el día de referencia)", () => {
  const filtered = filterSharedInboxRows(sampleRows, {
    statusFilter: "nueva",
    motivo: "all",
    channel: "all",
  }, referenceDate)
  assert.equal(filtered.length, 3)
  assert.ok(filtered.every((item) => item.createdAt.startsWith("2026-07-12")))
})

test("11. filtro Para resolver", () => {
  const filtered = filterSharedInboxRows(sampleRows, {
    statusFilter: "para_resolver",
    motivo: "all",
    channel: "all",
  }, referenceDate)
  assert.equal(filtered.length, 2)
  assert.ok(
    filtered.every(
      (item) =>
        item.nextStep === "realizar_retencion" ||
        item.nextStep === "derivar_admin_facturacion"
    )
  )
})

test("12. filtro En gestión", () => {
  const filtered = filterSharedInboxRows(sampleRows, {
    statusFilter: "en_gestion",
    motivo: "all",
    channel: "all",
  })
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0]?.status, "en_gestion")
})

test("13. filtro Pendientes", () => {
  const filtered = filterSharedInboxRows(sampleRows, {
    statusFilter: "pendiente",
    motivo: "all",
    channel: "all",
  }, referenceDate)
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0]?.nextStep, "esperar_cliente")
})

test("14. filtro Resueltas", () => {
  const filtered = filterSharedInboxRows(sampleRows, {
    statusFilter: "resuelta",
    motivo: "all",
    channel: "all",
  })
  assert.equal(filtered.length, 2)
})

test("15. orden activas más antiguas primero", () => {
  const active = sortSharedInboxRows(
    sampleRows.filter((item) => item.status !== "resuelta"),
    "pendiente"
  )
  assert.equal(active[0]?.id, "4")
})

test("16. orden resueltas más recientes primero", () => {
  const resolved = sortSharedInboxRows(
    sampleRows.filter((item) => item.status === "resuelta"),
    "resuelta"
  )
  assert.equal(resolved[0]?.id, "5")
  assert.equal(resolved[1]?.id, "6")
})

test("17. muestra cliente", () => {
  assert.equal(sampleRows[0]?.customerName, "Juan Pérez")
})

test("18. muestra empleado creador", () => {
  assert.equal(sampleRows[0]?.attendedByEmployeeName, "Cintia")
})

test("19. muestra canal", () => {
  assert.equal(sampleRows[0]?.channel, "whatsapp")
})

test("20. muestra motivo", () => {
  assert.equal(sampleRows[0]?.motivo, "facturacion")
})

test("21. muestra próximo paso", () => {
  const withStep = row({
    id: "7",
    nextStep: "derivar_admin_facturacion",
  })
  assert.equal(
    formatCustomerAtencionNextStepLabel(withStep.nextStep),
    "Derivar Administración - Facturación"
  )
})

test("22. muestra gestión activa", () => {
  const managed = sampleRows.find((item) => item.status === "en_gestion")
  assert.equal(managed?.activeManagementEmployeeName, "Pedro")
  assert.ok(managed?.activeManagementStartedAt)
})

test("23. navegación a detalle", () => {
  const inboxSource = readFileSync(inboxCardPath, "utf8")
  assert.match(inboxSource, /href=\{`\/atencion-cliente\/\$\{item\.id\}`\}/)
})

test("24. creación actual resuelta actualiza Bandeja", () => {
  assert.equal(deriveConsultationStatusFromResultado("resuelta"), "resuelta")
  const created = row({
    id: "8",
    status: deriveConsultationStatusFromResultado("resuelta"),
    updatedAt: "2026-07-12T16:00:00.000Z",
  })
  assert.equal(
    isConsultationResolvedToday(created, referenceDate),
    true
  )
})

test("25. creación con seguimiento actualiza Bandeja", () => {
  assert.equal(
    deriveConsultationStatusFromResultado("requiere_seguimiento"),
    "pendiente"
  )
  const created = row({
    id: "9",
    status: deriveConsultationStatusFromResultado("requiere_seguimiento"),
    nextStep: "esperar_cliente",
  })
  const filtered = filterSharedInboxRows(
    [...sampleRows, created],
    {
      statusFilter: "pendiente",
      motivo: "all",
      channel: "all",
    },
    referenceDate
  )
  assert.equal(filtered.length, 2)
})

test("26. componentes legacy siguen existiendo fuera de la vista principal", () => {
  const agendaPath = join(
    __dirname,
    "../components/atencion-cliente/mi-agenda-section.tsx"
  )
  const jornadaPath = join(
    __dirname,
    "../components/atencion-cliente/mi-jornada-section.tsx"
  )
  assert.match(readFileSync(agendaPath, "utf8"), /MiAgendaSection/)
  assert.match(readFileSync(jornadaPath, "utf8"), /MiJornadaSection/)
})

test("27. Mi Jornada permanece como componente legacy", () => {
  const source = readFileSync(
    join(__dirname, "../components/atencion-cliente/mi-jornada-section.tsx"),
    "utf8"
  )
  assert.match(source, /MiJornadaSection/)
  assert.doesNotMatch(readFileSync(modulePath, "utf8"), /MiJornadaSection/)
})

test("28. Retenciones permanecen como componentes legacy", () => {
  const retencionesPath = join(
    __dirname,
    "../components/atencion-cliente/mis-retenciones-section.tsx"
  )
  const dialogPath = join(
    __dirname,
    "../components/atencion-cliente/retencion-create-dialog.tsx"
  )
  assert.match(readFileSync(retencionesPath, "utf8"), /MisRetencionesSection/)
  assert.match(readFileSync(dialogPath, "utf8"), /RetencionCreateDialog/)
  assert.doesNotMatch(readFileSync(modulePath, "utf8"), /MisRetencionesSection/)
})

test("29. Recuperaciones permanecen como componentes legacy", () => {
  const recuperoPath = join(
    __dirname,
    "../components/atencion-cliente/mi-recupero-section.tsx"
  )
  const dialogPath = join(
    __dirname,
    "../components/atencion-cliente/recupero-form-dialog.tsx"
  )
  assert.match(readFileSync(recuperoPath, "utf8"), /MiRecuperoSection/)
  assert.match(readFileSync(dialogPath, "utf8"), /RecuperoFormDialog/)
  assert.doesNotMatch(readFileSync(modulePath, "utf8"), /MiRecuperoSection/)
})

test("30. KPIs compartidos priorizan la bandeja en la vista principal", () => {
  const source = readFileSync(modulePath, "utf8")
  assert.match(source, /ConsultationInboxSummary/)
  assert.match(source, /ConsultationInboxSection/)
  assert.doesNotMatch(source, /AtencionClienteSummary/)
  assert.doesNotMatch(source, /Mi actividad/)
  const summaryIndex = source.indexOf("<ConsultationInboxSummary")
  const sectionIndex = source.indexOf("<ConsultationInboxSection")
  assert.ok(summaryIndex >= 0)
  assert.ok(sectionIndex >= 0)
  assert.ok(summaryIndex < sectionIndex)
})

test("mapSharedInboxKpiToStatusFilter enlaza KPIs clicables", () => {
  assert.equal(mapSharedInboxKpiToStatusFilter("nuevas"), "nueva")
  assert.equal(mapSharedInboxKpiToStatusFilter("resueltas_hoy"), "resueltas_hoy")
  assert.equal(mapSharedInboxKpiToStatusFilter("none"), "all")
})

test("labels de estado y próximo paso centralizados", () => {
  assert.equal(formatCustomerAtencionStatusLabel("pendiente"), "Pendiente")
  assert.equal(
    formatCustomerAtencionNextStepLabel("derivar_admin_gestion"),
    "Derivar Administración - Gestión administrativa"
  )
})

test("31. KPIs de bandeja usan conteos company-wide en la base de datos", () => {
  const queriesSource = readFileSync(queriesPath, "utf8")

  assert.match(queriesSource, /fetchSharedInboxKpiSummaryFromDb/)
  assert.match(queriesSource, /fetchSharedInboxResolvedTodayCount/)
  assert.match(queriesSource, /fetchSharedInboxActiveNextStepCount/)
  assert.match(queriesSource, /fetchSharedInboxNuevasKpiCount/)
  assert.doesNotMatch(
    queriesSource,
    /kpis: computeSharedInboxKpis\(sourceResult\.data/
  )
})

test("32. Bandeja carga consultas activas y resueltas recientes por separado", () => {
  const queriesSource = readFileSync(queriesPath, "utf8")

  assert.match(queriesSource, /SHARED_INBOX_ACTIVE_STATUSES/)
  assert.match(queriesSource, /\.in\("status", SHARED_INBOX_ACTIVE_STATUSES\)/)
  assert.match(queriesSource, /\.eq\("status", "resuelta"\)/)
  assert.match(
    queriesSource,
    /\.order\("updated_at", \{ ascending: false \}\)/
  )
})
