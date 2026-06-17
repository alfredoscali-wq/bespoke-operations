/**
 * TEMP — raw HTTP isolation for task delete RLS
 * Run: node --env-file=.env.local scripts/isolate-task-delete-raw.mjs [taskId]
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const taskIdArg = process.argv[2]

function maskKey(value) {
  if (!value || value.length < 8) return "(missing or too short)"
  return `${value.slice(0, 6)}...${value.slice(-4)} (length=${value.length})`
}

function projectRefFromUrl(supabaseUrl) {
  return supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "(unknown)"
}

function printEnv() {
  const ref = projectRefFromUrl(url)
  console.log("=== Environment (same as app) ===")
  console.log("NEXT_PUBLIC_SUPABASE_URL:", url ?? "(missing)")
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY:", maskKey(key))
  console.log("project ref detected:", ref)
  console.log(
    "dashboard URL:",
    ref !== "(unknown)" ? `https://supabase.com/dashboard/project/${ref}` : "(unknown)"
  )
  console.log("")
}

function headersToObject(headers) {
  const out = {}
  headers.forEach((value, name) => {
    out[name] = value
  })
  return out
}

async function rawRequest(label, { method, path, query = "", body = null, prefer = null }) {
  const requestUrl = `${url}${path}${query}`
  const requestHeaders = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  }

  if (body !== null) {
    requestHeaders["Content-Type"] = "application/json"
  }
  if (prefer) {
    requestHeaders.Prefer = prefer
  }

  console.log(`\n${"=".repeat(72)}`)
  console.log(label)
  console.log("=".repeat(72))
  console.log("\n--- REQUEST ---")
  console.log("method:", method)
  console.log("url:", requestUrl)
  console.log("headers:", JSON.stringify(requestHeaders, null, 2))
  console.log("body:", body === null ? "(none)" : JSON.stringify(body))

  const response = await fetch(requestUrl, {
    method,
    headers: requestHeaders,
    body: body === null ? undefined : JSON.stringify(body),
  })

  const responseHeaders = headersToObject(response.headers)
  const responseText = await response.text()

  console.log("\n--- RESPONSE ---")
  console.log("status:", response.status)
  console.log("statusText:", response.statusText)
  console.log("headers:", JSON.stringify(responseHeaders, null, 2))
  console.log("body:", responseText === "" ? "(empty)" : responseText)

  return {
    ok: response.ok,
    status: response.status,
    body: responseText,
    headers: responseHeaders,
  }
}

async function main() {
  printEnv()

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
    process.exit(1)
  }

  let taskId = taskIdArg

  if (!taskId) {
    const client = createClient(url, key)
    const { data, error, status, statusText } = await client
      .from("tasks")
      .select("id, code, title, deleted_at, progress")
      .is("deleted_at", null)
      .limit(1)

    console.log("=== Bootstrap: pick first active task (supabase-js) ===")
    console.log("supabase-js status:", status, statusText)
    console.log("supabase-js error:", error ? JSON.stringify(error) : "(none)")
    console.log("supabase-js data:", JSON.stringify(data))

    if (!data?.[0]?.id) {
      console.error("No active task found to test")
      process.exit(1)
    }

    taskId = data[0].id
    console.log("selected taskId:", taskId)
  }

  const encodedId = encodeURIComponent(taskId)

  const selectResult = await rawRequest("STEP 1 — SELECT one task", {
    method: "GET",
    path: "/rest/v1/tasks",
    query: `?select=id,code,title,deleted_at,progress&id=eq.${encodedId}&deleted_at=is.null`,
  })

  let progressValue = 0
  try {
    const rows = JSON.parse(selectResult.body)
    if (Array.isArray(rows) && rows[0] && typeof rows[0].progress === "number") {
      progressValue = rows[0].progress
    }
  } catch {
    // keep default
  }

  await rawRequest("STEP 2 — UPDATE progress = progress (same value, no semantic change)", {
    method: "PATCH",
    path: "/rest/v1/tasks",
    query: `?id=eq.${encodedId}&deleted_at=is.null`,
    body: { progress: progressValue },
    prefer: "return=representation",
  })

  await rawRequest("STEP 3 — UPDATE deleted_at = now() (soft delete)", {
    method: "PATCH",
    path: "/rest/v1/tasks",
    query: `?id=eq.${encodedId}&deleted_at=is.null`,
    body: { deleted_at: new Date().toISOString() },
    prefer: "return=minimal",
  })

  console.log("\n=== Done ===")
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
