/**
 * TEMP — direct Postgres audit for tasks RLS + REST comparison
 * Run: node --env-file=.env.local scripts/audit-tasks-direct-db.mjs
 * Requires DATABASE_URL or SUPABASE_DB_URL (Dashboard → Settings → Database → URI)
 */
import pg from "pg"

const dbUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL
const restUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
const restKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function maskKey(value) {
  if (!value || value.length < 8) return "(missing)"
  return `${value.slice(0, 6)}...${value.slice(-4)} (length=${value.length})`
}

function printSection(title) {
  console.log(`\n${"=".repeat(72)}`)
  console.log(title)
  console.log("=".repeat(72))
}

function printRows(label, rows) {
  console.log(`\n--- ${label} (${rows.length} row(s)) ---`)
  console.log(JSON.stringify(rows, null, 2))
}

async function rawRestPatch(taskId, body) {
  const requestUrl = `${restUrl}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&deleted_at=is.null`
  const response = await fetch(requestUrl, {
    method: "PATCH",
    headers: {
      apikey: restKey,
      Authorization: `Bearer ${restKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  return {
    requestUrl,
    status: response.status,
    statusText: response.statusText,
    sbProjectRef: response.headers.get("sb-project-ref"),
    proxyStatus: response.headers.get("proxy-status"),
    body: text,
  }
}

async function runPostgresAudit(client) {
  printSection("POSTGRES — relrowsecurity / relforcerowsecurity")
  const rlsFlags = await client.query(`
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'tasks'
  `)
  printRows("pg_class", rlsFlags.rows)

  printSection("POSTGRES — pg_trigger on public.tasks")
  const triggers = await client.query(`
    SELECT *
    FROM pg_trigger
    WHERE tgrelid = 'public.tasks'::regclass
      AND NOT tgisinternal
    ORDER BY tgname
  `)
  printRows("pg_trigger", triggers.rows)

  printSection("POSTGRES — pg_policies on public.tasks")
  const policies = await client.query(`
    SELECT *
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasks'
    ORDER BY policyname, cmd
  `)
  printRows("pg_policies", policies.rows)

  printSection("POSTGRES — grants on public.tasks")
  const grants = await client.query(`
    SELECT grantee, privilege_type, is_grantable
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND grantee IN ('anon', 'authenticated', 'postgres', 'service_role')
    ORDER BY grantee, privilege_type
  `)
  printRows("role_table_grants", grants.rows)

  printSection("POSTGRES — create temp task + soft delete as postgres")
  await client.query("BEGIN")
  try {
    const insert = await client.query(`
      INSERT INTO public.tasks (
        code, title, description, project_code, project_name,
        type, status, priority, supervisor, crew,
        start_date, due_date, company_id
      )
      SELECT
        'TSK-AUDIT-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
        'AUDIT TEMP TASK',
        'Temporary row for delete RLS audit',
        p.code, p.name,
        'maintenance', 'pendiente', 'baja',
        'Audit', 'Audit',
        CURRENT_DATE, CURRENT_DATE,
        p.company_id
      FROM public.projects p
      WHERE p.deleted_at IS NULL
      LIMIT 1
      RETURNING id, code, title, deleted_at
    `)
    printRows("insert temp task", insert.rows)
    const taskId = insert.rows[0]?.id
    if (!taskId) throw new Error("Insert did not return task id")

    const pgUpdate = await client.query(
      `UPDATE public.tasks SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id, code, deleted_at`,
      [taskId]
    )
    printRows("postgres UPDATE deleted_at", pgUpdate.rows)

    printSection("POSTGRES — SET ROLE anon UPDATE deleted_at on active task")
    const activeTask = await client.query(`
      SELECT id, code FROM public.tasks
      WHERE deleted_at IS NULL AND id <> $1
      ORDER BY created_at DESC LIMIT 1
    `, [taskId])
    printRows("active task for role simulation", activeTask.rows)

    if (activeTask.rows[0]) {
      const anonId = activeTask.rows[0].id
      try {
        await client.query("SAVEPOINT anon_test")
        await client.query("SET LOCAL ROLE anon")
        const anonUpdate = await client.query(
          `UPDATE public.tasks SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
          [anonId]
        )
        await client.query("ROLLBACK TO SAVEPOINT anon_test")
        printRows("anon UPDATE deleted_at (within transaction)", anonUpdate.rows)
      } catch (err) {
        await client.query("ROLLBACK TO SAVEPOINT anon_test")
        console.log("\n--- anon UPDATE deleted_at FAILED ---")
        console.log(JSON.stringify({ message: err.message, code: err.code }, null, 2))
      }
      await client.query("RESET ROLE")
    }

    await client.query("ROLLBACK")
    console.log("\n(postgres audit transaction rolled back — temp row not persisted)")
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  }
}

async function runRestComparison() {
  if (!restUrl || !restKey) {
    console.log("\nREST comparison skipped: missing NEXT_PUBLIC_SUPABASE_*")
    return
  }

  printSection("REST — same project/key as app")
  console.log("NEXT_PUBLIC_SUPABASE_URL:", restUrl)
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY:", maskKey(restKey))

  const listRes = await fetch(
    `${restUrl}/rest/v1/tasks?select=id,code&deleted_at=is.null&limit=1`,
    {
      headers: {
        apikey: restKey,
        Authorization: `Bearer ${restKey}`,
        Accept: "application/json",
      },
    }
  )
  const listBody = await listRes.text()
  console.log("\n--- REST SELECT ---")
  console.log("status:", listRes.status, listRes.statusText)
  console.log("sb-project-ref:", listRes.headers.get("sb-project-ref"))
  console.log("body:", listBody)

  let taskId
  try {
    taskId = JSON.parse(listBody)?.[0]?.id
  } catch {
    taskId = undefined
  }
  if (!taskId) return

  const progressPatch = await rawRestPatch(taskId, { progress: 0 })
  console.log("\n--- REST PATCH progress ---")
  console.log(JSON.stringify(progressPatch, null, 2))

  const deletePatch = await rawRestPatch(taskId, {
    deleted_at: new Date().toISOString(),
  })
  console.log("\n--- REST PATCH deleted_at ---")
  console.log(JSON.stringify(deletePatch, null, 2))
}

async function main() {
  console.log("=== audit-tasks-direct-db ===")
  console.log("DATABASE_URL configured:", Boolean(dbUrl))

  if (dbUrl) {
    const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    try {
      const whoami = await pool.query("SELECT current_user, current_role, session_user")
      printRows("connection identity", whoami.rows)
      await runPostgresAudit(pool)
    } finally {
      await pool.end()
    }
  } else {
    printSection("POSTGRES audit skipped")
    console.log(
      "Add DATABASE_URL to .env.local (Supabase Dashboard → Settings → Database → Connection string URI)"
    )
    console.log("Or run supabase/scripts/audit_tasks_direct.sql in SQL Editor.")
  }

  await runRestComparison()
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
