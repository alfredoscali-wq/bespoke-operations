import {
  ISP_BILLING_RUN_CANCELLED_REVIEW,
  ISP_BILLING_RUN_INCONSISTENT,
  ISP_BILLING_RUN_ISSUER_INCOMPLETE,
  ISP_BILLING_RUN_MISSING_FISCAL,
  ISP_BILLING_RUN_MISSING_PRICE,
  ISP_BILLING_RUN_POS_MISSING,
  ISP_BILLING_RUN_TYPE_UNDETERMINED,
  type IspBillingDocumentType,
} from "@/lib/isp/billing-constants"
import {
  roundBillingMoney,
  snapshotCustomerFromRecord,
} from "@/lib/isp/billing-document-integrity"
import { isValidArCuit, normalizeCuitDigits } from "@/lib/isp/billing-integrity"
import {
  billingPeriodEndIso,
  billingPeriodLabel,
  billingPeriodStartIso,
  calculateMonthlyProration,
  isValidBillingPeriod,
  previousBillingPeriod,
  type BillingPeriod,
} from "@/lib/isp/billing-proration"
import type {
  DetermineDocumentTypeInput,
  IspBillingRunConcept,
  IspBillingRunGroup,
  IspBillingRunItem,
  IspBillingRunItemStatus,
  IspBillingRunTypeSummary,
  IspBillingServiceForRun,
} from "@/lib/isp/billing-run-types"
import type { VisualTone } from "@/lib/ui/visual-tokens"

export type ServicePeriodEvaluation = {
  include: boolean
  monthlyAmount: number
  proportionalDays: number
  proportionalAmount: number
  proportionalPeriodLabel: string
  concepts: IspBillingRunConcept[]
  errorCode: string | null
  errorMessage: string | null
  suggestedAction: string | null
  warningCode: string | null
  warningMessage: string | null
  requiresReview: boolean
  status: IspBillingRunItemStatus
}

function serviceLabel(input: {
  catalogCode?: string | null
  planName: string
}): string {
  return (input.catalogCode?.trim() || input.planName).trim()
}

function joinWarnings(
  warnings: Array<{ code: string; message: string }>
): { code: string | null; message: string | null } {
  if (warnings.length === 0) return { code: null, message: null }
  return {
    code: warnings.map((item) => item.code).join(","),
    message: warnings.map((item) => item.message).join(" · "),
  }
}

export function determineMonthlyDocumentType(
  input: DetermineDocumentTypeInput
): {
  documentType: IspBillingDocumentType | null
  errorCode: string | null
  errorMessage: string | null
  suggestedAction: string | null
  warningMessage: string | null
} {
  const name = input.customerName.trim()
  const snapshot = snapshotCustomerFromRecord({
    name,
    dni: input.customerDocumentNumber,
  })
  const issuer = (input.issuerVatCondition ?? "").trim()

  if (!issuer) {
    return {
      documentType: null,
      errorCode: "incomplete_issuer",
      errorMessage: ISP_BILLING_RUN_ISSUER_INCOMPLETE,
      suggestedAction: "Completá Sistema → Configuración → Facturación.",
      warningMessage: null,
    }
  }

  if (!name || !snapshot.documentNumber) {
    return {
      documentType: null,
      errorCode: "missing_fiscal_data",
      errorMessage: ISP_BILLING_RUN_MISSING_FISCAL,
      suggestedAction: "Cargá nombre y DNI/CUIT del abonado en Clientes 360°.",
      warningMessage: null,
    }
  }

  if (issuer === "monotributo" || issuer === "exento") {
    return {
      documentType: "factura_c",
      errorCode: null,
      errorMessage: null,
      suggestedAction: null,
      warningMessage: null,
    }
  }

  if (issuer !== "responsable_inscripto") {
    return {
      documentType: null,
      errorCode: "undetermined_document_type",
      errorMessage: ISP_BILLING_RUN_TYPE_UNDETERMINED,
      suggestedAction:
        "Revisá la condición IVA de la empresa facturadora en la configuración fiscal.",
      warningMessage: null,
    }
  }

  const customerVat = (input.customerVatCondition ?? snapshot.vatCondition ?? "").trim()
  if (customerVat === "responsable_inscripto") {
    return {
      documentType: "factura_a",
      errorCode: null,
      errorMessage: null,
      suggestedAction: null,
      warningMessage: null,
    }
  }
  if (
    customerVat === "consumidor_final" ||
    customerVat === "monotributo" ||
    customerVat === "exento"
  ) {
    return {
      documentType: "factura_b",
      errorCode: null,
      errorMessage: null,
      suggestedAction: null,
      warningMessage: null,
    }
  }

  if (snapshot.documentType === "dni") {
    return {
      documentType: "factura_b",
      errorCode: null,
      errorMessage: null,
      suggestedAction: null,
      warningMessage: null,
    }
  }

  const cuitDigits = normalizeCuitDigits(snapshot.taxId || snapshot.documentNumber)
  if (cuitDigits.length === 11 && isValidArCuit(cuitDigits)) {
    return {
      documentType: "factura_a",
      errorCode: null,
      errorMessage: null,
      suggestedAction: null,
      warningMessage:
        "Condición IVA no registrada; se clasificó como Factura A por CUIT. Revisá el abonado si corresponde Factura B.",
    }
  }

  return {
    documentType: null,
    errorCode: "undetermined_document_type",
    errorMessage: ISP_BILLING_RUN_TYPE_UNDETERMINED,
    suggestedAction: "Completá DNI/CUIT y condición fiscal del abonado.",
    warningMessage: null,
  }
}

export function evaluateServiceForMonthlyPeriod(input: {
  serviceId: string
  planName: string
  catalogCode?: string | null
  monthlyFee: number | null
  activationDate: string | null
  commercialStatus: string
  period: BillingPeriod
  previousPeriodAlreadyBilled: boolean
}): ServicePeriodEvaluation {
  const empty: ServicePeriodEvaluation = {
    include: false,
    monthlyAmount: 0,
    proportionalDays: 0,
    proportionalAmount: 0,
    proportionalPeriodLabel: "",
    concepts: [],
    errorCode: null,
    errorMessage: null,
    suggestedAction: null,
    warningCode: null,
    warningMessage: null,
    requiresReview: false,
    status: "ready",
  }

  if (!isValidBillingPeriod(input.period)) {
    return {
      ...empty,
      include: true,
      errorCode: "inconsistent_service",
      errorMessage: ISP_BILLING_RUN_INCONSISTENT,
      suggestedAction: "Revisá el período seleccionado.",
      status: "error",
    }
  }

  if (!input.activationDate) {
    return {
      ...empty,
      include: true,
      errorCode: "inconsistent_service",
      errorMessage: ISP_BILLING_RUN_INCONSISTENT,
      suggestedAction: "Cargá la fecha de alta del servicio en Clientes 360°.",
      status: "error",
    }
  }

  const periodStart = billingPeriodStartIso(input.period)
  const periodEnd = billingPeriodEndIso(input.period)
  if (input.activationDate > periodEnd) {
    return empty
  }

  if (input.commercialStatus === "cancelled") {
    return {
      ...empty,
      include: true,
      requiresReview: true,
      status: "needs_review",
      warningCode: "cancelled_needs_review",
      warningMessage: ISP_BILLING_RUN_CANCELLED_REVIEW,
    }
  }

  if (input.monthlyFee == null || input.monthlyFee < 0) {
    return {
      ...empty,
      include: true,
      errorCode: "missing_contracted_price",
      errorMessage: ISP_BILLING_RUN_MISSING_PRICE,
      suggestedAction: "Cargá el precio contratado del servicio en Clientes 360°.",
      status: "error",
    }
  }

  const contracted = roundBillingMoney(input.monthlyFee)
  const label = serviceLabel(input)
  const currentLabel = billingPeriodLabel(input.period)
  const warnings: Array<{ code: string; message: string }> = []
  const concepts: IspBillingRunConcept[] = []
  let monthlyAmount = 0
  let proportionalDays = 0
  let proportionalAmount = 0
  let proportionalPeriodLabel = ""

  if (input.activationDate < periodStart) {
    monthlyAmount = contracted
    concepts.push({
      kind: "monthly",
      description: `Abono ${label} · ${currentLabel}`,
      amount: monthlyAmount,
      periodLabel: currentLabel,
      serviceId: input.serviceId,
    })
  } else if (input.activationDate === periodStart) {
    monthlyAmount = contracted
    concepts.push({
      kind: "monthly",
      description: `Abono ${label} · ${currentLabel}`,
      amount: monthlyAmount,
      periodLabel: currentLabel,
      serviceId: input.serviceId,
    })
  } else {
    const currentProration = calculateMonthlyProration({
      monthlyAmount: contracted,
      activationDate: input.activationDate,
      periodStart,
      periodEnd,
    })
    proportionalDays = currentProration.billableDays
    proportionalAmount = currentProration.amount
    proportionalPeriodLabel = currentLabel
    concepts.push({
      kind: "proportional",
      description: `Proporcional ${label} · ${currentLabel}`,
      amount: proportionalAmount,
      days: proportionalDays,
      periodLabel: currentLabel,
      serviceId: input.serviceId,
    })
    warnings.push({
      code: "recent_activation",
      message: `Alta reciente (${input.activationDate}).`,
    })
  }

  const previous = previousBillingPeriod(input.period)
  const previousStart = billingPeriodStartIso(previous)
  const previousEnd = billingPeriodEndIso(previous)
  const startedInPreviousMonth =
    input.activationDate >= previousStart && input.activationDate <= previousEnd
  const startedOnCurrentDayOne = input.activationDate === periodStart

  if (startedInPreviousMonth && !startedOnCurrentDayOne && !input.previousPeriodAlreadyBilled) {
    const previousProration = calculateMonthlyProration({
      monthlyAmount: contracted,
      activationDate: input.activationDate,
      periodStart: previousStart,
      periodEnd: previousEnd,
    })
    if (previousProration.amount > 0) {
      proportionalDays = previousProration.billableDays
      proportionalAmount = roundBillingMoney(
        proportionalAmount + previousProration.amount
      )
      proportionalPeriodLabel = billingPeriodLabel(previous)
      concepts.push({
        kind: "proportional",
        description: `Proporcional ${label} · ${billingPeriodLabel(previous)}`,
        amount: previousProration.amount,
        days: previousProration.billableDays,
        periodLabel: billingPeriodLabel(previous),
        serviceId: input.serviceId,
      })
      warnings.push({
        code: "proportional",
        message: `Incluye proporcional de ${billingPeriodLabel(previous)} (${previousProration.billableDays} días).`,
      })
    }
  }

  if (input.commercialStatus === "suspended") {
    warnings.push({
      code: "suspended",
      message: "Servicio suspendido: se respeta el contrato y se incluye en la revisión.",
    })
  }

  const warning = joinWarnings(warnings)
  const totalAmount = roundBillingMoney(monthlyAmount + proportionalAmount)
  const requiresReview = warnings.some((item) => item.code === "cancelled_needs_review")
  for (const concept of concepts) {
    concept.contractedMonthlyAmount = contracted
  }

  return {
    include: true,
    monthlyAmount,
    proportionalDays,
    proportionalAmount,
    proportionalPeriodLabel,
    concepts,
    errorCode: null,
    errorMessage: null,
    suggestedAction: null,
    warningCode: warning.code,
    warningMessage: warning.message,
    requiresReview,
    status: totalAmount > 0 || concepts.length > 0 ? "ready" : "needs_review",
  }
}

export function buildRunItemFromEvaluation(input: {
  service: IspBillingServiceForRun
  evaluation: ServicePeriodEvaluation
  documentType: IspBillingDocumentType | null
  typeError?: {
    errorCode: string | null
    errorMessage: string | null
    suggestedAction: string | null
    warningMessage: string | null
  }
}): Omit<IspBillingRunItem, "id" | "runId" | "companyId" | "createdAt"> {
  const evaluation = input.evaluation
  let status = evaluation.status
  let errorCode = evaluation.errorCode
  let errorMessage = evaluation.errorMessage
  let suggestedAction = evaluation.suggestedAction
  let warningMessage = evaluation.warningMessage

  if (input.typeError?.errorCode && status !== "error") {
    status = "error"
    errorCode = input.typeError.errorCode
    errorMessage = input.typeError.errorMessage
    suggestedAction = input.typeError.suggestedAction
  } else if (input.typeError?.warningMessage) {
    warningMessage = [warningMessage, input.typeError.warningMessage]
      .filter(Boolean)
      .join(" · ")
  }

  return {
    customerId: input.service.customerId,
    subscriberId: input.service.subscriberId,
    serviceId: input.service.id,
    documentType: input.documentType,
    status,
    customerName: input.service.customerName,
    serviceName: input.service.planName,
    catalogCode: input.service.catalogCode,
    activationDate: input.service.activationDate,
    listPrice: input.service.listPrice,
    monthlyAmount: evaluation.monthlyAmount,
    contractedMonthlyAmount: roundBillingMoney(Math.max(0, input.service.monthlyFee ?? 0)),
    proportionalDays: evaluation.proportionalDays,
    proportionalAmount: evaluation.proportionalAmount,
    proportionalPeriodLabel: evaluation.proportionalPeriodLabel,
    totalAmount: roundBillingMoney(
      evaluation.monthlyAmount + evaluation.proportionalAmount
    ),
    errorCode,
    errorMessage,
    suggestedAction,
    warningCode: evaluation.warningCode,
    warningMessage,
    requiresReview: evaluation.requiresReview || status === "needs_review",
    concepts: evaluation.concepts,
    documentId: null,
  }
}

export function evaluateServicesForMonthlyRun(input: {
  services: IspBillingServiceForRun[]
  period: BillingPeriod
  issuerVatCondition: string | null | undefined
  issuerReady: boolean
  pointOfSaleReady: boolean
  previousBilledServiceIds?: Iterable<string>
}): Omit<IspBillingRunItem, "id" | "runId" | "companyId" | "createdAt">[] {
  const billed = new Set(input.previousBilledServiceIds ?? [])
  const byCustomer = new Map<string, IspBillingServiceForRun[]>()

  for (const service of input.services) {
    const current = byCustomer.get(service.customerId) ?? []
    current.push(service)
    byCustomer.set(service.customerId, current)
  }

  const items: Omit<IspBillingRunItem, "id" | "runId" | "companyId" | "createdAt">[] =
    []

  for (const services of byCustomer.values()) {
    const first = services[0]
    if (!first) continue

    let typeError: ReturnType<typeof determineMonthlyDocumentType> | undefined
    if (!input.issuerReady) {
      typeError = {
        documentType: null,
        errorCode: "incomplete_issuer",
        errorMessage: ISP_BILLING_RUN_ISSUER_INCOMPLETE,
        suggestedAction: "Completá Sistema → Configuración → Facturación.",
        warningMessage: null,
      }
    } else if (!input.pointOfSaleReady) {
      typeError = {
        documentType: null,
        errorCode: "missing_point_of_sale",
        errorMessage: ISP_BILLING_RUN_POS_MISSING,
        suggestedAction: "Configurá el punto de venta fiscal.",
        warningMessage: null,
      }
    } else {
      typeError = determineMonthlyDocumentType({
        issuerVatCondition: input.issuerVatCondition,
        customerName: first.customerName,
        customerDocumentNumber: first.customerDni,
      })
    }

    for (const service of services) {
      const evaluation = evaluateServiceForMonthlyPeriod({
        serviceId: service.id,
        planName: service.planName,
        catalogCode: service.catalogCode,
        monthlyFee: service.monthlyFee,
        activationDate: service.activationDate,
        commercialStatus: service.commercialStatus,
        period: input.period,
        previousPeriodAlreadyBilled: billed.has(service.id),
      })
      if (!evaluation.include) continue
      items.push(
        buildRunItemFromEvaluation({
          service,
          evaluation,
          documentType: typeError.documentType,
          typeError,
        })
      )
    }
  }

  return items
}

export function groupBillingRunItems(items: IspBillingRunItem[]): IspBillingRunGroup[] {
  const groups = new Map<string, IspBillingRunGroup>()

  for (const item of items) {
    const current = groups.get(item.customerId)
    if (!current) {
      groups.set(item.customerId, {
        customerId: item.customerId,
        subscriberId: item.subscriberId,
        customerName: item.customerName,
        documentType: item.documentType,
        status: item.status,
        monthlyAmount: item.monthlyAmount,
        proportionalAmount: item.proportionalAmount,
        totalAmount: item.totalAmount,
        hasProportional: item.proportionalAmount > 0,
        hasError: item.status === "error",
        requiresReview: item.requiresReview,
        errorMessage: item.errorMessage,
        suggestedAction: item.suggestedAction,
        warningMessage: item.warningMessage,
        items: [item],
        concepts: [...item.concepts],
      })
      continue
    }

    current.items.push(item)
    current.concepts.push(...item.concepts)
    current.monthlyAmount = roundBillingMoney(
      current.monthlyAmount + item.monthlyAmount
    )
    current.proportionalAmount = roundBillingMoney(
      current.proportionalAmount + item.proportionalAmount
    )
    current.totalAmount = roundBillingMoney(current.totalAmount + item.totalAmount)
    current.hasProportional = current.hasProportional || item.proportionalAmount > 0
    current.requiresReview = current.requiresReview || item.requiresReview
    if (item.status === "error") {
      current.hasError = true
      current.status = "error"
      current.errorMessage = current.errorMessage || item.errorMessage
      current.suggestedAction = current.suggestedAction || item.suggestedAction
    } else if (current.status !== "error" && item.totalAmount > 0) {
      current.status = "ready"
    } else if (current.status !== "error" && current.status !== "ready") {
      current.status = item.status
    }
    if (!current.warningMessage) current.warningMessage = item.warningMessage
    if (!current.documentType) current.documentType = item.documentType
  }

  return [...groups.values()].sort((left, right) =>
    left.customerName.localeCompare(right.customerName, "es")
  )
}

export function summarizeBillingRunGroups(groups: IspBillingRunGroup[]): {
  totalCustomers: number
  totalDocuments: number
  totalAmount: number
  proportionalDocuments: number
  errorsCount: number
  warningsCount: number
  canConfirm: boolean
  typeSummaries: IspBillingRunTypeSummary[]
} {
  const billable = groups.filter((group) => !group.hasError && group.totalAmount > 0)
  const errorsCount = groups.filter((group) => group.hasError).length

  const byType = new Map<IspBillingDocumentType, IspBillingRunTypeSummary>()
  for (const group of groups) {
    if (!group.documentType) continue
    const current = byType.get(group.documentType) ?? {
      documentType: group.documentType,
      count: 0,
      totalAmount: 0,
      proportionalCount: 0,
      warningCount: 0,
      errorCount: 0,
    }
    current.count += 1
    current.totalAmount = roundBillingMoney(current.totalAmount + group.totalAmount)
    if (group.hasProportional) current.proportionalCount += 1
    if (group.hasError) current.errorCount += 1
    if (group.requiresReview || group.warningMessage) current.warningCount += 1
    byType.set(group.documentType, current)
  }

  return {
    totalCustomers: groups.length,
    totalDocuments: billable.length,
    totalAmount: roundBillingMoney(
      billable.reduce((sum, group) => sum + group.totalAmount, 0)
    ),
    proportionalDocuments: groups.filter((group) => group.hasProportional).length,
    errorsCount,
    warningsCount: groups.filter((group) => !group.hasError && group.requiresReview)
      .length,
    canConfirm: errorsCount === 0,
    typeSummaries: [...byType.values()].sort((left, right) =>
      left.documentType.localeCompare(right.documentType)
    ),
  }
}

export function billingRunPhaseHint(status: string): string {
  switch (status) {
    case "confirmed":
      return "Comprobantes emitidos"
    case "cancelled":
      return "Preparación cancelada"
    case "with_errors":
      return "Hay errores bloqueantes"
    default:
      return "Preparación en revisión"
  }
}

export function billingRunStatusLabel(status: string): string {
  switch (status) {
    case "preparing":
      return "Preparando"
    case "in_review":
      return "En revisión"
    case "with_errors":
      return "Con errores"
    case "confirmed":
      return "Confirmada"
    case "cancelled":
      return "Cancelada"
    default:
      return status
  }
}

export function billingRunStatusTone(status: string): VisualTone {
  switch (status) {
    case "preparing":
      return "gray"
    case "in_review":
      return "blue"
    case "with_errors":
      return "red"
    case "confirmed":
      return "green"
    case "cancelled":
      return "red"
    default:
      return "gray"
  }
}

export function confirmableGroups(groups: IspBillingRunGroup[]): IspBillingRunGroup[] {
  return groups.filter(
    (group) => !group.hasError && group.totalAmount > 0 && group.documentType
  )
}
