import type { ContractedPlan } from "@/lib/tasks/commercial-plan"
import type { WorkOrderFormInput, WorkOrderTechnology } from "@/lib/tasks/work-order"
import type { OperationalStep, Task } from "@/lib/types/tasks"

export const FTTH_TEXT_STEP_KEYS = ["nap_box", "nap_port", "onu_serial"] as const

export type FtthTextStepKey = (typeof FTTH_TEXT_STEP_KEYS)[number]

export type FtthInstallationValues = {
  contractedPlan: ContractedPlan | ""
  napBox: string
  napPort: string
  onuSerial: string
}

export type FtthInstallationFormSlice = Pick<
  WorkOrderFormInput,
  "napBox" | "napPort" | "onuSerial"
> &
  Pick<WorkOrderFormInput, "contractedPlan">

const FTTH_SERVICE_TYPES = new Set([
  "instalacion-nueva",
  "cambio-domicilio",
  "cambio-tecnologia",
])

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function isFtthTechnology(
  technology: WorkOrderTechnology | ""
): technology is "fiber" {
  return technology === "fiber"
}

export function resolveFinalTechnologyFromForm(
  form: Pick<
    WorkOrderFormInput,
    "serviceType" | "technology" | "currentTechnology" | "newTechnology"
  >
): WorkOrderTechnology | "" {
  switch (form.serviceType) {
    case "instalacion-nueva":
      return form.technology
    case "cambio-domicilio":
      return form.newTechnology || form.technology
    case "cambio-tecnologia":
      return form.newTechnology
    default:
      return form.technology
  }
}

export function resolveFinalTechnologyFromTask(
  task: Pick<Task, "type" | "serviceType" | "taskMetadata">
): WorkOrderTechnology | "" {
  const metadata = task.taskMetadata ?? {}

  if (task.serviceType === "cambio-tecnologia" || task.serviceType === "cambio-domicilio") {
    const newTechnology = readString(metadata.newTechnology)
    if (newTechnology === "fiber" || newTechnology === "wireless") {
      return newTechnology
    }
  }

  if (metadata.technology === "fiber" || metadata.technology === "wireless") {
    return metadata.technology
  }

  if (task.type === "wireless") return "wireless"
  if (task.type === "fiber") return "fiber"

  return ""
}

export function taskRequiresFtthInstallation(
  task: Pick<Task, "serviceType" | "type" | "taskMetadata">
): boolean {
  if (!task.serviceType || !FTTH_SERVICE_TYPES.has(task.serviceType)) {
    return false
  }

  return isFtthTechnology(resolveFinalTechnologyFromTask(task))
}

export function resolveFtthInstallationFromTask(task: Task): FtthInstallationValues {
  const metadata = task.taskMetadata ?? {}
  const steps = task.operationalSteps ?? []

  function observationForStepKey(stepKey: FtthTextStepKey): string {
    return steps.find((step) => step.stepKey === stepKey)?.observation.trim() ?? ""
  }

  return {
    contractedPlan:
      task.contractedPlan === "50Mb" ||
      task.contractedPlan === "100Mb" ||
      task.contractedPlan === "300Mb" ||
      task.contractedPlan === "20Mb"
        ? task.contractedPlan
        : "",
    napBox: readString(metadata.napBox) || observationForStepKey("nap_box"),
    napPort: readString(metadata.napPort) || observationForStepKey("nap_port"),
    onuSerial: readString(metadata.onuSerial) || observationForStepKey("onu_serial"),
  }
}

export function buildFtthMetadataFromForm(
  form: Pick<WorkOrderFormInput, "napBox" | "napPort" | "onuSerial">
): Record<string, unknown> {
  return {
    ...(form.napBox.trim() ? { napBox: form.napBox.trim() } : {}),
    ...(form.napPort.trim() ? { napPort: form.napPort.trim() } : {}),
    ...(form.onuSerial.trim() ? { onuSerial: form.onuSerial.trim() } : {}),
  }
}

export function applyFtthValuesToOperationalSteps(
  steps: OperationalStep[],
  values: Pick<FtthInstallationValues, "napBox" | "napPort" | "onuSerial">
): OperationalStep[] {
  const now = new Date().toISOString()
  const valueByKey: Record<FtthTextStepKey, string> = {
    nap_box: values.napBox.trim(),
    nap_port: values.napPort.trim(),
    onu_serial: values.onuSerial.trim(),
  }

  return steps.map((step) => {
    if (!step.stepKey || !(FTTH_TEXT_STEP_KEYS as readonly string[]).includes(step.stepKey)) {
      return step
    }

    const observation = valueByKey[step.stepKey as FtthTextStepKey]
    const complete = observation.length > 0

    return {
      ...step,
      observation,
      completedAt: complete ? step.completedAt ?? now : null,
    }
  })
}

export function filterFtthTextStepsForPhotoPanel(
  steps: OperationalStep[]
): OperationalStep[] {
  return steps.filter(
    (step) =>
      !step.stepKey ||
      !(FTTH_TEXT_STEP_KEYS as readonly string[]).includes(step.stepKey)
  )
}

export function findFtthTextStepId(
  steps: OperationalStep[],
  stepKey: FtthTextStepKey
): string | null {
  return steps.find((step) => step.stepKey === stepKey)?.id ?? null
}

export function resolveTechnologyLabel(
  technology: WorkOrderTechnology | ""
): string | null {
  if (technology === "fiber") return "Fibra Óptica"
  if (technology === "wireless") return "Wireless"
  return null
}

export function resolveCurrentTechnologyFromTask(
  task: Pick<Task, "type" | "taskMetadata">
): WorkOrderTechnology | "" {
  const metadata = task.taskMetadata ?? {}
  const current = readString(metadata.currentTechnology)

  if (current === "fiber" || current === "wireless") {
    return current
  }

  if (metadata.technology === "fiber" || metadata.technology === "wireless") {
    return metadata.technology
  }

  if (task.type === "wireless") return "wireless"
  if (task.type === "fiber") return "fiber"

  return ""
}

export function resolveCurrentContractedPlanFromTask(
  task: Pick<Task, "taskMetadata">
): ContractedPlan | "" {
  const plan = readString(task.taskMetadata?.currentContractedPlan)

  if (
    plan === "50Mb" ||
    plan === "100Mb" ||
    plan === "300Mb" ||
    plan === "20Mb"
  ) {
    return plan
  }

  return ""
}
