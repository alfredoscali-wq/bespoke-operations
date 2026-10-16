/**
 * Reserva atómica del alta Latam contra una base aislada.
 * No usa el proyecto de Supabase configurado en el entorno.
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import net from "node:net"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")
const migration = readFileSync(
  resolve(root, "supabase/migrations/20270115190000_latam_tv_signup_attempts.sql"),
  "utf8"
)

const TABLE = "(?:public\\.)?latam_tv_signup_attempts"

function migrationStatement(verb, source = migration) {
  const pattern = new RegExp(
    `${verb}\\s+(?:INTO\\s+)?${TABLE}\\b[\\s\\S]*?RETURNING \\* INTO v_row;`,
    "i"
  )
  const found = source.match(pattern)
  assert.ok(found, `la migración no contiene ${verb} de latam_tv_signup_attempts`)
  return found[0].replace(
    new RegExp(`${verb}\\s+(?:INTO\\s+)?${TABLE}\\b`, "i"),
    `${verb}${verb === "INSERT" ? " INTO" : ""} latam_tv_signup_attempts`
  )
}

function functionBody(name) {
  const start = migration.indexOf(`FUNCTION public.${name}`)
  assert.ok(start > 0, name)
  const end = migration.indexOf("$$;", start)
  assert.ok(end > start, name)
  return migration.slice(start, end)
}

function canConnect(port) {
  return new Promise((resolvePromise) => {
    const socket = net.connect({ host: "127.0.0.1", port })
    const done = (value) => {
      socket.removeAllListeners()
      socket.destroy()
      resolvePromise(value)
    }
    socket.setTimeout(400)
    socket.once("connect", () => done(true))
    socket.once("timeout", () => done(false))
    socket.once("error", () => done(false))
  })
}

async function loadPglite() {
  try {
    return await import("@electric-sql/pglite")
  } catch {
    const explicit = process.env.LATAM_PGLITE_MODULE?.trim()
    if (!explicit) return null
    return import(pathToFileURL(explicit).href)
  }
}

const setupSql = (insert, update, release) => `
  CREATE TABLE latam_tv_signup_attempts (
    company_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    state text NOT NULL CHECK (state IN ('register_sent', 'pending_sync', 'confirmed', 'rejected')),
    latam_code integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, customer_id)
  );

  CREATE FUNCTION reserve_attempt(p_customer_id uuid, v_company uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  AS $fn$
  DECLARE
    v_row latam_tv_signup_attempts;
  BEGIN
    ${insert}
    IF FOUND THEN
      RETURN jsonb_build_object('granted', true, 'state', v_row.state, 'latam_code', v_row.latam_code);
    END IF;
    SELECT * INTO v_row
    FROM latam_tv_signup_attempts
    WHERE company_id = v_company AND customer_id = p_customer_id;
    RETURN jsonb_build_object(
      'granted', false,
      'state', v_row.state,
      'latam_code', v_row.latam_code
    );
  END
  $fn$;

  CREATE FUNCTION finish_attempt(
    p_customer_id uuid,
    v_company uuid,
    p_state text,
    p_latam_code integer
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  AS $fn$
  DECLARE
    v_row latam_tv_signup_attempts;
  BEGIN
    ${update}
    IF FOUND THEN
      RETURN jsonb_build_object('saved', true, 'state', v_row.state, 'latam_code', v_row.latam_code);
    END IF;
    SELECT * INTO v_row
    FROM latam_tv_signup_attempts
    WHERE company_id = v_company AND customer_id = p_customer_id;
    RETURN jsonb_build_object(
      'saved', false,
      'state', CASE WHEN v_row.customer_id IS NULL THEN NULL ELSE v_row.state END,
      'latam_code', v_row.latam_code
    );
  END
  $fn$;

  CREATE FUNCTION release_attempt(p_customer_id uuid, v_company uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  AS $fn$
  DECLARE
    v_row latam_tv_signup_attempts;
  BEGIN
    ${release}
    IF FOUND THEN
      RETURN jsonb_build_object('released', true, 'state', v_row.state, 'latam_code', v_row.latam_code);
    END IF;
    SELECT * INTO v_row
    FROM latam_tv_signup_attempts
    WHERE company_id = v_company AND customer_id = p_customer_id;
    RETURN jsonb_build_object(
      'released', false,
      'state', CASE WHEN v_row.customer_id IS NULL THEN NULL ELSE v_row.state END,
      'latam_code', v_row.latam_code
    );
  END
  $fn$;
`

function api(query, close) {
  return {
    async reserve(customer, company) {
      const result = await query(
        "select reserve_attempt($1::uuid, $2::uuid) as result",
        [customer, company]
      )
      return result.rows ? result.rows[0].result : result[0].result
    },
    async finish(customer, company, state, latamCode = null) {
      const result = await query(
        "select finish_attempt($1::uuid, $2::uuid, $3::text, $4::integer) as result",
        [customer, company, state, latamCode]
      )
      return result.rows ? result.rows[0].result : result[0].result
    },
    async release(customer, company) {
      const result = await query(
        "select release_attempt($1::uuid, $2::uuid) as result",
        [customer, company]
      )
      return result.rows ? result.rows[0].result : result[0].result
    },
    async seed(company, customer, state, latamCode = null) {
      await query(
        "insert into latam_tv_signup_attempts (company_id, customer_id, state, latam_code) values ($1::uuid, $2::uuid, $3::text, $4::integer)",
        [company, customer, state, latamCode]
      )
    },
    async insertDuplicate(company, customer) {
      await query(
        "insert into latam_tv_signup_attempts (company_id, customer_id, state) values ($1::uuid, $2::uuid, 'register_sent')",
        [company, customer]
      )
    },
    async stateOf(company, customer) {
      const result = await query(
        "select state, latam_code from latam_tv_signup_attempts where company_id = $1::uuid and customer_id = $2::uuid",
        [company, customer]
      )
      return result.rows ?? result
    },
    close,
  }
}

async function openPglite(insert, update, release) {
  const loaded = await loadPglite()
  if (!loaded) return null
  const db = new loaded.PGlite()
  await db.exec(setupSql(insert, update, release))
  return api(
    (statement, params) => db.query(statement, params),
    () => db.close()
  )
}

async function openIsolated(insert, update, release) {
  const pglite = await openPglite(insert, update, release)
  if (pglite) return pglite
  if (!(await canConnect(54322))) return null
  const postgres = (await import("postgres")).default
  const admin = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", {
    max: 1,
    connect_timeout: 2,
  })
  const schema = `latam_attempt_${randomUUID().replaceAll("-", "")}`
  try {
    await admin.unsafe(`CREATE SCHEMA ${schema}`)
  } catch {
    await admin.end({ timeout: 2 }).catch(() => {})
    return null
  }
  await admin.end({ timeout: 2 })
  const sql = postgres("postgresql://postgres:postgres@127.0.0.1:54322/postgres", {
    max: 4,
    connect_timeout: 2,
    connection: { search_path: schema },
  })
  await sql.unsafe(setupSql(insert, update, release))
  return api(
    (statement, params) => sql.unsafe(statement, params),
    async () => {
      await sql.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
      await sql.end({ timeout: 2 })
    }
  )
}

const releaseMigration = readFileSync(
  resolve(root, "supabase/migrations/20270115200000_latam_tv_signup_attempt_release.sql"),
  "utf8"
)
const insert = migrationStatement("INSERT")
const update = migrationStatement("UPDATE")
const releaseGuardMigration = readFileSync(
  resolve(root, "supabase/migrations/20270115220000_latam_tv_signup_attempt_release_guard.sql"),
  "utf8"
)
const release = migrationStatement("UPDATE", releaseGuardMigration)
const isolated = await openIsolated(insert, update, release)
const skip = isolated ? false : "no hay una base Postgres aislada en este entorno"

test("la migración no guarda datos personales y reserva con la clave única", () => {
  assert.match(insert, /ON CONFLICT \(company_id, customer_id\) DO UPDATE/)
  assert.match(insert, /WHERE latam_tv_signup_attempts\.state = 'rejected'/)
  assert.match(migration, /INSERT\s+INTO\s+public\.latam_tv_signup_attempts\b/)
  assert.match(migration, /UPDATE\s+public\.latam_tv_signup_attempts\b/)
  assert.match(migration, /PRIMARY KEY \(company_id, customer_id\)/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /SECURITY DEFINER/)
  assert.match(migration, /SET search_path = public/)
  assert.match(migration, /REVOKE ALL ON TABLE public\.latam_tv_signup_attempts FROM authenticated/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.reserve_latam_tv_signup_attempt\(uuid\) TO authenticated/)
  assert.doesNotMatch(migration, /\b(dni|email|password|correo)\b/i)
  assert.equal(migration.match(/INSERT\s+INTO\s+/gi).length, 1)
  assert.equal(releaseMigration.match(/INSERT\s+INTO\s+/gi)?.length ?? 0, 0)
  assert.match(release, /state = 'pending_sync'/)
  assert.match(release, /latam_code IS NOT NULL\s+AND latam_code NOT IN \(1, 3\)/)
  assert.doesNotMatch(release, /latam_code IS NULL OR/)
  assert.doesNotMatch(release, /register_sent/)
  assert.doesNotMatch(release, /confirmed/)
  assert.doesNotMatch(releaseMigration, /\b(dni|email|password|correo)\b/i)
  assert.match(releaseGuardMigration, /CREATE OR REPLACE FUNCTION public\.release_latam_tv_signup_attempt/)
  assert.equal(releaseGuardMigration.match(/CREATE OR REPLACE FUNCTION/g).length, 1)
  assert.equal(releaseGuardMigration.match(/INSERT\s+INTO\s+/gi)?.length ?? 0, 0)
  assert.doesNotMatch(releaseGuardMigration, /UPDATE\s+(?:public\.)?customers\b/i)
  assert.doesNotMatch(releaseGuardMigration, /\b(ALTER|DROP|DELETE|TRUNCATE)\b/i)
  assert.doesNotMatch(releaseGuardMigration, /\b(dni|email|password|correo)\b/i)
  assert.match(
    releaseGuardMigration,
    /GRANT EXECUTE ON FUNCTION public\.release_latam_tv_signup_attempt\(uuid\) TO authenticated/
  )
  const reserveCodeMigration = readFileSync(
    resolve(root, "supabase/migrations/20270115210000_latam_tv_signup_attempt_reserve_code.sql"),
    "utf8"
  )
  assert.match(reserveCodeMigration, /'granted', false/)
  assert.match(reserveCodeMigration, /'latam_code', v_row\.latam_code/)
  assert.match(reserveCodeMigration, /WHERE latam_tv_signup_attempts\.state = 'rejected'/)
  assert.doesNotMatch(reserveCodeMigration, /\b(dni|email|password|correo)\b/i)
  assert.equal(reserveCodeMigration.match(/CREATE OR REPLACE FUNCTION/g).length, 1)
  const releaseBody = releaseMigration.slice(
    releaseMigration.indexOf("FUNCTION public.release_latam_tv_signup_attempt"),
    releaseMigration.indexOf("$$;", releaseMigration.indexOf("FUNCTION public.release_latam_tv_signup_attempt"))
  )
  assert.match(releaseBody, /public\.auth_user_company_id\(\)/)
  assert.match(releaseBody, /public\.auth_is_demo_platform_read_only\(\)/)
  assert.match(releaseBody, /public\.auth_user_has_allowed_module\('subscriptions'\)/)
  assert.match(releaseBody, /deleted_at IS NULL/)
  assert.match(releaseMigration, /GRANT EXECUTE ON FUNCTION public\.release_latam_tv_signup_attempt\(uuid\) TO authenticated/)
  const releaseGuardBody = releaseGuardMigration.slice(
    releaseGuardMigration.indexOf("FUNCTION public.release_latam_tv_signup_attempt"),
    releaseGuardMigration.indexOf("$$;", releaseGuardMigration.indexOf("FUNCTION public.release_latam_tv_signup_attempt"))
  )
  assert.match(releaseGuardBody, /public\.auth_user_company_id\(\)/)
  assert.match(releaseGuardBody, /public\.auth_is_demo_platform_read_only\(\)/)
  assert.match(releaseGuardBody, /public\.auth_user_has_allowed_module\('subscriptions'\)/)
  assert.match(releaseGuardBody, /public\.auth_user_system_role\(\)/)
  assert.match(releaseGuardBody, /FROM public\.customers/)
  assert.match(releaseGuardBody, /deleted_at IS NULL/)
  assert.doesNotMatch(releaseGuardBody, /UPDATE\s+(?:public\.)?customers\b/i)

  const finish = functionBody("finish_latam_tv_signup_attempt")
  assert.doesNotMatch(finish, /INSERT\s+INTO/i)
  assert.match(finish, /state = 'register_sent' AND p_state IN \('pending_sync', 'confirmed'\)/)
  assert.match(finish, /state = 'pending_sync' AND p_state IN \('pending_sync', 'confirmed'\)/)
  assert.match(finish, /p_state NOT IN \('pending_sync', 'confirmed'\)/)
  assert.doesNotMatch(finish, /register_sent' AND p_state IN \([^)]*'rejected'/)
  assert.doesNotMatch(finish, /pending_sync' AND p_state[^)]*'rejected'/)
  for (const name of [
    "reserve_latam_tv_signup_attempt",
    "read_latam_tv_signup_attempt",
    "finish_latam_tv_signup_attempt",
  ]) {
    const body = functionBody(name)
    assert.match(body, /public\.auth_user_company_id\(\)/)
    assert.match(body, /public\.auth_is_demo_platform_read_only\(\)/)
    assert.match(body, /public\.auth_user_has_allowed_module\('subscriptions'\)/)
    assert.match(body, /public\.auth_user_system_role\(\)/)
    assert.match(body, /FROM public\.customers/)
    assert.match(body, /deleted_at IS NULL/)
  }
})

test("dos conexiones obtienen una sola reserva", { skip }, async () => {
  const company = randomUUID()
  const customer = randomUUID()
  const [left, right] = await Promise.all([
    isolated.reserve(customer, company),
    isolated.reserve(customer, company),
  ])
  const grants = [left.granted, right.granted]
  assert.deepEqual(grants.sort(), [false, true])
  const rows = await isolated.stateOf(company, customer)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].state, "register_sent")
})

test("la clave única rechaza una segunda fila y rejected concede una sola vez", { skip }, async () => {
  const company = randomUUID()
  const customer = randomUUID()
  await isolated.seed(company, customer, "rejected")
  await assert.rejects(
    () => isolated.insertDuplicate(company, customer),
    (error) => {
      assert.equal(error.code, "23505")
      return true
    }
  )
  const [left, right] = await Promise.all([
    isolated.reserve(customer, company),
    isolated.reserve(customer, company),
  ])
  const grants = [left.granted, right.granted]
  assert.deepEqual(grants.sort(), [false, true])
  const third = await isolated.reserve(customer, company)
  assert.equal(third.granted, false)
  assert.equal(third.state, "register_sent")
})

test("register_sent, pending_sync y confirmed no conceden otra reserva", { skip }, async () => {
  for (const state of ["register_sent", "pending_sync", "confirmed"]) {
    const company = randomUUID()
    const customer = randomUUID()
    await isolated.seed(company, customer, state, state === "confirmed" ? 1 : null)
    const reservation = await isolated.reserve(customer, company)
    assert.equal(reservation.granted, false, state)
    assert.equal(reservation.state, state)
    const rows = await isolated.stateOf(company, customer)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].state, state)
  }
})

test("finish no crea una reserva y confirma el código sin degradar", { skip }, async () => {
  const company = randomUUID()
  const customer = randomUUID()
  const missing = await isolated.finish(customer, company, "confirmed", 1)
  assert.equal(missing.saved, false)
  assert.equal(missing.state, null)
  assert.equal((await isolated.stateOf(company, customer)).length, 0)
  const pendingMissing = await isolated.finish(customer, company, "pending_sync", 4)
  assert.equal(pendingMissing.saved, false)
  assert.equal((await isolated.stateOf(company, customer)).length, 0)

  await isolated.seed(company, customer, "register_sent")
  const pending = await isolated.finish(customer, company, "pending_sync", 4)
  assert.equal(pending.saved, true)
  assert.equal(pending.state, "pending_sync")
  assert.equal(pending.latam_code, 4)
  const blocked = await isolated.finish(customer, company, "rejected", null)
  assert.equal(blocked.saved, false)
  assert.equal((await isolated.stateOf(company, customer))[0].state, "pending_sync")

  const confirmed = await isolated.finish(customer, company, "confirmed", 1)
  assert.equal(confirmed.saved, true)
  assert.equal(confirmed.state, "confirmed")
  assert.equal(confirmed.latam_code, 1)
  const latePending = await isolated.finish(customer, company, "pending_sync", null)
  const lateRejected = await isolated.finish(customer, company, "rejected", null)
  const lateCode = await isolated.finish(customer, company, "confirmed", 13)
  assert.equal(latePending.saved, false)
  assert.equal(lateRejected.saved, false)
  assert.equal(lateCode.saved, true)
  assert.equal(lateCode.state, "confirmed")
  assert.equal(lateCode.latam_code, 1)
  const rows = await isolated.stateOf(company, customer)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].state, "confirmed")
  assert.equal(rows[0].latam_code, 1)
  const again = await isolated.reserve(customer, company)
  assert.equal(again.granted, false)
  assert.equal(again.state, "confirmed")
})

test("release no cierra un pending_sync sin código y conserva 1, 3, register_sent y confirmed", { skip }, async () => {
  const company = randomUUID()
  const customer = randomUUID()
  await isolated.seed(company, customer, "pending_sync", null)
  const closed = await isolated.release(customer, company)
  assert.equal(closed.released, false)
  assert.equal(closed.state, "pending_sync")
  const pendingRows = await isolated.stateOf(company, customer)
  assert.equal(pendingRows.length, 1)
  assert.equal(pendingRows[0].state, "pending_sync")
  assert.equal(pendingRows[0].latam_code, null)
  const stillHeld = await isolated.reserve(customer, company)
  assert.equal(stillHeld.granted, false)
  assert.equal(stillHeld.state, "pending_sync")

  const fiveCompany = randomUUID()
  const fiveCustomer = randomUUID()
  await isolated.seed(fiveCompany, fiveCustomer, "pending_sync", 5)
  const five = await isolated.release(fiveCustomer, fiveCompany)
  assert.equal(five.released, true)
  assert.equal(five.state, "rejected")
  const fiveRows = await isolated.stateOf(fiveCompany, fiveCustomer)
  assert.equal(fiveRows.length, 1)
  assert.equal(fiveRows[0].state, "rejected")
  assert.equal(fiveRows[0].latam_code, 5)

  for (const [state, code] of [
    ["pending_sync", 1],
    ["pending_sync", 3],
    ["register_sent", null],
    ["confirmed", 1],
  ]) {
    const heldCompany = randomUUID()
    const heldCustomer = randomUUID()
    await isolated.seed(heldCompany, heldCustomer, state, code)
    const held = await isolated.release(heldCustomer, heldCompany)
    assert.equal(held.released, false, `${state}:${code}`)
    const rows = await isolated.stateOf(heldCompany, heldCustomer)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].state, state, `${state}:${code}`)
    assert.equal(rows[0].latam_code, code, `${state}:${code}`)
  }
})

test("finish no puede pasar register_sent a rejected", { skip }, async () => {
  const company = randomUUID()
  const customer = randomUUID()
  await isolated.seed(company, customer, "register_sent", 1)
  const rejected = await isolated.finish(customer, company, "rejected", null)
  assert.equal(rejected.saved, false)
  const rows = await isolated.stateOf(company, customer)
  assert.equal(rows[0].state, "register_sent")
  assert.equal(rows[0].latam_code, 1)
  const again = await isolated.reserve(customer, company)
  assert.equal(again.granted, false)
  assert.equal(again.state, "register_sent")
})

test.after(async () => {
  if (isolated) await isolated.close()
})
