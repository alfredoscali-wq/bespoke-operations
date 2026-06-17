/**
 * TEMP diagnostic — run: node --env-file=.env.local scripts/diagnose-task-delete.mjs [taskId]
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const projectRef = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

console.log("=== Supabase environment ===")
console.log("NEXT_PUBLIC_SUPABASE_URL:", url ?? "(missing)")
console.log("project ref:", projectRef ?? "(unknown)")
console.log(
  "dashboard URL:",
  projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}`
    : "(unknown)"
)

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_* in environment")
  process.exit(1)
}

const client = createClient(url, key)
const taskId = process.argv[2]

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

async function main() {
  let targetId = taskId

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
    console.log("Using task:", data[0])
  }

  const payload = { deleted_at: new Date().toISOString() }

  console.log("\n--- Test A: update without .select() (current softDeleteTask) ---")
  const testA = await client
    .from("tasks")
    .update(payload)
    .eq("id", targetId)
    .is("deleted_at", null)
  logError("Test A error", testA.error)
  console.log("Test A data:", testA.data)
  console.log("Test A count:", testA.count)
  console.log("Test A status:", testA.status)
  console.log("Test A statusText:", testA.statusText)

  // Restore if A succeeded
  if (!testA.error) {
    await client.from("tasks").update({ deleted_at: null }).eq("id", targetId)
  }

  console.log("\n--- Test B: update with .select('id') (RETURNING + SELECT RLS) ---")
  const testB = await client
    .from("tasks")
    .update(payload)
    .eq("id", targetId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()
  logError("Test B error", testB.error)
  console.log("Test B data:", testB.data)

  if (!testB.error && testB.data) {
    await client.from("tasks").update({ deleted_at: null }).eq("id", targetId)
  }

  console.log("\n--- Test C: update with Prefer return=minimal (raw fetch) ---")
  const restUrl = `${url}/rest/v1/tasks?id=eq.${targetId}&deleted_at=is.null`
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
  console.log("Test C status:", response.status, response.statusText)
  console.log("Test C body:", bodyText || "(empty)")

  if (response.ok) {
    await client.from("tasks").update({ deleted_at: null }).eq("id", targetId)
  }
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
