import assert from "node:assert/strict"
import test from "node:test"

import {
  computeLatestManagementAtByAtencionId,
  formatConsultationInboxDateTime,
  resolveConsultationLastManagementAt,
} from "../lib/customer-atenciones/format.ts"

/** Local wall-clock → ISO so formatter assertions are timezone-stable. */
function localIso(year, month, day, hour, minute) {
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString()
}

/** Same pipeline as inbox row: aggregate sources → resolve Última Gestión. */
function inboxDateColumns({ atencionId, createdAt, seguimientos = [], events = [] }) {
  const latestById = computeLatestManagementAtByAtencionId({
    seguimientos,
    events,
  })
  const lastSeguimientoAt = latestById.get(atencionId) ?? null
  const ultimaGestion = resolveConsultationLastManagementAt({
    createdAt,
    lastSeguimientoAt,
  })

  return {
    creada: createdAt,
    ultimaGestion,
    creadaLabel: formatConsultationInboxDateTime(createdAt),
    ultimaGestionLabel: formatConsultationInboxDateTime(ultimaGestion),
  }
}

test("1. consulta recién creada sin seguimientos: Creada == Última Gestión", () => {
  const atencionId = "aten-new"
  const createdAt = localIso(2026, 7, 25, 9, 0)

  const columns = inboxDateColumns({
    atencionId,
    createdAt,
    seguimientos: [],
    events: [
      {
        customer_atencion_id: atencionId,
        created_at: createdAt,
        action_type: "consulta_creada",
      },
    ],
  })

  assert.equal(columns.ultimaGestion, columns.creada)
  assert.equal(columns.ultimaGestionLabel, columns.creadaLabel)
})

test("2. consulta con seguimientos: Última Gestión = seguimiento más reciente", () => {
  const atencionId = "aten-seg"
  const createdAt = localIso(2026, 7, 20, 10, 0)
  const olderSeguimiento = localIso(2026, 7, 22, 11, 0)
  const latestSeguimiento = localIso(2026, 7, 25, 16, 45)

  const columns = inboxDateColumns({
    atencionId,
    createdAt,
    seguimientos: [
      {
        source_atencion_id: atencionId,
        created_at: olderSeguimiento,
      },
      {
        source_atencion_id: atencionId,
        created_at: latestSeguimiento,
      },
    ],
  })

  assert.equal(columns.ultimaGestion, latestSeguimiento)
  assert.notEqual(columns.ultimaGestion, columns.creada)
  assert.equal(columns.ultimaGestionLabel, "25/07/2026 16:45")
  assert.equal(columns.creadaLabel, "20/07/2026 10:00")
})

test("3. solo customer_atencion_events: Última Gestión = último evento ≠ creación", () => {
  const atencionId = "aten-events"
  const createdAt = localIso(2026, 7, 21, 8, 30)
  const gestionIniciada = localIso(2026, 7, 21, 9, 0)
  const ultimoEvento = localIso(2026, 7, 24, 18, 12)

  const columns = inboxDateColumns({
    atencionId,
    createdAt,
    events: [
      {
        customer_atencion_id: atencionId,
        created_at: createdAt,
        action_type: "consulta_creada",
      },
      {
        customer_atencion_id: atencionId,
        created_at: gestionIniciada,
        action_type: "gestion_iniciada",
      },
      {
        customer_atencion_id: atencionId,
        created_at: ultimoEvento,
        action_type: "gestion_registrada",
      },
    ],
  })

  assert.equal(columns.ultimaGestion, ultimoEvento)
  assert.notEqual(columns.ultimaGestion, columns.creada)
  assert.equal(columns.ultimaGestionLabel, "24/07/2026 18:12")
})

test("4. Técnica → Atención → resuelta: Última Gestión = última acción del expediente", () => {
  const atencionId = "aten-flow"
  const createdAt = localIso(2026, 7, 20, 9, 0)
  const derivacionTecnica = localIso(2026, 7, 20, 10, 15)
  const devolucionAtencion = localIso(2026, 7, 22, 14, 20)
  const resolucion = localIso(2026, 7, 25, 11, 5)

  const columns = inboxDateColumns({
    atencionId,
    createdAt,
    // Devolución a Atención puede registrar seguimiento; la resolución es el último evento.
    seguimientos: [
      {
        source_atencion_id: atencionId,
        created_at: devolucionAtencion,
      },
    ],
    events: [
      {
        customer_atencion_id: atencionId,
        created_at: createdAt,
        action_type: "consulta_creada",
      },
      {
        customer_atencion_id: atencionId,
        created_at: derivacionTecnica,
        action_type: "proximo_paso_cambiado",
      },
      {
        customer_atencion_id: atencionId,
        created_at: devolucionAtencion,
        action_type: "consulta_pendiente",
      },
      {
        customer_atencion_id: atencionId,
        created_at: resolucion,
        action_type: "consulta_resuelta",
      },
    ],
  })

  assert.equal(columns.ultimaGestion, resolucion)
  assert.notEqual(columns.ultimaGestion, columns.creada)
  assert.notEqual(columns.ultimaGestion, derivacionTecnica)
  assert.notEqual(columns.ultimaGestion, devolucionAtencion)
  assert.equal(columns.ultimaGestionLabel, "25/07/2026 11:05")
  assert.equal(columns.creadaLabel, "20/07/2026 09:00")
})

test("formato inbox es dd/MM/yyyy HH:mm en una sola línea", () => {
  const formatted = formatConsultationInboxDateTime(localIso(2026, 7, 25, 14, 38))
  assert.equal(formatted, "25/07/2026 14:38")
  assert.match(formatted, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
  assert.doesNotMatch(formatted, /Hace/)
  assert.doesNotMatch(formatted, /\n/)
})
