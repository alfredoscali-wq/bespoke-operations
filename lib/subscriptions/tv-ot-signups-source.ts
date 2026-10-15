import "server-only"

import {
  excludeAbnetPadronRows,
  type AbnetPadronExclusion,
} from "@/lib/subscriptions/abnet-tv-padron-exclusions"
import {
  loadAbnetTvPadronSourceRows,
  loadActiveAbnetTvPadronExclusions,
  padronTableMissing,
} from "@/lib/subscriptions/abnet-tv-padron-source"
import {
  abnetPadronCustomerNumber,
  ABNET_TV_PADRON_SOURCE,
} from "@/lib/subscriptions/abnet-tv-padron"
import {
  bespokeCliCustomerNumber,
  isTvOtPlanKind,
  isTvOtSignupWindow,
  matchPadronIdentity,
  presentTvOtSignup,
  TV_OT_QUEUE_STATUSES,
  TV_OT_SIGNUP_FROM,
  TV_OT_SIGNUP_SERVICE,
  TV_OT_SIGNUP_UNTIL,
  verifiedAbnetNumber,
  type TvOtPadronMatchRow,
  type TvOtProposalFact,
  type TvOtQueueStatus,
  type TvOtSignupFact,
  type TvOtSignupItem,
} from "@/lib/subscriptions/tv-ot-signups"

const PAGE = 1000

type LooseResult = {
  data: Record<string, unknown>[] | null
  error: { code?: string; message: string } | null
}

type LooseFilter = {
  eq: (column: string, value: string) => LooseFilter
  is: (column: string, value: null) => LooseFilter
  gte: (column: string, value: string) => LooseFilter
  lt: (column: string, value: string) => LooseFilter
  in: (column: string, values: string[]) => LooseFilter
  order: (column: string, options?: { ascending: boolean }) => LooseFilter
  range: (from: number, to: number) => Promise<LooseResult>
}

function looseDb(client: unknown) {
  return client as {
    from: (table: string) => { select: (columns: string) => LooseFilter }
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function readPages(
  read: (from: number, to: number) => Promise<LooseResult>
): Promise<{ rows: Record<string, unknown>[] | null; error: LooseResult["error"] }> {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1)
    if (error) return { rows: null, error }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return { rows, error: null }
}

function queueStatus(value: unknown): TvOtQueueStatus | null {
  return TV_OT_QUEUE_STATUSES.includes(value as TvOtQueueStatus)
    ? (value as TvOtQueueStatus)
    : null
}

function proposalFrom(row: Record<string, unknown>): TvOtProposalFact | null {
  const status = queueStatus(row.status)
  if (!status) return null
  const kind = row.tv_kind
  const sourceRow = Number(row.padron_source_row)
  return {
    status,
    tvKind: isTvOtPlanKind(kind) ? kind : null,
    excludedAt: text(row.excluded_at) || null,
    excludedBy: text(row.excluded_by) || null,
    incorporatedAt: text(row.incorporated_at) || null,
    incorporatedBy: text(row.incorporated_by) || null,
    padronSource: text(row.padron_source) || null,
    padronSourceRow: Number.isInteger(sourceRow) && sourceRow > 0 ? sourceRow : null,
  }
}

export type TvOtSignupFeed = {
  persistenceAvailable: boolean
  error: string | null
  items: TvOtSignupItem[]
  facts: TvOtSignupFact[]
}

export async function loadTvOtSignupFeed(
  client: unknown,
  companyId: string,
  auditClient: unknown
): Promise<TvOtSignupFeed> {
  const tasks = await readPages((from, to) =>
    looseDb(client)
      .from("tasks")
      .select("id, code, customer_id, status, created_at, contracted_plan, service_type")
      .eq("company_id", companyId)
      .eq("service_type", TV_OT_SIGNUP_SERVICE)
      .is("deleted_at", null)
      .gte("created_at", TV_OT_SIGNUP_FROM)
      .lt("created_at", TV_OT_SIGNUP_UNTIL)
      .order("created_at", { ascending: true })
      .range(from, to)
  )
  if (tasks.error || !tasks.rows) {
    return {
      persistenceAvailable: false,
      error: tasks.error?.message ?? "No se pudieron leer las órdenes de trabajo.",
      items: [],
      facts: [],
    }
  }

  const taskRows = tasks.rows.filter(
    (row) => text(row.service_type) === TV_OT_SIGNUP_SERVICE && isTvOtSignupWindow(text(row.created_at))
  )
  const customerIds = [...new Set(taskRows.map((row) => text(row.customer_id)).filter(Boolean))]
  const customers: Record<string, unknown>[] = []
  const audits: Record<string, unknown>[] = []
  for (let index = 0; index < customerIds.length; index += 80) {
    const slice = customerIds.slice(index, index + 80)
    const customerPage = await looseDb(client)
      .from("customers")
      .select("id, customer_number, name, status, external_customer_code")
      .eq("company_id", companyId)
      .in("id", slice)
      .range(0, slice.length - 1)
    if (customerPage.error) {
      return {
        persistenceAvailable: false,
        error: customerPage.error.message,
        items: [],
        facts: [],
      }
    }
    customers.push(...(customerPage.data ?? []))
    // Authenticated roles have no SELECT policy on system_audit_log.
    // The service client is limited to this company and these customer ids.
    const auditPage = await looseDb(auditClient)
      .from("system_audit_log")
      .select("entity_id, metadata, created_at")
      .eq("company_id", companyId)
      .eq("action", "CUSTOMER_ACTIVATE")
      .in("entity_id", slice)
      .order("created_at", { ascending: true })
      .range(0, PAGE - 1)
    if (auditPage.error) {
      return {
        persistenceAvailable: false,
        error: auditPage.error.message,
        items: [],
        facts: [],
      }
    }
    audits.push(...(auditPage.data ?? []))
  }

  const customerById = new Map(customers.map((row) => [text(row.id), row]))
  const activationByCustomer = new Map<string, string | null>()
  for (const row of audits) {
    const customerId = text(row.entity_id)
    const metadata = row.metadata
    const previous =
      metadata && typeof metadata === "object" && "previousStatus" in metadata
        ? text((metadata as { previousStatus?: unknown }).previousStatus)
        : ""
    if (previous === "pendiente-activacion") activationByCustomer.set(customerId, previous)
    else if (!activationByCustomer.has(customerId)) activationByCustomer.set(customerId, previous || null)
  }

  const [padron, exclusions] = await Promise.all([
    loadAbnetTvPadronSourceRows(client, companyId),
    loadActiveAbnetTvPadronExclusions(client, companyId),
  ])
  if (padron.error) {
    return { persistenceAvailable: false, error: padron.error.message, items: [], facts: [] }
  }
  if (exclusions.error && !exclusions.missing) {
    return { persistenceAvailable: false, error: exclusions.error.message, items: [], facts: [] }
  }
  const visible = excludeAbnetPadronRows(padron.rows, exclusions.exclusions, companyId)
  const matchRows: TvOtPadronMatchRow[] = visible.flatMap((row) => {
    const number =
      abnetPadronCustomerNumber(row.abnetCustomerNumber) ??
      bespokeCliCustomerNumber(row.abnetCustomerNumber)
    if (!number) return []
    return [
      {
        number,
        name: row.customerName,
        planName: row.planName,
        tvAmount: row.tvAmount,
        source: row.source || ABNET_TV_PADRON_SOURCE,
        sourceRow: row.sourceRow,
      },
    ]
  })

  const proposals = await readPages((from, to) =>
    looseDb(client)
      .from("tv_ot_signup_proposals")
      .select(
        "customer_id, task_id, status, tv_kind, abnet_customer_number, padron_source, padron_source_row, incorporated_at, incorporated_by, excluded_at, excluded_by"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .range(from, to)
  )
  const persistenceAvailable = !proposals.error
  const proposalByTask = new Map<string, TvOtProposalFact>()
  if (proposals.error && !padronTableMissing(proposals.error) && !missingProposalTable(proposals.error)) {
    return {
      persistenceAvailable: false,
      error: proposals.error.message,
      items: [],
      facts: [],
    }
  }
  for (const row of proposals.rows ?? []) {
    const taskId = text(row.task_id)
    const proposal = proposalFrom(row)
    if (taskId && proposal) proposalByTask.set(taskId, proposal)
  }

  const facts: TvOtSignupFact[] = []
  for (const task of taskRows) {
    const customerId = text(task.customer_id)
    const customer = customerById.get(customerId)
    if (!customerId || !customer) continue
    const abnetNumber = verifiedAbnetNumber(text(customer.external_customer_code))
    const matched = matchPadronIdentity({
      abnetNumber,
      customerNumber: text(customer.customer_number),
      customerName: text(customer.name),
      rows: matchRows,
    })
    facts.push({
      taskId: text(task.id),
      taskCode: text(task.code),
      taskCreatedAt: text(task.created_at),
      taskStatus: text(task.status),
      contractedPlan: text(task.contracted_plan) || null,
      customerId,
      customerNumber: text(customer.customer_number),
      customerName: text(customer.name),
      customerStatus: text(customer.status) || null,
      abnetNumber,
      activationPreviousStatus: activationByCustomer.get(customerId) ?? null,
      padronExact: matched.exact,
      possibleMatchNumbers: matched.possibleMatchNumbers,
      proposal: proposalByTask.get(text(task.id)) ?? null,
    })
  }

  return {
    persistenceAvailable,
    error: null,
    facts,
    items: facts.flatMap((fact) => {
      const item = presentTvOtSignup(fact)
      return item ? [item] : []
    }),
  }
}

function missingProposalTable(error: { code?: string; message: string } | null): boolean {
  const message = error?.message ?? ""
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes("tv_ot_signup_proposals")
  )
}

/** One OT, its customer and its proposal. Skips the full padrón scan so a plan edit can answer quickly. */
export async function loadTvOtSignupCase(
  client: unknown,
  companyId: string,
  taskId: string
): Promise<
  | { ok: true; fact: TvOtSignupFact; item: TvOtSignupItem }
  | { ok: false; message: string }
> {
  const taskPage = await looseDb(client)
    .from("tasks")
    .select("id, code, customer_id, status, created_at, contracted_plan, service_type")
    .eq("company_id", companyId)
    .eq("id", taskId)
    .is("deleted_at", null)
    .range(0, 0)
  if (taskPage.error) return { ok: false, message: taskPage.error.message }
  const task = taskPage.data?.[0]
  if (
    !task ||
    text(task.service_type) !== TV_OT_SIGNUP_SERVICE ||
    !isTvOtSignupWindow(text(task.created_at))
  ) {
    return { ok: false, message: "Esa OT no está en las altas de octubre." }
  }

  const customerId = text(task.customer_id)
  const customerPage = await looseDb(client)
    .from("customers")
    .select("id, customer_number, name, status, external_customer_code")
    .eq("company_id", companyId)
    .eq("id", customerId)
    .range(0, 0)
  if (customerPage.error) return { ok: false, message: customerPage.error.message }
  const customer = customerPage.data?.[0]
  if (!customer) return { ok: false, message: "Esa OT no está en las altas de octubre." }

  const proposalPage = await looseDb(client)
    .from("tv_ot_signup_proposals")
    .select(
      "customer_id, task_id, status, tv_kind, abnet_customer_number, padron_source, padron_source_row, incorporated_at, incorporated_by, excluded_at, excluded_by"
    )
    .eq("company_id", companyId)
    .eq("task_id", taskId)
    .range(0, 0)
  if (proposalPage.error) {
    return {
      ok: false,
      message: missingProposalTable(proposalPage.error)
        ? "La cola de altas de TV todavía no está disponible."
        : proposalPage.error.message,
    }
  }

  const fact: TvOtSignupFact = {
    taskId,
    taskCode: text(task.code),
    taskCreatedAt: text(task.created_at),
    taskStatus: text(task.status),
    contractedPlan: text(task.contracted_plan) || null,
    customerId,
    customerNumber: text(customer.customer_number),
    customerName: text(customer.name),
    customerStatus: text(customer.status) || null,
    abnetNumber: verifiedAbnetNumber(text(customer.external_customer_code)),
    activationPreviousStatus: null,
    padronExact: null,
    possibleMatchNumbers: [],
    proposal: proposalPage.data?.[0] ? proposalFrom(proposalPage.data[0]) : null,
  }
  if (fact.proposal?.status === "excluded") {
    return { ok: false, message: "Esta propuesta fue excluida de la lista." }
  }
  const item = presentTvOtSignup(fact)
  if (!item) return { ok: false, message: "Esta propuesta fue excluida de la lista." }
  return { ok: true, fact, item }
}

export function findTvOtSignupFact(
  feed: TvOtSignupFeed,
  taskId: string
): { fact: TvOtSignupFact; item: TvOtSignupItem } | null {
  const fact = feed.facts.find((row) => row.taskId === taskId) ?? null
  if (!fact) return null
  const item = presentTvOtSignup(fact)
  if (!item) return { fact, item: presentExcludedPlaceholder(fact) }
  return { fact, item }
}

function presentExcludedPlaceholder(fact: TvOtSignupFact): TvOtSignupItem {
  const visible = presentTvOtSignup({ ...fact, proposal: null })
  if (!visible) {
    throw new Error("La propuesta excluida no pudo reconstruirse.")
  }
  return { ...visible, canEditPlan: false, canIncorporate: false, canExclude: false }
}

export type { AbnetPadronExclusion }
