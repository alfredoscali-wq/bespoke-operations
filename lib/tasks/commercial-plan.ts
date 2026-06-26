import type { Task } from "@/lib/types/tasks"

export type WorkOrderTechnology = "fiber" | "wireless"
export type FiberContractedPlan = "50Mb" | "100Mb" | "300Mb"
export type ContractedPlan = FiberContractedPlan | "20Mb"

type CommercialFormSlice = {
  serviceType: string | ""
  technology: WorkOrderTechnology | ""
  contractedPlan: ContractedPlan | ""
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

export function resolveContractedPlanFromForm(
  form: CommercialFormSlice
): ContractedPlan | null {
  if (form.serviceType !== "instalacion-nueva") return null

  if (form.technology === "wireless") {
    return WIRELESS_CONTRACTED_PLAN
  }

  if (
    form.contractedPlan === "50Mb" ||
    form.contractedPlan === "100Mb" ||
    form.contractedPlan === "300Mb"
  ) {
    return form.contractedPlan
  }

  return null
}

export function resolveContractedPlanForTechnology(
  technology: WorkOrderTechnology | ""
): ContractedPlan | "" {
  if (technology === "wireless") return WIRELESS_CONTRACTED_PLAN
  return ""
}

export function taskHasCommercialInfo(
  task: Pick<Task, "serviceType" | "contractedPlan" | "amountToCollect">
): boolean {
  return (
    isNewInstallationTask(task) &&
    Boolean(task.contractedPlan?.trim() || task.amountToCollect != null)
  )
}
