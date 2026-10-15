import "server-only"

import {
  BESPOKE_OT_TV_PADRON_SOURCE,
  planTvOtSignupExclusion,
  planTvOtSignupIncorporation,
  planTvOtSignupPlanEdit,
  TV_OT_LATAM_STATUS,
  type TvOtSignupItem,
} from "@/lib/subscriptions/tv-ot-signups"
import {
  findTvOtSignupFact,
  loadTvOtSignupFeed,
  type TvOtSignupFeed,
} from "@/lib/subscriptions/tv-ot-signups-source"
import {
  insertBespokeOtTvPadronRow,
  nextBespokeOtTvSourceRow,
  saveTvOtSignupProposal,
  type TvOtProposalWrite,
} from "@/lib/subscriptions/tv-ot-signups-store"

type ActionResult =
  | { ok: true; message: string; item: TvOtSignupItem | null; incorporated: boolean }
  | { ok: false; status: number; message: string }

function failure(status: number, message: string): ActionResult {
  return { ok: false, status, message }
}

function persistenceProblem(error: { code?: string; message: string } | null): string | null {
  if (!error) return null
  const message = error.message ?? ""
  if (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    message.includes("tv_ot_signup_proposals") ||
    message.includes("schema cache")
  ) {
    return "La cola de altas de TV todavía no está disponible."
  }
  if (message.includes("tv_ot_padron_duplicate_number")) {
    return "El N° de abonado ya está en el padrón. No se insertó otra fila."
  }
  if (error.code === "23505") {
    return "Ya existe un registro para este caso. No se creó un duplicado."
  }
  if (message.includes("tv_ot_padron_incomplete")) {
    return "Faltan datos obligatorios del padrón. No se insertó la fila."
  }
  if (message.includes("tv_ot_padron_unverified_number")) {
    return "Ese N° ABNet no está asignado a un cliente de esta empresa. No se insertó la fila."
  }
  return message || "No se pudo guardar la alta de TV."
}

async function requireCase(
  client: unknown,
  companyId: string,
  auditClient: unknown,
  taskId: string
) {
  const feed = await loadTvOtSignupFeed(client, companyId, auditClient)
  if (feed.error) return { feed, found: null, error: failure(400, feed.error) }
  if (!feed.persistenceAvailable) {
    return {
      feed,
      found: null,
      error: failure(503, "La cola de altas de TV todavía no está disponible."),
    }
  }
  const found = findTvOtSignupFact(feed, taskId)
  if (!found) return { feed, found: null, error: failure(404, "Esa OT no está en las altas de octubre.") }
  return { feed, found, error: null }
}

async function reloadItem(
  client: unknown,
  companyId: string,
  auditClient: unknown,
  taskId: string
): Promise<TvOtSignupItem | null> {
  const feed = await loadTvOtSignupFeed(client, companyId, auditClient)
  return feed.items.find((item) => item.taskId === taskId) ?? null
}

async function writeProposal(
  client: unknown,
  input: TvOtProposalWrite & { exists: boolean }
): Promise<string | null> {
  const error = await saveTvOtSignupProposal(client, input)
  if (error?.code === "23505" && !input.exists) {
    const retried = await saveTvOtSignupProposal(client, { ...input, exists: true })
    return persistenceProblem(retried)
  }
  return persistenceProblem(error)
}

export async function readTvOtSignupList(
  client: unknown,
  companyId: string,
  auditClient: unknown
): Promise<
  | { ok: true; feed: TvOtSignupFeed }
  | { ok: false; status: number; message: string }
> {
  const feed = await loadTvOtSignupFeed(client, companyId, auditClient)
  if (feed.error) return { ok: false, status: 400, message: feed.error }
  return { ok: true, feed }
}

export async function editTvOtSignupPlan(
  client: unknown,
  companyId: string,
  auditClient: unknown,
  taskId: string,
  tvKind: unknown
): Promise<ActionResult> {
  const current = await requireCase(client, companyId, auditClient, taskId)
  if (current.error || !current.found) return current.error ?? failure(404, "Esa OT no está en las altas de octubre.")
  if (current.found.fact.proposal?.status === "excluded") {
    return failure(409, "Esta propuesta fue excluida de la lista.")
  }
  const decision = planTvOtSignupPlanEdit({ item: current.found.item, tvKind })
  if (decision.outcome === "rejected") return failure(400, decision.message)
  const proposal = current.found.fact.proposal
  const status =
    proposal?.status === "pending_required_data" || proposal?.status === "needs_review"
      ? proposal.status
      : "pending_review"
  const error = await writeProposal(client, {
    exists: proposal != null && proposal.status !== "excluded",
    companyId,
    customerId: current.found.fact.customerId,
    taskId,
    status,
    tvKind: decision.tvKind,
  })
  if (error) return failure(400, error)
  const item = await reloadItem(client, companyId, auditClient, taskId)
  if (!item || item.selectedTvKind !== decision.tvKind) {
    return failure(409, "El plan no quedó guardado.")
  }
  return { ok: true, message: "Plan de TV guardado.", item, incorporated: false }
}

export async function excludeTvOtSignup(
  client: unknown,
  companyId: string,
  auditClient: unknown,
  userId: string,
  taskId: string
): Promise<ActionResult> {
  if (!userId) return failure(400, "Usuario no resuelto para la sesión.")
  const current = await requireCase(client, companyId, auditClient, taskId)
  if (current.error || !current.found) return current.error ?? failure(404, "Esa OT no está en las altas de octubre.")
  const decision = planTvOtSignupExclusion({
    proposalStatus: current.found.fact.proposal?.status ?? null,
    incorporated: current.found.item.category === "incorporated",
  })
  if (decision.outcome === "rejected") return failure(409, decision.message)
  if (decision.outcome === "already_excluded") {
    return { ok: true, message: "La propuesta ya estaba fuera de la lista.", item: null, incorporated: false }
  }
  const now = new Date().toISOString()
  const error = await writeProposal(client, {
    exists: current.found.fact.proposal != null,
    companyId,
    customerId: current.found.fact.customerId,
    taskId,
    status: "excluded",
    tvKind: current.found.fact.proposal?.tvKind ?? null,
    excludedAt: now,
    excludedBy: userId,
  })
  if (error) return failure(400, error)
  const item = await reloadItem(client, companyId, auditClient, taskId)
  if (item) return failure(409, "La propuesta sigue visible. No se confirmó la exclusión.")
  return { ok: true, message: "La propuesta salió de la lista.", item: null, incorporated: false }
}

export async function incorporateTvOtSignup(
  client: unknown,
  companyId: string,
  auditClient: unknown,
  userId: string,
  taskId: string,
  acknowledgePossibleMatch: boolean
): Promise<ActionResult> {
  if (!userId) return failure(400, "Usuario no resuelto para la sesión.")
  const current = await requireCase(client, companyId, auditClient, taskId)
  if (current.error || !current.found) return current.error ?? failure(404, "Esa OT no está en las altas de octubre.")
  if (current.found.fact.proposal?.status === "excluded") {
    return failure(409, "Esta propuesta fue excluida de la lista.")
  }
  const decision = planTvOtSignupIncorporation({
    item: current.found.item,
    customerName: current.found.fact.customerName,
    acknowledgePossibleMatch,
  })
  if (decision.outcome === "rejected") return failure(409, decision.message)
  if (decision.outcome === "needs_review") return failure(409, decision.message)

  if (decision.outcome === "missing_abnet") {
    const error = await writeProposal(client, {
      exists: current.found.fact.proposal != null,
      companyId,
      customerId: current.found.fact.customerId,
      taskId,
      status: "pending_required_data",
      tvKind: decision.tvKind,
    })
    if (error) return failure(400, error)
    const item = await reloadItem(client, companyId, auditClient, taskId)
    if (!item || item.queueStatus !== "pending_required_data") {
      return failure(409, "No se pudo dejar la alta pendiente de N° ABNet.")
    }
    return { ok: true, message: decision.message, item, incorporated: false }
  }

  const next = await nextBespokeOtTvSourceRow(client, companyId)
  const nextError = persistenceProblem(next.error)
  if (nextError || next.sourceRow <= 0) {
    return failure(400, nextError ?? "No se pudo reservar la fila del padrón.")
  }
  const inserted = await insertBespokeOtTvPadronRow(client, {
    companyId,
    abnetCustomerNumber: decision.abnetNumber,
    customerName: decision.customerName,
    planName: decision.planName,
    tvAmount: decision.tvAmount,
    serviceType: decision.serviceType,
    sourceRow: next.sourceRow,
  })
  const insertError = persistenceProblem(inserted)
  if (insertError) return failure(409, insertError)

  const now = new Date().toISOString()
  const saved = await writeProposal(client, {
    exists: current.found.fact.proposal != null,
    companyId,
    customerId: current.found.fact.customerId,
    taskId,
    status: "incorporated",
    tvKind: decision.tvKind,
    abnetCustomerNumber: decision.abnetNumber,
    padronSource: BESPOKE_OT_TV_PADRON_SOURCE,
    padronSourceRow: next.sourceRow,
    incorporatedAt: now,
    incorporatedBy: userId,
  })
  if (saved) {
    return failure(
      409,
      "La fila del padrón se escribió, pero la cola no quedó actualizada. Recargue el listado antes de reintentar."
    )
  }
  const item = await reloadItem(client, companyId, auditClient, taskId)
  if (!item || item.category !== "incorporated") {
    return failure(409, "No se confirmó la incorporación en el listado.")
  }
  return {
    ok: true,
    message: "El cliente quedó incorporado al padrón de TV.",
    item,
    incorporated: true,
  }
}

export { TV_OT_LATAM_STATUS }
