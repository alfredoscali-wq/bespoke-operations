import type { CreateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task, TaskStatus, TaskType } from "@/lib/types/tasks"
import {
  createDefaultOperationalSteps,
  createInstallationOperationalSteps,
} from "@/lib/operational-steps/default-steps"
import {
  buildCambioDomicilioMetadataFromForm,
} from "@/lib/tasks/cambio-domicilio"
import {
  buildFtthMetadataFromForm,
  resolveFinalTechnologyFromForm,
} from "@/lib/tasks/ftth-installation"
import {
  formatAmountToCollectFormValue,
  parseAmountToCollectInput,
  resolveContractedPlanFromForm,
  resolveCurrentContractedPlanFromForm,
  type ContractedPlan,
} from "@/lib/tasks/commercial-plan"
import {
  applyFtthValuesToOperationalSteps,
} from "@/lib/tasks/ftth-installation"
import {
  formatScheduledTimeForInput,
  getDefaultScheduledTime,
  normalizeScheduledTimeForDb,
} from "@/lib/tasks/scheduling"

export type WorkOrderServiceType =
  | "instalacion-nueva"
  | "cambio-domicilio"
  | "cambio-tecnologia"
  | "service-tecnico"
  | "reconexion"
  | "baja"
  | "retiro-equipos"
  | "relevamiento"
  | "postventa"
  | "reclamo"
  | "inspeccion-tecnica"
  | "otro"

export type WorkOrderTechnology = "fiber" | "wireless"

export type ServiceTechnicalReason =
  | "sin-conexion"
  | "lentitud"
  | "intermitencia"
  | "cambio-equipo"
  | "otro"

export const WORK_ORDER_SERVICE_TYPE_OPTIONS: {
  value: WorkOrderServiceType
  label: string
}[] = [
  { value: "instalacion-nueva", label: "Instalación Nueva" },
  { value: "cambio-domicilio", label: "Cambio de Domicilio" },
  { value: "cambio-tecnologia", label: "Cambio de Tecnología" },
  { value: "service-tecnico", label: "Service Técnico" },
  { value: "reconexion", label: "Reconexión" },
  { value: "baja", label: "Baja" },
  { value: "retiro-equipos", label: "Retiro de Equipo" },
  { value: "relevamiento", label: "Relevamiento" },
  { value: "postventa", label: "Postventa" },
]

export const WORK_ORDER_TECHNOLOGY_OPTIONS: {
  value: WorkOrderTechnology
  label: string
}[] = [
  { value: "fiber", label: "Fibra Óptica" },
  { value: "wireless", label: "Wireless" },
]

export const SERVICE_TECHNICAL_REASON_OPTIONS: {
  value: ServiceTechnicalReason
  label: string
}[] = [
  { value: "sin-conexion", label: "Sin conexión" },
  { value: "lentitud", label: "Lentitud" },
  { value: "intermitencia", label: "Intermitencia" },
  { value: "cambio-equipo", label: "Cambio de equipo" },
  { value: "otro", label: "Otro" },
]

const LEGACY_WORK_ORDER_SERVICE_TYPE_LABELS: Record<string, string> = {
  reclamo: "Reclamo",
  "inspeccion-tecnica": "Inspección técnica",
  otro: "Otro",
}

export const WORK_ORDER_SERVICE_TYPE_LABELS: Record<
  WorkOrderServiceType,
  string
> = {
  ...Object.fromEntries(
    WORK_ORDER_SERVICE_TYPE_OPTIONS.map((option) => [option.value, option.label])
  ),
  ...LEGACY_WORK_ORDER_SERVICE_TYPE_LABELS,
} as Record<WorkOrderServiceType, string>

const WORK_ORDER_PROJECT_CODE = "OT"
const WORK_ORDER_TASK_CODE_PREFIX = "TSK-OT-"
const WORK_ORDER_TASK_CODE_PATTERN = /^TSK-OT-(\d+)$/

export function generateWorkOrderTaskCodeFromCodes(codes: Iterable<string>): string {
  const knownCodes = new Set(
    [...codes].map((code) => code.trim()).filter(Boolean)
  )
  const otCodes = [...knownCodes].filter((code) =>
    WORK_ORDER_TASK_CODE_PATTERN.test(code)
  )

  let maxCounter = 0
  for (const code of otCodes) {
    const match = code.match(WORK_ORDER_TASK_CODE_PATTERN)
    if (!match) continue
    maxCounter = Math.max(maxCounter, Number.parseInt(match[1], 10))
  }

  let counter = maxCounter + 1
  let generatedCode = `${WORK_ORDER_TASK_CODE_PREFIX}${String(counter).padStart(3, "0")}`

  while (knownCodes.has(generatedCode)) {
    counter += 1
    generatedCode = `${WORK_ORDER_TASK_CODE_PREFIX}${String(counter).padStart(3, "0")}`
  }

  return generatedCode
}

export function generateWorkOrderTaskCode(tasks: Task[]): string {
  return generateWorkOrderTaskCodeFromCodes(tasks.map((task) => task.code))
}

export type WorkOrderFormInput = {
  serviceType: WorkOrderServiceType | ""
  customerName: string
  customerPhone: string
  customerEmail: string
  customerId: string
  scheduledDate: string
  scheduledTime: string
  crewId: string
  observations: string
  address: string
  locality: string
  technology: WorkOrderTechnology | ""
  currentAddress: string
  newAddress: string
  currentLocality: string
  newLocality: string
  currentTechnology: WorkOrderTechnology | ""
  newTechnology: WorkOrderTechnology | ""
  currentContractedPlan: ContractedPlan | ""
  newContractedPlan: ContractedPlan | ""
  napBox: string
  napPort: string
  onuSerial: string
  serviceReason: ServiceTechnicalReason | ""
  serviceDetail: string
  cancellationReason: string
  equipmentToRemove: string
  surveyReason: string
  postventaDetail: string
  customerCompany: string
  externalReference: string
  clientOrderNumber: string
  province: string
  postalCode: string
  sharedLocation: string
  currentSharedLocation: string
  newSharedLocation: string
  observationsForCrew: string
  contractedPlan: ContractedPlan | ""
  amountToCollect: string
  latitude: number | null
  longitude: number | null
  currentLatitude: number | null
  currentLongitude: number | null
  newLatitude: number | null
  newLongitude: number | null
}

export function getDefaultWorkOrderForm(): WorkOrderFormInput {
  return {
    serviceType: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerId: "",
    scheduledDate: new Date().toISOString().slice(0, 10),
    scheduledTime: getDefaultScheduledTime(),
    crewId: "",
    observations: "",
    address: "",
    locality: "",
    technology: "",
    currentAddress: "",
    newAddress: "",
    currentLocality: "",
    newLocality: "",
    currentTechnology: "",
    newTechnology: "",
    currentContractedPlan: "",
    newContractedPlan: "",
    napBox: "",
    napPort: "",
    onuSerial: "",
    serviceReason: "",
    serviceDetail: "",
    cancellationReason: "",
    equipmentToRemove: "",
    surveyReason: "",
    postventaDetail: "",
    customerCompany: "",
    externalReference: "",
    clientOrderNumber: "",
    province: "",
    postalCode: "",
    sharedLocation: "",
    currentSharedLocation: "",
    newSharedLocation: "",
    observationsForCrew: "",
    contractedPlan: "",
    amountToCollect: "",
    latitude: null,
    longitude: null,
    currentLatitude: null,
    currentLongitude: null,
    newLatitude: null,
    newLongitude: null,
  }
}

export function isWorkOrderTask(
  task: Pick<Task, "projectCode" | "serviceType">
): boolean {
  return task.projectCode === WORK_ORDER_PROJECT_CODE || Boolean(task.serviceType)
}

export function isNewInstallationWorkOrder(
  serviceType: WorkOrderFormInput["serviceType"]
): boolean {
  return serviceType === "instalacion-nueva"
}

export function requiresCustomerLookup(
  serviceType: WorkOrderFormInput["serviceType"]
): boolean {
  return Boolean(serviceType) && serviceType !== "instalacion-nueva"
}

export function getWorkOrderServiceTypeLabel(
  serviceType: string | null | undefined
): string | null {
  if (!serviceType) return null
  return (
    WORK_ORDER_SERVICE_TYPE_LABELS[serviceType as WorkOrderServiceType] ??
    serviceType
  )
}

export function resolveTaskOperationalTitle(task: Task): string {
  return getWorkOrderServiceTypeLabel(task.serviceType) ?? task.title
}

function resolveTechnologyType(technology: WorkOrderTechnology | ""): TaskType {
  return technology === "wireless" ? "wireless" : "fiber"
}

function resolveTaskTypeFromForm(input: WorkOrderFormInput): TaskType {
  switch (input.serviceType) {
    case "instalacion-nueva":
    case "cambio-domicilio":
    case "cambio-tecnologia":
      return resolveTechnologyType(
        input.newTechnology || input.technology || input.currentTechnology
      )
    case "service-tecnico":
    case "reconexion":
    case "postventa":
      return "maintenance"
    case "baja":
      return "maintenance"
    case "retiro-equipos":
      return "maintenance"
    case "relevamiento":
      return "maintenance"
    default:
      return resolveTechnologyType(input.technology)
  }
}

function buildTaskMetadata(input: WorkOrderFormInput): Record<string, unknown> {
  const email = input.customerEmail.trim() || undefined
  const importFields = {
    ...(input.externalReference.trim()
      ? { referenciaExterna: input.externalReference.trim() }
      : {}),
    ...(input.province.trim() ? { provincia: input.province.trim() } : {}),
    ...(input.postalCode.trim()
      ? { codigoPostal: input.postalCode.trim() }
      : {}),
  }

  let metadata: Record<string, unknown>

  switch (input.serviceType) {
    case "instalacion-nueva":
      metadata = {
        email,
        technology: input.technology || "fiber",
        ...buildFtthMetadataFromForm(input),
      }
      break
    case "cambio-domicilio":
      metadata = {
        email,
        currentTechnology: input.currentTechnology || input.technology || "fiber",
        newTechnology: input.newTechnology || input.technology || "fiber",
        currentContractedPlan:
          resolveCurrentContractedPlanFromForm(input) ?? undefined,
        newContractedPlan: resolveContractedPlanFromForm(input) ?? undefined,
        technology: input.newTechnology || input.technology || "fiber",
        ...buildCambioDomicilioMetadataFromForm(input),
        ...buildFtthMetadataFromForm(input),
      }
      break
    case "cambio-tecnologia":
      metadata = {
        email,
        currentTechnology: input.currentTechnology || "fiber",
        newTechnology: input.newTechnology || "fiber",
        currentContractedPlan:
          resolveCurrentContractedPlanFromForm(input) ?? undefined,
        newContractedPlan: resolveContractedPlanFromForm(input) ?? undefined,
        technology: input.newTechnology || input.currentTechnology || "fiber",
        ...buildFtthMetadataFromForm(input),
      }
      break
    case "service-tecnico":
      metadata = {
        email,
        reason: input.serviceReason || "sin-conexion",
        detail: input.serviceDetail.trim() || undefined,
      }
      break
    case "reconexion":
      metadata = { email }
      break
    case "baja":
      metadata = {
        email,
        cancellationReason: input.cancellationReason.trim(),
      }
      break
    case "retiro-equipos":
      metadata = {
        email,
        equipmentToRemove: input.equipmentToRemove.trim() || undefined,
      }
      break
    case "relevamiento":
      metadata = {
        email,
        surveyReason: input.surveyReason.trim() || undefined,
      }
      break
    case "postventa":
      metadata = {
        email,
        detail: input.postventaDetail.trim() || undefined,
      }
      break
    default:
      metadata = email ? { email } : {}
  }

  return { ...metadata, ...importFields }
}

function resolvePrimaryAddress(input: WorkOrderFormInput): string {
  switch (input.serviceType) {
    case "cambio-domicilio":
      return input.newAddress.trim() || input.currentAddress.trim()
    case "baja":
      return input.address.trim()
    default:
      return input.address.trim()
  }
}

function resolvePrimaryLocality(input: WorkOrderFormInput): string {
  switch (input.serviceType) {
    case "cambio-domicilio":
      return input.newLocality.trim() || input.currentLocality.trim()
    default:
      return input.locality.trim()
  }
}

export function validateWorkOrderForm(
  input: WorkOrderFormInput
): { valid: boolean; message?: string } {
  if (!input.serviceType) {
    return { valid: false, message: "Seleccione el tipo de trabajo." }
  }

  if (!input.customerName.trim()) {
    return { valid: false, message: "El cliente es obligatorio." }
  }

  if (!input.scheduledDate) {
    return { valid: false, message: "La fecha programada es obligatoria." }
  }

  switch (input.serviceType) {
    case "instalacion-nueva":
      if (!input.address.trim()) {
        return { valid: false, message: "La dirección es obligatoria." }
      }
      if (!input.locality.trim()) {
        return { valid: false, message: "La localidad es obligatoria." }
      }
      if (!input.technology) {
        return { valid: false, message: "Seleccione la tecnología." }
      }
      if (!resolveContractedPlanFromForm(input)) {
        return { valid: false, message: "Seleccione el plan contratado." }
      }
      break
    case "cambio-domicilio":
      if (!input.currentTechnology || !input.newTechnology) {
        return {
          valid: false,
          message: "Indique tecnología actual y tecnología en el nuevo domicilio.",
        }
      }
      if (!input.currentAddress.trim() || !input.newAddress.trim()) {
        return {
          valid: false,
          message: "Indique dirección actual y nueva dirección.",
        }
      }
      if (!input.currentLocality.trim() || !input.newLocality.trim()) {
        return {
          valid: false,
          message: "Indique localidad actual y nueva localidad.",
        }
      }
      if (
        input.currentTechnology === "fiber" &&
        !resolveCurrentContractedPlanFromForm(input)
      ) {
        return {
          valid: false,
          message: "Seleccione el plan actual.",
        }
      }
      if (
        input.newTechnology === "fiber" &&
        !resolveContractedPlanFromForm(input)
      ) {
        return {
          valid: false,
          message: "Seleccione el plan en el nuevo domicilio.",
        }
      }
      break
    case "cambio-tecnologia":
      if (!input.currentTechnology || !input.newTechnology) {
        return {
          valid: false,
          message: "Indique tecnología actual y nueva tecnología.",
        }
      }
      if (
        input.currentTechnology === "fiber" &&
        !resolveCurrentContractedPlanFromForm(input)
      ) {
        return {
          valid: false,
          message: "Seleccione el plan actual.",
        }
      }
      if (
        input.newTechnology === "fiber" &&
        !resolveContractedPlanFromForm(input)
      ) {
        return {
          valid: false,
          message: "Seleccione el plan de la nueva tecnología.",
        }
      }
      if (!input.address.trim()) {
        return { valid: false, message: "La dirección es obligatoria." }
      }
      break
    case "service-tecnico":
      if (!input.address.trim()) {
        return { valid: false, message: "La dirección es obligatoria." }
      }
      if (!input.serviceReason) {
        return { valid: false, message: "Seleccione el motivo del service." }
      }
      if (!input.serviceDetail.trim()) {
        return { valid: false, message: "El detalle del service es obligatorio." }
      }
      break
    case "reconexion":
    case "retiro-equipos":
    case "relevamiento":
    case "postventa":
      if (!input.address.trim()) {
        return { valid: false, message: "La dirección es obligatoria." }
      }
      if (input.serviceType === "postventa" && !input.postventaDetail.trim()) {
        return { valid: false, message: "El detalle de postventa es obligatorio." }
      }
      if (input.serviceType === "relevamiento" && !input.surveyReason.trim()) {
        return {
          valid: false,
          message: "El motivo del relevamiento es obligatorio.",
        }
      }
      if (
        input.serviceType === "retiro-equipos" &&
        !input.equipmentToRemove.trim()
      ) {
        return {
          valid: false,
          message: "Indique el equipo a retirar.",
        }
      }
      break
    case "baja":
      if (!input.cancellationReason.trim()) {
        return { valid: false, message: "El motivo de baja es obligatorio." }
      }
      break
    default:
      break
  }

  return { valid: true }
}

function resolveOperationalStepsForWorkOrder(
  form: WorkOrderFormInput
): CreateTaskPayload["operationalSteps"] {
  const finalTechnology = resolveFinalTechnologyFromForm(form)

  if (
    form.serviceType === "instalacion-nueva" ||
    form.serviceType === "cambio-domicilio" ||
    form.serviceType === "cambio-tecnologia"
  ) {
    const technology =
      finalTechnology === "wireless" ? "wireless" : ("fiber" as const)
    const steps = createInstallationOperationalSteps(technology)

    if (technology === "fiber") {
      return applyFtthValuesToOperationalSteps(steps, {
        napBox: form.napBox,
        napPort: form.napPort,
        onuSerial: form.onuSerial,
      })
    }

    return steps
  }

  return createDefaultOperationalSteps()
}

export function buildWorkOrderCreatePayload(input: {
  form: WorkOrderFormInput
  existingTasks: Task[]
  customerId?: string | null
  crewId?: string | null
  crewName: string
  supervisor: string
  checklist: CreateTaskPayload["checklist"]
}): CreateTaskPayload {
  const { form, existingTasks, customerId, crewId, crewName, supervisor, checklist } =
    input
  const hasCrew = Boolean(crewId && crewName.trim())
  const status: TaskStatus = hasCrew ? "asignada" : "pendiente"
  const serviceLabel =
    WORK_ORDER_SERVICE_TYPE_LABELS[form.serviceType as WorkOrderServiceType] ??
    "Orden de trabajo"

  const customerName = form.customerName.trim()
  const serviceAddress = resolvePrimaryAddress(form)
  const locality = resolvePrimaryLocality(form)
  const sharedLocation =
    form.serviceType === "cambio-domicilio"
      ? form.newSharedLocation.trim() || form.sharedLocation.trim()
      : form.sharedLocation.trim()
  const contractedPlan = resolveContractedPlanFromForm(form)
  const amountToCollect = parseAmountToCollectInput(form.amountToCollect)
  const latitude =
    form.serviceType === "cambio-domicilio"
      ? form.newLatitude ?? form.latitude
      : form.latitude
  const longitude =
    form.serviceType === "cambio-domicilio"
      ? form.newLongitude ?? form.longitude
      : form.longitude

  return {
    code: generateWorkOrderTaskCode(existingTasks),
    title: serviceLabel,
    description: form.observations.trim(),
    projectId: undefined,
    projectCode: WORK_ORDER_PROJECT_CODE,
    projectName: customerName,
    customerName,
    customerPhone: form.customerPhone.trim() || undefined,
    customerCompany: form.customerCompany.trim() || undefined,
    customerId: customerId ?? undefined,
    serviceAddress: serviceAddress || undefined,
    sharedLocation: sharedLocation || undefined,
    observationsForCrew: form.observationsForCrew.trim() || undefined,
    workOrderNumber: form.clientOrderNumber.trim() || undefined,
    type: resolveTaskTypeFromForm(form),
    status,
    priority: "media",
    supervisor: hasCrew ? supervisor : "",
    crewId: hasCrew ? crewId ?? undefined : undefined,
    crew: hasCrew ? crewName : "",
    startDate: form.scheduledDate,
    dueDate: form.scheduledDate,
    scheduledTime: normalizeScheduledTimeForDb(form.scheduledTime),
    estimatedDuration: "",
    checklist,
    operationalSteps: resolveOperationalStepsForWorkOrder(form),
    serviceType: form.serviceType as WorkOrderServiceType,
    locality: locality || undefined,
    taskMetadata: buildTaskMetadata(form),
    contractedPlan: contractedPlan ?? undefined,
    amountToCollect: amountToCollect ?? undefined,
    latitude: latitude ?? undefined,
    longitude: longitude ?? undefined,
  }
}

export function resolveWorkOrderTechnologyFromTask(
  task: Pick<Task, "type" | "taskMetadata">
): WorkOrderTechnology | "" {
  if (task.type === "wireless") return "wireless"
  if (task.type === "fiber") return "fiber"

  const metadataTechnology = task.taskMetadata?.technology
  if (metadataTechnology === "wireless" || metadataTechnology === "fiber") {
    return metadataTechnology
  }

  return ""
}

export function buildCommercialFormFromTask(
  task: Task
): Pick<
  WorkOrderFormInput,
  "serviceType" | "technology" | "contractedPlan"
> {
  const technology = resolveWorkOrderTechnologyFromTask(task)
  const contractedPlan =
    task.contractedPlan === "50Mb" ||
    task.contractedPlan === "100Mb" ||
    task.contractedPlan === "300Mb" ||
    task.contractedPlan === "20Mb"
      ? task.contractedPlan
      : ""

  return {
    serviceType: (task.serviceType as WorkOrderServiceType) ?? "",
    technology,
    contractedPlan,
  }
}

export function buildAmountToCollectFormFromTask(task: Task): string {
  return formatAmountToCollectFormValue(task.amountToCollect)
}

export function buildLocationFormFromTask(
  task: Task
): Pick<WorkOrderFormInput, "sharedLocation"> {
  return {
    sharedLocation: task.sharedLocation ?? "",
  }
}

export function buildScheduleFormFromTask(
  task: Task
): Pick<WorkOrderFormInput, "scheduledDate" | "scheduledTime"> {
  return {
    scheduledDate: task.dueDate,
    scheduledTime:
      formatScheduledTimeForInput(task.scheduledTime) || getDefaultScheduledTime(),
  }
}
