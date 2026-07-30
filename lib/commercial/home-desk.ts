import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { fetchCommercialCommitmentsForDesk } from "@/lib/supabase/commercial-home.queries"
import { COMMERCIAL_ACTIVITY_TYPE_LABELS } from "@/lib/commercial/activity-catalogs"
import type { CommercialActivityTypeCode } from "@/lib/commercial/activity-catalogs"
import type { CommercialStatusCode } from "@/lib/commercial/catalogs"
import type { CommercialHomeDesk } from "@/lib/types/commercial-home"

const TIMEZONE = "America/Argentina/Buenos_Aires"
const OPEN_STATUSES: CommercialStatusCode[] = [
  "nueva",
  "contactada",
  "calificada",
  "propuesta_enviada",
  "negociacion",
]

function formatInTimeZone(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    ...options,
  }).format(date)
}

/** Calendar day bounds in Argentina as ISO UTC strings. */
export function resolveCommercialDeskDayBounds(reference = new Date()): {
  dayStartIso: string
  dayEndIso: string
  monthStartIso: string
  sevenDaysAgoIso: string
  todayKey: string
} {
  const todayKey = formatInTimeZone(reference, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  // Interpret local midnight Argentina as approximate UTC offsets via Date parsing.
  const dayStart = new Date(`${todayKey}T00:00:00-03:00`)
  const dayEnd = new Date(`${todayKey}T23:59:59.999-03:00`)
  const monthKey = todayKey.slice(0, 7)
  const monthStart = new Date(`${monthKey}-01T00:00:00-03:00`)
  const sevenDaysAgo = new Date(dayStart.getTime() - 7 * 24 * 60 * 60 * 1000)

  return {
    dayStartIso: dayStart.toISOString(),
    dayEndIso: dayEnd.toISOString(),
    monthStartIso: monthStart.toISOString(),
    sevenDaysAgoIso: sevenDaysAgo.toISOString(),
    todayKey,
  }
}

export function resolveCommercialGreeting(reference = new Date()): string {
  const hour = Number(
    formatInTimeZone(reference, { hour: "numeric", hour12: false })
  )
  if (hour < 12) return "Buenos días"
  if (hour < 19) return "Buenas tardes"
  return "Buenas noches"
}

function daysBetween(fromIso: string, to = new Date()): number {
  const from = new Date(fromIso).getTime()
  const diff = to.getTime() - from
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)))
}

function employeeName(row: {
  first_name?: string | null
  last_name?: string | null
  preferred_name?: string | null
} | null): string {
  if (!row) return "Usuario"
  const preferred = row.preferred_name?.trim() ?? ""
  if (preferred) return preferred
  return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Usuario"
}

function personName(row: {
  person_type?: string | null
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
} | null): string {
  if (!row) return "Cliente"
  if (row.person_type === "company" && row.company_name?.trim()) {
    return row.company_name.trim()
  }
  const full = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim()
  return full || row.company_name?.trim() || "Cliente"
}

export async function fetchCommercialHomeDesk(
  companyId: string,
  options?: { assignedEmployeeId?: string | null }
): Promise<CommercialHomeDesk> {
  const client = await createClient()
  const admin = createAdminClient()
  const bounds = resolveCommercialDeskDayBounds()
  const assignee = options?.assignedEmployeeId?.trim() || null

  const openCommitmentStatuses: Array<"pending" | "in_progress"> = [
    "pending",
    "in_progress",
  ]

  const [
    newOppsResult,
    overdueResult,
    todayResult,
    opportunitiesResult,
    derivationsResult,
    recentActivitiesResult,
  ] = await Promise.all([
    admin
      .from("commercial_opportunities")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .gte("created_at", bounds.dayStartIso)
      .lte("created_at", bounds.dayEndIso),
    fetchCommercialCommitmentsForDesk(client, companyId, {
      dueBefore: bounds.dayStartIso,
      statuses: openCommitmentStatuses,
      assignedEmployeeId: assignee,
      limit: 50,
    }),
    fetchCommercialCommitmentsForDesk(client, companyId, {
      dueFrom: bounds.dayStartIso,
      dueTo: bounds.dayEndIso,
      statuses: openCommitmentStatuses,
      assignedEmployeeId: assignee,
      limit: 50,
    }),
    admin
      .from("commercial_opportunities")
      .select("id, status, updated_at, created_at, code, person_id")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    admin
      .from("commercial_opportunities")
      .select(
        `
        id,
        code,
        source_atencion_id,
        seller_opened_at,
        created_at,
        updated_at,
        person:commercial_people (
          person_type,
          first_name,
          last_name,
          company_name
        )
      `
      )
      .eq("company_id", companyId)
      .eq("source", "atencion_cliente")
      .is("seller_opened_at", null)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(30),
    admin
      .from("commercial_activities")
      .select(
        `
        id,
        opportunity_id,
        title,
        description,
        created_at,
        completed_at,
        employee_id,
        metadata,
        activity_type:commercial_activity_types ( code, label ),
        opportunity:commercial_opportunities (
          code,
          status,
          person:commercial_people (
            person_type,
            first_name,
            last_name,
            company_name
          )
        ),
        employee:employees (
          first_name,
          last_name,
          preferred_name
        )
      `
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  const opportunities = opportunitiesResult.data ?? []
  const activeOpportunities = opportunities.filter((row) =>
    OPEN_STATUSES.includes(row.status as CommercialStatusCode)
  ).length
  const wonThisMonth = opportunities.filter(
    (row) =>
      row.status === "ganada" &&
      row.updated_at >= bounds.monthStartIso
  ).length
  const lostThisMonth = opportunities.filter(
    (row) =>
      row.status === "perdida" &&
      row.updated_at >= bounds.monthStartIso
  ).length

  const openIds = opportunities
    .filter((row) => OPEN_STATUSES.includes(row.status as CommercialStatusCode))
    .map((row) => row.id)

  let inactiveOver7Days = 0
  if (openIds.length > 0) {
    const { data: recentActivityRows } = await admin
      .from("commercial_activities")
      .select("opportunity_id, created_at")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("opportunity_id", openIds)
      .gte("created_at", bounds.sevenDaysAgoIso)

    const activeWithRecentActivity = new Set(
      (recentActivityRows ?? []).map((row) => row.opportunity_id)
    )
    inactiveOver7Days = openIds.filter(
      (id) => !activeWithRecentActivity.has(id)
    ).length
  }

  const overdueCommitments = overdueResult.data ?? []
  const todayCommitments = todayResult.data ?? []

  const opportunityIdsForCommitments = [
    ...new Set(
      [...overdueCommitments, ...todayCommitments].map(
        (entry) => entry.opportunityId
      )
    ),
  ]

  const { data: commitmentOppRows } =
    opportunityIdsForCommitments.length > 0
      ? await admin
          .from("commercial_opportunities")
          .select(
            `
            id,
            code,
            person:commercial_people (
              person_type,
              first_name,
              last_name,
              company_name
            )
          `
          )
          .in("id", opportunityIdsForCommitments)
      : { data: [] as Array<{
          id: string
          code: string
          person: {
            person_type: string | null
            first_name: string | null
            last_name: string | null
            company_name: string | null
          } | null
        }> }

  const oppMeta = new Map(
    (commitmentOppRows ?? []).map((row) => [
      row.id,
      {
        code: row.code,
        personName: personName(
          Array.isArray(row.person) ? row.person[0] : row.person
        ),
      },
    ])
  )

  const mapCommitment = (
    entry: (typeof overdueCommitments)[number],
    withOverdue: boolean
  ) => {
    const meta = oppMeta.get(entry.opportunityId)
    return {
      commitmentId: entry.id,
      opportunityId: entry.opportunityId,
      opportunityCode: meta?.code ?? "",
      personName: meta?.personName ?? "Cliente",
      title: entry.title,
      dueAt: entry.dueAt,
      daysOverdue: withOverdue ? daysBetween(entry.dueAt) : null,
      priority: entry.priority,
      assignedEmployeeId: entry.assignedEmployeeId,
    }
  }

  const derivationRows = derivationsResult.data ?? []
  const derivationOppIds = derivationRows.map((row) => row.id)

  const { data: derivationActivities } =
    derivationOppIds.length > 0
      ? await admin
          .from("commercial_activities")
          .select(
            `
            opportunity_id,
            created_at,
            description,
            metadata,
            employee_id,
            employee:employees (
              first_name,
              last_name,
              preferred_name
            ),
            activity_type:commercial_activity_types ( code )
          `
          )
          .eq("company_id", companyId)
          .in("opportunity_id", derivationOppIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
      : { data: [] as never[] }

  const latestDerivationByOpp = new Map<
    string,
    {
      created_at: string
      description: string
      metadata: Record<string, unknown> | null
      employee_id: string | null
      employee: {
        first_name: string | null
        last_name: string | null
        preferred_name: string | null
      } | null
    }
  >()

  for (const row of derivationActivities ?? []) {
    const type = Array.isArray(row.activity_type)
      ? row.activity_type[0]
      : row.activity_type
    if (type?.code !== "derivacion") continue
    if (latestDerivationByOpp.has(row.opportunity_id)) continue
    const employee = Array.isArray(row.employee) ? row.employee[0] : row.employee
    latestDerivationByOpp.set(row.opportunity_id, {
      created_at: row.created_at,
      description: row.description ?? "",
      metadata: (row.metadata ?? null) as Record<string, unknown> | null,
      employee_id: row.employee_id,
      employee: employee ?? null,
    })
  }

  const newDerivations = derivationRows.map((row) => {
    const person = Array.isArray(row.person) ? row.person[0] : row.person
    const activity = latestDerivationByOpp.get(row.id)
    const meta = activity?.metadata ?? {}
    const reason =
      (typeof meta.reason === "string" && meta.reason) ||
      activity?.description ||
      "Derivación desde Atención al Cliente"
    const derivedByName =
      (typeof meta.derivedByName === "string" && meta.derivedByName) ||
      employeeName(activity?.employee ?? null)

    return {
      opportunityId: row.id,
      opportunityCode: row.code,
      personName: personName(person),
      companyName:
        person?.person_type === "company"
          ? ""
          : person?.company_name?.trim() || "",
      derivedAt: activity?.created_at ?? row.updated_at ?? row.created_at,
      derivedByEmployeeId: activity?.employee_id ?? null,
      derivedByName,
      reason,
      atencionId: row.source_atencion_id,
    }
  })

  const recentActivity = (recentActivitiesResult.data ?? []).map((row) => {
    const type = Array.isArray(row.activity_type)
      ? row.activity_type[0]
      : row.activity_type
    const opportunity = Array.isArray(row.opportunity)
      ? row.opportunity[0]
      : row.opportunity
    const person = opportunity
      ? Array.isArray(opportunity.person)
        ? opportunity.person[0]
        : opportunity.person
      : null
    const employee = Array.isArray(row.employee) ? row.employee[0] : row.employee
    const code = (type?.code ?? "sistema") as CommercialActivityTypeCode

    return {
      id: row.id,
      opportunityId: row.opportunity_id,
      opportunityCode: opportunity?.code ?? "",
      personName: personName(person),
      activityTypeCode: code,
      activityTypeLabel:
        type?.label ||
        COMMERCIAL_ACTIVITY_TYPE_LABELS[code] ||
        "Actividad",
      title: row.title,
      description: row.description ?? "",
      occurredAt: row.completed_at ?? row.created_at,
      employeeName: employeeName(employee),
      status: (opportunity?.status as CommercialStatusCode) ?? null,
    }
  })

  return {
    daySummary: {
      newOpportunities: newOppsResult.count ?? 0,
      commitmentsToday: todayCommitments.length,
      commitmentsOverdue: overdueCommitments.length,
    },
    newDerivations,
    overdueCommitments: overdueCommitments.map((entry) =>
      mapCommitment(entry, true)
    ),
    todayCommitments: todayCommitments.map((entry) =>
      mapCommitment(entry, false)
    ),
    kpis: {
      activeOpportunities,
      wonThisMonth,
      lostThisMonth,
      inactiveOver7Days,
    },
    recentActivity,
  }
}
