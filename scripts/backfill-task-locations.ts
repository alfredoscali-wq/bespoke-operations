import { readFileSync } from "fs"
import { resolve } from "path"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { resolveLocation } from "@/lib/location/resolve-location"

type TaskRow = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "id" | "code" | "shared_location" | "latitude" | "longitude"
>

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local")
  const env = readFileSync(envPath, "utf8")
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    )
  }

  return { url, key }
}

async function main() {
  const { url, key } = loadEnv()
  const supabase = createClient<Database>(url, key)

  const { data, error } = await supabase
    .from("tasks")
    .select("id, code, shared_location, latitude, longitude")
    .is("deleted_at", null)
    .not("shared_location", "is", null)
    .neq("shared_location", "")
    .is("latitude", null)

  if (error) {
    throw new Error(`Failed to load tasks: ${error.message}`)
  }

  const tasks = (data ?? []) as TaskRow[]
  console.log(`Found ${tasks.length} tasks with shared_location and missing latitude.`)

  let resolvedCount = 0
  let failedCount = 0
  let skippedCount = 0

  for (const task of tasks) {
    const sharedLocation = task.shared_location?.trim()
    if (!sharedLocation) {
      skippedCount += 1
      continue
    }

    const result = await resolveLocation(sharedLocation)
    if (!result.ok) {
      failedCount += 1
      console.warn(
        `[FAIL] ${task.code} (${task.id}): ${result.message}`
      )
      continue
    }

    const { latitude, longitude, normalizedLocation, resolutionMethod } =
      result.data

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        latitude,
        longitude,
        shared_location: normalizedLocation,
        location_resolution_method: resolutionMethod,
      })
      .eq("id", task.id)

    if (updateError) {
      failedCount += 1
      console.warn(
        `[FAIL] ${task.code} (${task.id}): update error ${updateError.message}`
      )
      continue
    }

    resolvedCount += 1
    console.log(
      `[OK] ${task.code}: ${latitude}, ${longitude} (${resolutionMethod})`
    )
  }

  console.log("")
  console.log("Backfill complete.")
  console.log(`Resolved: ${resolvedCount}`)
  console.log(`Failed: ${failedCount}`)
  console.log(`Skipped: ${skippedCount}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
