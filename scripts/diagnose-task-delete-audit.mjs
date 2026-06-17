/**
 * TEMP audit — run: node --env-file=.env.local scripts/diagnose-task-delete-audit.mjs [taskId]
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const dbUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL

console.log("=== Supabase environment ===")
console.log("NEXT_PUBLIC_SUPABASE_URL:", url ?? "(missing)")
const projectRef = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
console.log("project ref:", projectRef ?? "(unknown)")
console.log(
  "dashboard URL:",
  projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}`
    : "(unknown)"
)
console.log("DATABASE_URL configured:", Boolean(dbUrl))

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_* in environment")
  process.exit(1)
}

const client = createClient(url, key)
const taskIdArg = process.argv[2]

function logError(label, error) {
  if (!error) {
    console.log(`${label}: (no error)`)
    return
  }
  console.log(`${label}:`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  })
}

async function queryPgPoliciesViaPostgres() {
  if (!dbUrl) {
    console.log("\n=== pg_policies (direct SQL) ===")
    console.log(
      "Skipped: set DATABASE_URL or SUPABASE_DB_URL to run SELECT * FROM pg_policies WHERE tablename = 'tasks'"
    )
    return
  }

  let pg
  try {
    pg = await import("pg")
  } catch {
    console.log("\n=== pg_policies (direct SQL) ===")
    console.log("Skipped: install `pg` package to query pg_policies directly")
    return
  }

  const pool = new pg.default.Pool({ connectionString: dbUrl })
  try {
    console.log("\n=== SELECT * FROM pg_policies WHERE tablename = 'tasks' ===")
    const policies = await pool.query(
      "SELECT * FROM pg_policies WHERE tablename = 'tasks' ORDER BY policyname, cmd"
    )
    console.log(JSON.stringify(policies.rows, null, 2))

    console.log("\n=== Triggers on public.tasks ===")
    const triggers = await pool.query(`
      SELECT
        tgname AS trigger_name,
        pg_get_triggerdef(t.oid, true) AS trigger_definition
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'tasks'
        AND NOT t.tgisinternal
      ORDER BY tgname
    `)
    console.log(JSON.stringify(triggers.rows, null, 2))

    console.log("\n=== Functions invoked by tasks triggers ===")
    const functions = await pool.query(`
      SELECT DISTINCT
        p.proname AS function_name,
        pg_get_functiondef(p.oid) AS function_definition
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname = 'public'
        AND c.relname = 'tasks'
        AND NOT t.tgisinternal
      ORDER BY p.proname
    `)
    console.log(JSON.stringify(functions.rows, null, 2))
  } finally {
    await pool.end()
  }
}

async function runClientTests(targetId) {
  const { data, error } = await client
    .from("tasks")
    .select("id, code, title, deleted_at, progress")
    .eq("id", targetId)
    .is("deleted_at", null)
    .maybeSingle()

  logError("fetch task error", error)
  if (!data) {
    console.log("Task not found or already deleted:", targetId)
    return
  }

  console.log("\nUsing task:", data)

  console.log("\n--- Test 1: UPDATE progress (non-delete field) ---")
  const test1 = await client
    .from("tasks")
    .update({ progress: data.progress ?? 0 })
    .eq("id", targetId)
    .is("deleted_at", null)
  logError("Test 1 error", test1.error)
  console.log("Test 1 status:", test1.status, test1.statusText)

  console.log("\n--- Test 2: UPDATE deleted_at (soft delete) ---")
  const payload = { deleted_at: new Date().toISOString() }
  const test2 = await client
    .from("tasks")
    .update(payload)
    .eq("id", targetId)
    .is("deleted_at", null)
  logError("Test 2 error", test2.error)
  console.log("Test 2 status:", test2.status, test2.statusText)

  if (!test2.error) {
    console.log("Restoring task (deleted_at = null)...")
    const restore = await client
      .from("tasks")
      .update({ deleted_at: null })
      .eq("id", targetId)
    logError("restore error", restore.error)
  }

  console.log("\n--- Test 3: raw PATCH soft delete (return=minimal) ---")
  const restUrl = `${url}/rest/v1/tasks?id=eq.${targetId}&deleted_at=is.null`
  console.log("request URL:", restUrl)
  const response = await fetch(restUrl, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  })
  const bodyText = await response.text()
  console.log("Test 3 status:", response.status, response.statusText)
  console.log("Test 3 body:", bodyText || "(empty)")

  if (response.ok) {
    await client.from("tasks").update({ deleted_at: null }).eq("id", targetId)
  }
}

async function main() {
  let targetId = taskIdArg

  if (!targetId) {
    const { data, error } = await client
      .from("tasks")
      .select("id, code, title, deleted_at")
      .is("deleted_at", null)
      .limit(1)

    logError("list tasks error", error)
    if (!data?.[0]) {
      console.log("No active tasks to test")
      return
    }
    targetId = data[0].id
  }

  await queryPgPoliciesViaPostgres()
  await runClientTests(targetId)
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
