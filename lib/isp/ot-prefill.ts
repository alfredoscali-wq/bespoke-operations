import { normalizeDni } from "@/lib/customers/normalization/dni"
import {
  findCatalogItemForWorkOrder,
  snapshotServiceFromCatalog,
  suggestConnectionTypeFromCatalogAndOt,
} from "@/lib/isp/catalog-integrity"
import type { IspCatalogItem } from "@/lib/isp/catalog-types"
import { NEW_INSTALLATION_SERVICE_TYPE } from "@/lib/isp/constants"
import {
  didCopyOtChargeToMonthlyFee,
  didInferPppoeUsernameFromDni,
  matchCustomerByDni,
  suggestConnectionTypeFromWorkOrder,
} from "@/lib/isp/integrity"
import type {
  IspConnectionDraft,
  IspExistingCustomerMatch,
  IspOtPrefill,
  IspServiceDraft,
} from "@/lib/isp/types"
import {
  readInstallationIpFromTask,
  resolveWorkOrderTechnologyFromTask,
} from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"

const MONTHLY_FEE_METADATA_KEYS = [
  "monthlyFee",
  "monthly_fee",
  "abonoMensual",
  "precioAbono",
  "monthlyPrice",
] as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parsePositiveAmount(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(value)
  }
  if (typeof value !== "string") return ""
  const trimmed = value.trim().replace(",", ".")
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed > 0 ? trimmed : ""
}

function mapTaskTechnology(task: Task): IspServiceDraft["technology"] {
  if (task.type === "wireless") return "wireless"
  if (task.type === "fiber") return "ftth"

  const metadata = asString(task.taskMetadata?.technology)
  if (metadata === "wireless") return "wireless"
  if (metadata === "fiber" || metadata === "ftth") return "ftth"
  return ""
}

function mapSpeedFromPlan(plan: string): string {
  const match = plan.match(/(\d+)\s*m/i)
  return match ? `${match[1]} Mb` : plan
}

function readMonthlyFeeFromWorkOrder(task: Task): string {
  const metadata = task.taskMetadata ?? {}
  for (const key of MONTHLY_FEE_METADATA_KEYS) {
    const monthlyFee = parsePositiveAmount(metadata[key])
    if (monthlyFee) return monthlyFee
  }
  return ""
}

function readStoredPppoeUsername(task: Task, dni: string): string {
  const metadata = task.taskMetadata ?? {}
  const stored =
    asString(metadata.pppoeUsername) || asString(metadata.pppoe_username)
  if (
    !stored ||
    didInferPppoeUsernameFromDni({
      pppoeUsername: stored,
      dni,
    })
  ) {
    return ""
  }
  return stored
}

export function buildConnectionDraftFromOtPrefill(
  prefill: Pick<IspOtPrefill, "connection">
): IspConnectionDraft {
  return {
    connectionType: prefill.connection.connectionType ?? "",
    pppoeUsername: prefill.connection.pppoeUsername ?? "",
    pppoePassword: prefill.connection.pppoePassword ?? "",
    technicalProfile: prefill.connection.technicalProfile ?? "",
    ipAddress: prefill.connection.ipAddress ?? "",
    prefixLength: prefill.connection.prefixLength ?? "",
    gateway: prefill.connection.gateway ?? "",
    vlan: prefill.connection.vlan ?? "",
    coreName: prefill.connection.coreName ?? "",
    technicalStatus: prefill.connection.technicalStatus ?? "pending_provision",
  }
}

export function buildIspPrefillFromWorkOrder(input: {
  task: Task
  existingCustomers: IspExistingCustomerMatch[]
  catalogItem?: IspCatalogItem | null
  catalogItems?: IspCatalogItem[]
}): IspOtPrefill {
  const { task, existingCustomers } = input
  const catalogItem =
    input.catalogItem ??
    findCatalogItemForWorkOrder(input.catalogItems ?? [], {
      catalogId: task.serviceCatalogId,
      otTechnology: resolveWorkOrderTechnologyFromTask(task),
      contractedPlan: task.contractedPlan,
    })
  const snapshot = catalogItem ? snapshotServiceFromCatalog(catalogItem) : null
  const email = asString(task.taskMetadata?.email)
  const technology = snapshot?.technology || mapTaskTechnology(task)
  const plan = snapshot?.planName || task.contractedPlan?.trim() || ""
  const address = task.serviceAddress?.trim() || ""
  const locality = task.locality?.trim() || ""
  const dni = task.customerDni?.trim() || ""
  const existingCustomer = matchCustomerByDni(existingCustomers, dni)
  const installationIp = readInstallationIpFromTask(task)
  const connectionType = snapshot
    ? suggestConnectionTypeFromCatalogAndOt({
        technology,
        installationIp,
        allowedConnectionTypes: snapshot.allowedConnectionTypes,
      })
    : suggestConnectionTypeFromWorkOrder({
        technology,
        installationIp,
      })
  const monthlyFeeFromCatalog = snapshot?.monthlyFee ?? ""
  const monthlyFeeFromOt = readMonthlyFeeFromWorkOrder(task)
  const monthlyFee = monthlyFeeFromCatalog || monthlyFeeFromOt
  const otInstallationAmount = task.installationCost ?? null
  const otAmountToCollect = task.amountToCollect ?? null
  const copiedOtCharge =
    !monthlyFeeFromCatalog &&
    didCopyOtChargeToMonthlyFee({
      monthlyFee,
      otInstallationAmount,
      otAmountToCollect,
    })
  const safeMonthlyFee = copiedOtCharge ? "" : monthlyFee
  const pppoeUsername = readStoredPppoeUsername(task, dni)
  const missingFields: string[] = []

  if (!technology && !catalogItem) missingFields.push("Tecnología")
  if (!plan) missingFields.push("Plan")
  if (!safeMonthlyFee) missingFields.push("Precio del abono")
  if (!connectionType) missingFields.push("Tipo de conexión")
  if (connectionType === "static_ip" && !installationIp) {
    missingFields.push("IP")
  }
  if (!connectionType && !installationIp) {
    missingFields.push("Datos técnicos de la conexión")
  }

  return {
    taskId: task.id,
    taskCode: task.code,
    isNewInstallation: task.serviceType === NEW_INSTALLATION_SERVICE_TYPE,
    customer: {
      name: task.customerName?.trim() || "",
      dni,
      phone: task.customerPhone?.trim() || "",
      whatsapp: task.customerPhone?.trim() || "",
      email,
      address,
      locality,
      notes: "",
      existingCustomer,
    },
    service: {
      catalogId: snapshot?.catalogId ?? task.serviceCatalogId ?? "",
      technology,
      planName: plan,
      contractedSpeed: snapshot?.contractedSpeed || (plan ? mapSpeedFromPlan(plan) : ""),
      monthlyFee: safeMonthlyFee,
      activationDate: task.dueDate || task.startDate || "",
      commercialStatus: "pending_activation",
      monthlyCollectionMethod: snapshot?.monthlyCollectionMethod ?? "pending",
    },
    connection: {
      connectionType,
      pppoeUsername,
      pppoePassword: "",
      ipAddress: installationIp,
      prefixLength: "",
      gateway: "",
      vlan: "",
      technicalProfile: "",
      coreName: "",
      technicalStatus: "pending_provision",
    },
    fromOt: {
      customer: Boolean(task.customerName?.trim() || dni),
      technology: Boolean(technology),
      plan: Boolean(plan),
      monthlyFee: Boolean(safeMonthlyFee),
      address: Boolean(address || locality),
      connectionType: Boolean(connectionType),
      ipAddress: Boolean(installationIp),
    },
    otInstallationAmount,
    otAmountToCollect,
    otInstallationIp: installationIp || null,
    otPaymentMethod: task.paymentMethod ?? null,
    missingFields,
  }
}

export function isReliableCustomerDocument(
  dni: string | null | undefined
): boolean {
  return normalizeDni(dni).isValid
}
