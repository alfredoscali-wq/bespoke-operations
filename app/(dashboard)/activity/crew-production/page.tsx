import { redirect } from "next/navigation"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function CrewProductionRedirectPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const next = new URLSearchParams()
  for (const key of [
    "date",
    "dateFrom",
    "dateTo",
    "crewId",
    "crewName",
    "trail",
    "period",
    "taskId",
  ]) {
    const value = first(params[key])?.trim()
    if (value) next.set(key, value)
  }
  if (!next.has("date") && first(params.date)) {
    next.set("date", first(params.date)!)
  }
  const query = next.toString()
  redirect(query ? `/activity/cuadrillas?${query}` : "/activity/cuadrillas")
}
