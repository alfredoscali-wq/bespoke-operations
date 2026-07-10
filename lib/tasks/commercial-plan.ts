import type { Task } from "@/lib/types/tasks"

export type WorkOrderTechnology = "fiber" | "wireless"
export type FiberContractedPlan = "50Mb" | "100Mb" | "300Mb"
export type ContractedPlan = FiberContractedPlan | "20Mb"

type CommercialFormSlice = {
  serviceType: string | ""
  technology: WorkOrderTechnology | ""
  contractedPlan: ContractedPlan | ""
  currentTechnology?: WorkOrderTechnology | ""
  newTechnology?: WorkOrderTechnology | ""
  currentContractedPlan?: ContractedPlan | ""
  newContractedPlan?: ContractedPlan | ""
}

export const FIBER_CONTRACTED_PLAN_OPTIONS: {
  value: FiberContractedPlan
  label: string
}[] = [
  { value: "50Mb", label: "50 Mb" },
  { value: "100Mb", label: "100 Mb" },
  { value: "300Mb", label: "300 Mb" },
]

export const WIRELESS_CONTRACTED_PLAN: ContractedPlan = "20Mb"
export const WIRELESS_CONTRACTED_PLAN_LABEL = "20 Mb Wireless"

export const CONTRACTED_PLAN_LABELS: Record<ContractedPlan, string> = {
  "50Mb": "50 Mb",
  "100Mb": "100 Mb",
  "300Mb": "300 Mb",
  "20Mb": "20 Mb",
}

export function isNewInstallationTask(
  task: Pick<Task, "serviceType">
): boolean {
  return task.serviceType === "instalacion-nueva"
}

export function getTaskTechnologyLabel(task: Task): string | null {
  if (task.type === "wireless") return "Wireless"
  if (task.type === "fiber") return "Fibra"

  const metadataTechnology = task.taskMetadata?.technology
  if (metadataTechnology === "wireless") return "Wireless"
  if (metadataTechnology === "fiber") return "Fibra"

  return null
}

export function formatContractedPlanLabel(
  plan: string | null | undefined
): string | null {
  if (!plan?.trim()) return null
  return (
    CONTRACTED_PLAN_LABELS[plan as ContractedPlan] ??
    plan.replace(/Mb$/i, " Mb")
  )
}

export function parseInstallationCostInput(input: string): number | null {
  const digits = input.replace(/\D/g, "")
  if (!digits) return null

  const value = Number.parseInt(digits, 10)
  return Number.isFinite(value) ? value : null
}

export function formatInstallationCostDisplay(value: number): string {
  return `$ ${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
}

export function formatInstallationCostInput(digits: string): string {
  const value = parseInstallationCostInput(digits)
  if (value === null) return ""
  return formatInstallationCostDisplay(value)
}

export function parseAmountToCollectInput(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let cleaned = trimmed.replace(/[$\s]/g, "")

  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".")
  } else {
    const parts = cleaned.split(".")
    if (parts.length > 2) {
      cleaned = parts.join("")
    } else if (parts.length === 2 && parts[1].length === 3) {
      cleaned = parts.join("")
    }
  }

  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value) || value < 0) return null

  return Math.round(value * 100) / 100
}

export function formatAmountToCollectDisplay(value: number): string {
  return `$ ${value.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export function formatAmountToCollectFormValue(
  value: number | null | undefined
): string {
  if (value == null) return ""
  return String(value)
}

export type WorkOrderPaymentMethod =
  | "efectivo"
  | "transferencia"
  | "mercadopago"
  | "tarjeta"
  | "otro"

export const WORK_ORDER_PAYMENT_METHOD_OPTIONS: {
  value: WorkOrderPaymentMethod
  label: string
}[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
]

const PAYMENT_METHOD_LABELS: Record<WorkOrderPaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercadopago: "Mercado Pago",
  tarjeta: "Tarjeta",
  otro: "Otro",
}

export function formatWorkOrderPaymentMethodLabel(
  method: string | null | undefined
): string | null {
  if (!method?.trim()) return null
  return (
    PAYMENT_METHOD_LABELS[method as WorkOrderPaymentMethod] ?? method.trim()
  )
}

export function resolvePaymentMethodFromForm(
  value: string
): WorkOrderPaymentMethod | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const allowed = WORK_ORDER_PAYMENT_METHOD_OPTIONS.map((option) => option.value)
  return allowed.includes(trimmed as WorkOrderPaymentMethod)
    ? (trimmed as WorkOrderPaymentMethod)
    : undefined
}

export function resolveContractedPlanFromForm(
  form: CommercialFormSlice & {
    serviceType: string | ""
    currentTechnology?: WorkOrderTechnology | ""
    newTechnology?: WorkOrderTechnology | ""
    newContractedPlan?: ContractedPlan | ""
  }
): ContractedPlan | null {
  if (form.serviceType === "instalacion-nueva") {
    return resolvePlanForTechnology(form.technology, form.contractedPlan)
  }

  if (
    form.serviceType === "cambio-domicilio" ||
    form.serviceType === "cambio-tecnologia"
  ) {
    const finalTechnology =
      form.newTechnology ||
      (form.serviceType === "cambio-domicilio" ? form.technology : "")

    const finalPlan =
      form.newContractedPlan ||
      (finalTechnology === form.technology ? form.contractedPlan : "")

    return resolvePlanForTechnology(finalTechnology, finalPlan)
  }

  return null
}

function resolvePlanForTechnology(
  technology: WorkOrderTechnology | "",
  plan: ContractedPlan | ""
): ContractedPlan | null {
  if (!technology) return null

  if (technology === "wireless") {
    return WIRELESS_CONTRACTED_PLAN
  }

  if (plan === "50Mb" || plan === "100Mb" || plan === "300Mb") {
    return plan
  }

  return null
}

export function resolveCurrentContractedPlanFromForm(
  form: Pick<
    CommercialFormSlice,
    "currentTechnology" | "currentContractedPlan"
  >
): ContractedPlan | null {
  return resolvePlanForTechnology(
    form.currentTechnology ?? "",
    form.currentContractedPlan ?? ""
  )
}

export function resolveContractedPlanForTechnology(
  technology: WorkOrderTechnology | ""
): ContractedPlan | "" {
  if (technology === "wireless") return WIRELESS_CONTRACTED_PLAN
  return ""
}

export function getPlanOptionsForTechnology(technology: WorkOrderTechnology | "") {
  if (technology === "wireless") {
    return [{ value: WIRELESS_CONTRACTED_PLAN, label: WIRELESS_CONTRACTED_PLAN_LABEL }]
  }

  if (technology === "fiber") {
    return FIBER_CONTRACTED_PLAN_OPTIONS
  }

  return []
}

export function isPlanValidForTechnology(
  plan: string | null | undefined,
  technology: WorkOrderTechnology | ""
): boolean {
  if (!plan?.trim() || !technology) {
    return false
  }

  if (technology === "wireless") {
    return plan === WIRELESS_CONTRACTED_PLAN
  }

  return FIBER_CONTRACTED_PLAN_OPTIONS.some((option) => option.value === plan)
}

export function sanitizePlanForTechnology(
  plan: ContractedPlan | "",
  technology: WorkOrderTechnology | ""
): ContractedPlan | "" {
  if (!technology) {
    return ""
  }

  if (technology === "wireless") {
    return WIRELESS_CONTRACTED_PLAN
  }

  if (isPlanValidForTechnology(plan, technology)) {
    return plan
  }

  return ""
}

export function taskHasCommercialInfo(
  task: Pick<Task, "serviceType" | "contractedPlan" | "amountToCollect" | "taskMetadata">
): boolean {
  if (task.contractedPlan?.trim() || task.amountToCollect != null) {
    return true
  }

  return Boolean(
    task.taskMetadata?.currentContractedPlan ||
      task.taskMetadata?.newContractedPlan
  )
}

function readMetadataPlan(value: unknown): ContractedPlan | "" {
  if (
    value === "50Mb" ||
    value === "100Mb" ||
    value === "300Mb" ||
    value === "20Mb"
  ) {
    return value
  }

  return ""
}

export function resolveContractedPlanFromTask(
  task: Pick<Task, "contractedPlan" | "taskMetadata" | "serviceType" | "type">
): ContractedPlan | null {
  const direct =
    task.contractedPlan === "50Mb" ||
    task.contractedPlan === "100Mb" ||
    task.contractedPlan === "300Mb" ||
    task.contractedPlan === "20Mb"
      ? task.contractedPlan
      : ""

  if (direct) {
    return direct
  }

  const metadata = task.taskMetadata ?? {}
  const metadataPlan =
    readMetadataPlan(metadata.newContractedPlan) ||
    readMetadataPlan(metadata.contractedPlan)

  if (metadataPlan) {
    return metadataPlan
  }

  return null
}
