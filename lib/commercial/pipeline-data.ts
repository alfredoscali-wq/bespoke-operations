import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  daysSinceIso,
  resolvePipelineDayBounds,
} from "@/lib/commercial/pipeline"
import { resolveCommercialPersonDisplayName } from "@/lib/supabase/commercial.mapper"
import type {
  CommercialPriorityCode,
  CommercialSourceCode,
  CommercialStatusCode,
} from "@/lib/commercial/catalogs"
import type { CommercialPipelineCard } from "@/lib/types/commercial-pipeline"

function employeeDisplayName(row: {
  first_name?: string | null
  last_name?: string | null
  preferred_name?: string | null
} | null): string {
  if (!row) return "Sin responsable"
  const preferred = row.preferred_name?.trim() ?? ""
  if (preferred) return preferred
  return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Sin responsable"
}

export async function fetchCommercialPipelineCards(
  companyId: string
): Promise<CommercialPipelineCard[]> {
  const admin = createAdminClient()
  const bounds = resolvePipelineDayBounds()

  const { data: opportunityRows, error } = await admin
    .from("commercial_opportunities")
    .select(
      `
      id,
      code,
      title,
      status,
      priority,
      source,
      created_at,
      assigned_employee_id,
      person_id,
      person:commercial_people (
        person_type,
        first_name,
        last_name,
        company_name
      ),
      assignee:employees!commercial_opportunities_assigned_employee_id_fkey (
        first_name,
        last_name,
        preferred_name
      )
    `
    )
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (error) {
    throw new Error(error.message)
  }

  const opportunities = opportunityRows ?? []
  const opportunityIds = opportunities.map((row) => row.id)

  const lastActivityByOpp = new Map<string, string>()
  const overdueByOpp = new Set<string>()
  const todayByOpp = new Set<string>()

  if (opportunityIds.length > 0) {
    const [{ data: activities }, { data: commitments }] = await Promise.all([
      admin
        .from("commercial_activities")
        .select("opportunity_id, created_at, completed_at")
        .eq("company_id", companyId)
        .in("opportunity_id", opportunityIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      admin
        .from("commercial_commitments")
        .select("opportunity_id, due_at, status")
        .eq("company_id", companyId)
        .in("opportunity_id", opportunityIds)
        .in("status", ["pending", "in_progress"])
        .is("deleted_at", null),
    ])

    for (const activity of activities ?? []) {
      if (lastActivityByOpp.has(activity.opportunity_id)) continue
      lastActivityByOpp.set(
        activity.opportunity_id,
        activity.completed_at ?? activity.created_at
      )
    }

    for (const commitment of commitments ?? []) {
      const dueAt = commitment.due_at
      if (dueAt < bounds.dayStartIso) {
        overdueByOpp.add(commitment.opportunity_id)
      } else if (dueAt <= bounds.dayEndIso) {
        todayByOpp.add(commitment.opportunity_id)
      }
    }
  }

  return opportunities.map((row) => {
    const person = Array.isArray(row.person) ? row.person[0] : row.person
    const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee
    const personName = resolveCommercialPersonDisplayName({
      personType: (person?.person_type as "individual" | "company") ?? "individual",
      firstName: person?.first_name ?? "",
      lastName: person?.last_name ?? "",
      companyName: person?.company_name ?? "",
    })
    const companyName =
      person?.person_type === "company"
        ? ""
        : person?.company_name?.trim() || ""
    const lastActivityAt = lastActivityByOpp.get(row.id) ?? null
    const referenceActivity = lastActivityAt ?? row.created_at

    return {
      id: row.id,
      code: row.code,
      title: row.title,
      status: row.status as CommercialStatusCode,
      priority: row.priority as CommercialPriorityCode,
      source: row.source as CommercialSourceCode,
      createdAt: row.created_at,
      assignedEmployeeId: row.assigned_employee_id,
      personId: row.person_id,
      personName,
      companyName,
      responsibleName: employeeDisplayName(assignee ?? null),
      lastActivityAt,
      daysSinceLastActivity: daysSinceIso(referenceActivity),
      hasOverdueCommitment: overdueByOpp.has(row.id),
      hasTodayCommitment: todayByOpp.has(row.id),
      isDerived: row.source === "atencion_cliente",
    }
  })
}
