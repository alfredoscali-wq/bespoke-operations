import { redirect } from "next/navigation"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

/** Timeline Operativo is now embedded in CUADRILLAS dossier. */
export default async function TimelineOperativoRedirectPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const next = new URLSearchParams()
  for (const key of [
    "date",
    "crewId",
    "crewName",
    "trail",
    "employeeId",
    "taskId",
  ]) {
    const value = first(params[key])?.trim()
    if (value) next.set(key, value)
  }
  const query = next.toString()
  redirect(query ? `/activity/cuadrillas?${query}` : "/activity/cuadrillas")
}
