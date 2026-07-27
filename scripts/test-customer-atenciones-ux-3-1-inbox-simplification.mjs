/**
 * Atención UX 3.1 — bandeja as work tray result (no status chips).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { resolveConsultationInboxHeading } from "../lib/customer-atenciones/consultation-inbox-heading.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const inboxPath = join(
  __dirname,
  "../components/atencion-cliente/consultation-inbox-section.tsx"
)
const headingPath = join(
  __dirname,
  "../lib/customer-atenciones/consultation-inbox-heading.ts"
)

const baseQuery = {
  statusFilter: "all",
  motivo: "all",
  channel: "all",
  operationalCategory: null,
  workTray: null,
  createdDate: null,
  search: "",
}

test("UX 3.1: bandeja no renderiza chips de estado", () => {
  const source = readFileSync(inboxPath, "utf8")
  assert.doesNotMatch(source, /STATUS_FILTER_OPTIONS/)
  assert.doesNotMatch(source, /sharedInboxStatusFilterCounts/)
  assert.doesNotMatch(source, />Pendientes</)
  assert.doesNotMatch(source, />Para resolver</)
  assert.doesNotMatch(source, />Resueltas hoy</)
  assert.match(source, /Fecha/)
  assert.match(source, /Motivo/)
  assert.match(source, /Canal/)
})

test("UX 3.1: encabezado dinámico por cola operativa sin contador ambiguo", () => {
  assert.deepEqual(resolveConsultationInboxHeading(baseQuery), {
    title: "Todas las consultas",
    subtitle: "Resultado de la selección actual",
  })

  assert.deepEqual(
    resolveConsultationInboxHeading({
      ...baseQuery,
      workTray: "administracion",
    }),
    {
      title: "Administración",
      subtitle: "Consultas pendientes de esta cola",
    }
  )

  assert.deepEqual(
    resolveConsultationInboxHeading({ ...baseQuery, workTray: "tecnica" }),
    {
      title: "Técnica",
      subtitle: "Consultas pendientes de esta cola",
    }
  )

  assert.deepEqual(
    resolveConsultationInboxHeading({
      ...baseQuery,
      workTray: "espera_cliente",
    }),
    {
      title: "Esperando respuesta del cliente",
      subtitle: "Consultas pendientes de esta cola",
    }
  )

  assert.deepEqual(
    resolveConsultationInboxHeading({ ...baseQuery, workTray: "morosos" }),
    {
      title: "Facturación - Morosos",
      subtitle: "Consultas pendientes de esta cola",
    }
  )

  assert.deepEqual(
    resolveConsultationInboxHeading({
      ...baseQuery,
      workTray: "retenciones",
    }),
    {
      title: "Retenciones",
      subtitle: "Consultas pendientes de esta cola",
    }
  )

  assert.deepEqual(
    resolveConsultationInboxHeading({ ...baseQuery, workTray: "por_tomar" }),
    {
      title: "Para Resolver",
      subtitle: "Consultas pendientes de esta cola",
    }
  )
})

test("UX 3.1 §8: subtítulo no incluye contadores numéricos", () => {
  const headingSource = readFileSync(headingPath, "utf8")
  assert.doesNotMatch(headingSource, /toLocaleString/)
  assert.doesNotMatch(headingSource, /rowCount/)
  assert.doesNotMatch(headingSource, /\$\{countLabel\}/)

  for (const heading of [
    resolveConsultationInboxHeading(baseQuery),
    resolveConsultationInboxHeading({
      ...baseQuery,
      workTray: "administracion",
    }),
    resolveConsultationInboxHeading({
      ...baseQuery,
      statusFilter: "resueltas_hoy",
    }),
  ]) {
    assert.doesNotMatch(heading.subtitle, /\d/)
  }
})
