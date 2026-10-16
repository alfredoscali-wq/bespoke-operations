import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import test from "node:test"

import { insertWhatsappCommercialRequest } from "../lib/supabase/whatsapp-commercial-requests.queries.ts"
import {
  buildWhatsappCommercialRequest,
  normalizeWhatsappOriginPhone,
} from "../lib/subscriptions/whatsapp-commercial-requests.ts"
import { whatsappOptOutKey, whatsappSlotKey } from "../lib/integrations/whatsapp/message-ledger.ts"

const root = resolve(import.meta.dirname, "..")
const COMPANY_A = "11111111-1111-4111-8111-111111111111"
const COMPANY_B = "22222222-2222-4222-8222-222222222222"
const OPEN_STATUSES = ["pending", "in_review", "approved"]

function read(path) {
  return readFileSync(resolve(root, path), "utf8")
}

function indexStatement() {
  const sql = read("supabase/migrations/20270110160000_tv_whatsapp_open_offer_uidx.sql")
  const start = sql.indexOf("CREATE UNIQUE INDEX")
  assert.ok(start > 0)
  return sql.slice(start).trim()
}

test("el índice pendiente cubre solo las solicitudes abiertas y la clave esperada", () => {
  const statement = indexStatement()
  assert.match(
    statement,
    /ON public\.tv_whatsapp_commercial_requests \(company_id, origin_phone, offer\)/
  )
  assert.match(statement, /WHERE status IN \('pending', 'in_review', 'approved'\)/)
  assert.doesNotMatch(statement, /completed|rejected|basica/)
})

test("el teléfono y la oferta guardados coinciden con la clave del índice", () => {
  const now = "2026-10-14T18:00:00.000Z"
  const built = buildWhatsappCommercialRequest({
    id: randomUUID(),
    companyId: COMPANY_A,
    originPhone: "351 000-1111",
    offer: "pack",
    matches: [],
    phoneVerified: false,
    quote: null,
    service: null,
    customerAccepted: true,
    customerAcceptedAt: now,
    now,
  })
  assert.equal(built.ok, true)
  assert.equal(built.request.originPhone, "5493510001111")
  assert.equal(built.request.offer, "pack")
  assert.equal(built.request.status, "pending")
  assert.equal(normalizeWhatsappOriginPhone(built.request.originPhone), built.request.originPhone)
  for (const sample of ["+54 9 351 000-1111", "03510001111", "005493510001111", "5493510001111"]) {
    assert.equal(normalizeWhatsappOriginPhone(sample), "5493510001111")
  }
})

test("un conflicto del índice devuelve la solicitud abierta y no inserta otra", async () => {
  const now = "2026-10-14T18:00:00.000Z"
  const phone = "5493510001111"
  const existing = requestRow({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    external_message_id: "wamid.primero",
    origin_phone: phone,
    offer: "pack",
    status: "pending",
    customer_id: null,
    created_at: now,
  })
  const rows = [existing]
  const built = buildWhatsappCommercialRequest({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    companyId: COMPANY_A,
    originPhone: "351 000-1111",
    offer: "pack",
    matches: [],
    phoneVerified: false,
    quote: null,
    service: null,
    customerAccepted: true,
    customerAcceptedAt: now,
    now,
  })
  const saved = await insertWhatsappCommercialRequest(
    indexClient(rows),
    built.request,
    "wamid.segundo"
  )
  assert.equal(saved.error, null)
  assert.equal(saved.duplicate, true)
  assert.equal(saved.data.id, existing.id)
  assert.equal(saved.data.customerId, null)
  assert.equal(saved.data.originPhone, phone)
  assert.equal(rows.length, 1)
})

test("una solicitud terminada no bloquea una aceptación nueva", async () => {
  const now = "2026-10-14T18:00:00.000Z"
  const rows = [
    requestRow({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      external_message_id: "wamid.cerrado",
      origin_phone: "5493510001111",
      offer: "pack",
      status: "completed",
      customer_id: null,
      created_at: now,
    }),
  ]
  const built = buildWhatsappCommercialRequest({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    companyId: COMPANY_A,
    originPhone: "5493510001111",
    offer: "pack",
    matches: [],
    phoneVerified: false,
    quote: null,
    service: null,
    customerAccepted: true,
    customerAcceptedAt: now,
    now,
  })
  const saved = await insertWhatsappCommercialRequest(indexClient(rows), built.request, "wamid.nuevo")
  assert.equal(saved.error, null)
  assert.equal(saved.duplicate, false)
  assert.equal(rows.length, 2)
  assert.equal(rows.filter((row) => OPEN_STATUSES.includes(row.status)).length, 1)
})

const isolated = await openIsolatedDatabase()
test.after(async () => {
  if (isolated) await isolated.close()
})

test("dos aceptaciones concurrentes dejan una sola solicitud abierta", { skip: isolated ? false : "no hay una base Postgres aislada en este entorno" }, async () => {
  const phone = normalizeWhatsappOriginPhone("351 000-2222")
  const results = await Promise.allSettled([
    isolated.insertRequest({ messageId: "wamid.concurrente.a", phone, offer: "pack", companyId: COMPANY_A }),
    isolated.insertRequest({ messageId: "wamid.concurrente.b", phone, offer: "pack", companyId: COMPANY_A }),
  ])
  const uniqueFailures = results.filter((result) => result.status === "rejected" && isUniqueViolation(result.reason))
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal(uniqueFailures.length, 1)
  assert.equal(await isolated.countOpen(COMPANY_A, phone, "pack"), 1)

  const loserLookup = await isolated.findByMessage(COMPANY_A, "wamid.concurrente.b")
  const winnerIsB = loserLookup != null
  const missingId = winnerIsB ? "wamid.concurrente.a" : "wamid.concurrente.b"
  assert.equal(await isolated.findByMessage(COMPANY_A, missingId), null)
  const recovered = await isolated.findOpen(COMPANY_A, phone, "pack")
  assert.ok(recovered)
  assert.equal(recovered.customer_id, null)
  assert.equal(recovered.origin_phone, phone)
  assert.equal(recovered.offer, "pack")
})

test("el índice permite otra empresa, otra oferta y una solicitud ya cerrada", { skip: isolated ? false : "no hay una base Postgres aislada en este entorno" }, async () => {
  const phone = normalizeWhatsappOriginPhone("351 000-3333")
  await isolated.insertRequest({
    messageId: "wamid.historial",
    phone,
    offer: "full",
    companyId: COMPANY_A,
    status: "completed",
  })
  await isolated.insertRequest({ messageId: "wamid.full.abierta", phone, offer: "full", companyId: COMPANY_A })
  await isolated.insertRequest({ messageId: "wamid.pack.abierta", phone, offer: "pack", companyId: COMPANY_A })
  await isolated.insertRequest({ messageId: "wamid.otra.empresa", phone, offer: "pack", companyId: COMPANY_B })
  assert.equal(await isolated.countOpen(COMPANY_A, phone, "full"), 1)
  assert.equal(await isolated.countOpen(COMPANY_A, phone, "pack"), 1)
  assert.equal(await isolated.countOpen(COMPANY_B, phone, "pack"), 1)
  const closed = await isolated.countStatus(COMPANY_A, phone, "full", "completed")
  assert.equal(closed, 1)

  for (const status of ["in_review", "approved"]) {
    const openPhone = normalizeWhatsappOriginPhone(status === "in_review" ? "351 000-5555" : "351 000-6666")
    await isolated.insertRequest({
      messageId: `wamid.${status}`,
      phone: openPhone,
      offer: "pack",
      companyId: COMPANY_A,
      status,
    })
    await assert.rejects(
      () => isolated.insertRequest({
        messageId: `wamid.${status}.otra`,
        phone: openPhone,
        offer: "pack",
        companyId: COMPANY_A,
      }),
      (error) => isUniqueViolation(error)
    )
    assert.equal(await isolated.countOpen(COMPANY_A, openPhone, "pack"), 1)
  }
})

test("la reserva de envío y la baja usan la clave primaria ante dos inserciones simultáneas", { skip: isolated ? false : "no hay una base Postgres aislada en este entorno" }, async () => {
  const phone = normalizeWhatsappOriginPhone("351 000-4444")
  const slot = whatsappSlotKey("wamid.entrante", 0)
  const optOut = whatsappOptOutKey(phone)
  const slotResults = await Promise.allSettled([
    isolated.claimLedger(COMPANY_A, slot),
    isolated.claimLedger(COMPANY_A, slot),
  ])
  assert.equal(slotResults.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal(slotResults.filter((result) => result.status === "rejected" && isUniqueViolation(result.reason)).length, 1)
  assert.equal(await isolated.countLedger(COMPANY_A, slot), 1)

  const optResults = await Promise.allSettled([
    isolated.claimLedger(COMPANY_A, optOut),
    isolated.claimLedger(COMPANY_A, optOut),
  ])
  assert.equal(optResults.filter((result) => result.status === "fulfilled").length, 1)
  assert.equal(optResults.filter((result) => result.status === "rejected" && isUniqueViolation(result.reason)).length, 1)
  await isolated.claimLedger(COMPANY_B, optOut)
  assert.equal(await isolated.countLedger(COMPANY_A, optOut), 1)
  assert.equal(await isolated.countLedger(COMPANY_B, optOut), 1)
})

function requestRow(overrides) {
  return {
    id: overrides.id,
    company_id: COMPANY_A,
    customer_id: null,
    identity_status: "unverified",
    origin_phone: overrides.origin_phone,
    offer: overrides.offer,
    current_plan_label: null,
    destination_plan_label: null,
    quoted_monthly_fee: null,
    quoted_components: [],
    customer_accepted: null,
    customer_accepted_at: null,
    status: overrides.status,
    operator_result: null,
    operator_notes: null,
    resolved_by: null,
    resolved_at: null,
    created_at: overrides.created_at,
    updated_at: overrides.created_at,
    external_message_id: overrides.external_message_id,
  }
}

function indexClient(rows) {
  return {
    from() {
      const state = { filters: [], order: null, limit: null, insertRow: null, op: "select" }
      const api = {
        insert(row) {
          state.op = "insert"
          state.insertRow = row
          return api
        },
        select() {
          return api
        },
        eq(column, value) {
          state.filters.push((row) => row[column] === value)
          return api
        },
        in(column, values) {
          state.filters.push((row) => values.includes(row[column]))
          return api
        },
        order(column, options) {
          state.order = { column, ascending: options?.ascending !== false }
          return api
        },
        limit(count) {
          state.limit = count
          return api
        },
        maybeSingle() {
          return Promise.resolve(materialize(true))
        },
        then(resolve, reject) {
          return Promise.resolve(materialize(false)).then(resolve, reject)
        },
      }

      function materialize(single) {
        if (state.op === "insert") {
          const row = state.insertRow
          const sameMessage = rows.some(
            (current) =>
              current.company_id === row.company_id &&
              current.external_message_id != null &&
              current.external_message_id === row.external_message_id
          )
          const sameOpenOffer =
            OPEN_STATUSES.includes(row.status) &&
            rows.some(
              (current) =>
                OPEN_STATUSES.includes(current.status) &&
                current.company_id === row.company_id &&
                current.origin_phone === row.origin_phone &&
                current.offer === row.offer
            )
          if (sameMessage || sameOpenOffer) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }
          }
          rows.push(row)
          return { data: single ? row : [row], error: null }
        }
        let found = rows.filter((row) => state.filters.every((filter) => filter(row)))
        if (state.order) {
          const { column, ascending } = state.order
          found = [...found].sort((left, right) => {
            const compared = String(left[column]).localeCompare(String(right[column]))
            return ascending ? compared : -compared
          })
        }
        if (state.limit != null) found = found.slice(0, state.limit)
        return { data: single ? found[0] ?? null : found, error: null }
      }

      return api
    },
  }
}

function isUniqueViolation(error) {
  const code = error && typeof error === "object" ? error.code : undefined
  return code === "23505" || /duplicate key|23505/i.test(String(error?.message ?? error))
}

async function openIsolatedDatabase() {
  const databaseUrl = process.env.WHATSAPP_ISOLATED_DATABASE_URL?.trim()
  if (databaseUrl) {
    assertIsolatedUrl(databaseUrl)
    const schema = `wa_idx_${randomUUID().replaceAll("-", "")}`
    const postgres = (await import("postgres")).default
    const bootstrap = postgres(databaseUrl, { max: 1 })
    await bootstrap.unsafe(`CREATE SCHEMA ${schema}`)
    await bootstrap.end({ timeout: 5 })
    const sql = postgres(databaseUrl, {
      max: 2,
      connection: { search_path: schema },
    })
    try {
      await createFixture(async (statement) => {
        await sql.unsafe(statement)
      })
      return adapter(async (statement, params) => sql.unsafe(statement, params), async () => {
        await sql.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
        await sql.end({ timeout: 5 })
      })
    } catch (error) {
      await sql.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {})
      await sql.end({ timeout: 5 })
      throw error
    }
  }

  const loaded = await loadPglite()
  if (!loaded) return null
  const db = new loaded.PGlite()
  await createFixture(async (statement) => {
    await db.exec(statement)
  })
  return adapter(async (statement, params = []) => {
    const result = await db.query(statement, params)
    return result.rows
  }, async () => {
    await db.close()
  })
}

function assertIsolatedUrl(url) {
  let host = ""
  try {
    host = new URL(url).host
  } catch {
    throw new Error("WHATSAPP_ISOLATED_DATABASE_URL no es una URL válida.")
  }
  if (/supabase\.(co|com|in)$/i.test(host) || host.includes("pooler.supabase")) {
    throw new Error("La prueba aislada no puede usar el host de Supabase.")
  }
  const envPath = resolve(root, ".env.local")
  let configured = ""
  try {
    configured = readFileSync(envPath, "utf8")
  } catch {
    configured = ""
  }
  const publicUrl = configured.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim()
  if (publicUrl) {
    const publicHost = new URL(publicUrl).host
    if (host === publicHost || url.includes(publicHost)) {
      throw new Error("La prueba aislada apunta al proyecto configurado en el entorno.")
    }
  }
}

async function loadPglite() {
  const explicit = process.env.WHATSAPP_PGLITE_MODULE?.trim()
  try {
    if (explicit) {
      return await import(pathToFileURL(explicit).href)
    }
    return await import("@electric-sql/pglite")
  } catch {
    return null
  }
}

async function createFixture(exec) {
  await exec(`
    CREATE TABLE tv_whatsapp_commercial_requests (
      id uuid PRIMARY KEY,
      company_id uuid NOT NULL,
      customer_id uuid,
      identity_status text NOT NULL CHECK (identity_status IN ('unverified', 'verified')),
      origin_phone text NOT NULL,
      offer text NOT NULL CHECK (offer IN ('basica', 'pack', 'full')),
      current_plan_label text,
      destination_plan_label text,
      quoted_monthly_fee numeric(12, 2),
      quoted_components jsonb NOT NULL DEFAULT '[]'::jsonb,
      customer_accepted boolean,
      customer_accepted_at timestamptz,
      status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_review', 'approved', 'completed', 'rejected')),
      operator_result text,
      operator_notes text,
      resolved_by uuid,
      resolved_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      external_message_id text,
      CONSTRAINT tv_whatsapp_identity_link_chk CHECK (
        (identity_status = 'unverified' AND customer_id IS NULL)
        OR (identity_status = 'verified' AND customer_id IS NOT NULL)
      )
    )
  `)
  await exec(`
    CREATE UNIQUE INDEX tv_whatsapp_commercial_requests_external_message_uidx
      ON tv_whatsapp_commercial_requests (company_id, external_message_id)
      WHERE external_message_id IS NOT NULL
  `)
  await exec(indexStatement().replaceAll("public.tv_whatsapp_commercial_requests", "tv_whatsapp_commercial_requests"))
  await exec(`
    CREATE TABLE tv_whatsapp_processed_messages (
      company_id uuid NOT NULL,
      external_message_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (company_id, external_message_id)
    )
  `)
}

function adapter(query, close) {
  return {
    async insertRequest({ messageId, phone, offer, companyId, status = "pending" }) {
      await query(
        `
          INSERT INTO tv_whatsapp_commercial_requests (
            id, company_id, identity_status, origin_phone, offer, status, external_message_id
          ) VALUES ($1, $2, 'unverified', $3, $4, $5, $6)
        `,
        [randomUUID(), companyId, phone, offer, status, messageId]
      )
    },
    async countOpen(companyId, phone, offer) {
      const rows = await query(
        `
          SELECT COUNT(*)::int AS total
          FROM tv_whatsapp_commercial_requests
          WHERE company_id = $1
            AND origin_phone = $2
            AND offer = $3
            AND status IN ('pending', 'in_review', 'approved')
        `,
        [companyId, phone, offer]
      )
      return Number(rows[0].total)
    },
    async countStatus(companyId, phone, offer, status) {
      const rows = await query(
        `
          SELECT COUNT(*)::int AS total
          FROM tv_whatsapp_commercial_requests
          WHERE company_id = $1 AND origin_phone = $2 AND offer = $3 AND status = $4
        `,
        [companyId, phone, offer, status]
      )
      return Number(rows[0].total)
    },
    async findByMessage(companyId, messageId) {
      const rows = await query(
        `
          SELECT id, customer_id, origin_phone, offer, status
          FROM tv_whatsapp_commercial_requests
          WHERE company_id = $1 AND external_message_id = $2
        `,
        [companyId, messageId]
      )
      return rows[0] ?? null
    },
    async findOpen(companyId, phone, offer) {
      const rows = await query(
        `
          SELECT id, customer_id, origin_phone, offer, status
          FROM tv_whatsapp_commercial_requests
          WHERE company_id = $1
            AND origin_phone = $2
            AND offer = $3
            AND status IN ('pending', 'in_review', 'approved')
          ORDER BY created_at ASC
          LIMIT 1
        `,
        [companyId, phone, offer]
      )
      return rows[0] ?? null
    },
    async claimLedger(companyId, key) {
      await query(
        `
          INSERT INTO tv_whatsapp_processed_messages (company_id, external_message_id)
          VALUES ($1, $2)
        `,
        [companyId, key]
      )
    },
    async countLedger(companyId, key) {
      const rows = await query(
        `
          SELECT COUNT(*)::int AS total
          FROM tv_whatsapp_processed_messages
          WHERE company_id = $1 AND external_message_id = $2
        `,
        [companyId, key]
      )
      return Number(rows[0].total)
    },
    close,
  }
}
