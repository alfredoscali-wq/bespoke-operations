/**
 * Pure helpers to decide which Customer Service activities to emit.
 * No I/O — used by server instrumentation.
 */

import { ACTIVITY_ACTIONS } from "@/lib/activity-engine/activity-actions"
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_IMPACTS,
} from "@/lib/activity-engine/activity-types"
import type { CustomerAtencionNextStep } from "@/lib/types/customer-atenciones"

/** next_step values that represent a derivation out of Atención. */
export const CUSTOMER_SERVICE_DERIVATION_NEXT_STEPS = [
  "realizar_retencion",
  "resolver_consulta_tecnica",
  "derivar_admin_facturacion",
  "derivar_admin_morosos",
  "derivar_admin_gestion",
  "contactar_cliente",
  "generar_ot",
] as const

export function isCustomerServiceDerivationNextStep(
  nextStep: string | null | undefined
): boolean {
  return Boolean(
    nextStep &&
      (CUSTOMER_SERVICE_DERIVATION_NEXT_STEPS as readonly string[]).includes(
        nextStep
      )
  )
}

export function buildCaseCreatedActivity(input: {
  customerId: string
  motivo: string
  canal: string
  estadoInicial: string
  prioridad?: string | null
  nextStep?: string | null
}) {
  return {
    action: ACTIVITY_ACTIONS.CASE_CREATED,
    category: ACTIVITY_CATEGORIES.FOLLOW_UP,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    title: "Expediente creado",
    description: "Se registró un nuevo expediente de Atención al Cliente.",
    metadata: {
      customer_id: input.customerId,
      motivo: input.motivo,
      canal: input.canal,
      prioridad: input.prioridad ?? null,
      estado_inicial: input.estadoInicial,
      next_step: input.nextStep ?? null,
    },
  }
}

export function buildFollowUpCreatedActivity(input: {
  seguimientoId: string
  tipo?: string | null
  resultado?: string | null
  nextStep?: string | null
}) {
  return {
    action: ACTIVITY_ACTIONS.FOLLOW_UP_CREATED,
    category: ACTIVITY_CATEGORIES.FOLLOW_UP,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    title: "Seguimiento agregado",
    description: "Se registró un seguimiento sobre el expediente.",
    metadata: {
      seguimiento_id: input.seguimientoId,
      tipo: input.tipo ?? null,
      resultado: input.resultado ?? null,
      next_step: input.nextStep ?? null,
    },
  }
}

export function buildNoteCreatedActivity(input: {
  length: number
  hasAttachments?: boolean
}) {
  return {
    action: ACTIVITY_ACTIONS.NOTE_CREATED,
    category: ACTIVITY_CATEGORIES.COMMUNICATION,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    title: "Nota registrada",
    description: "Se agregó una nota al expediente.",
    metadata: {
      longitud: input.length,
      tiene_adjuntos: Boolean(input.hasAttachments),
    },
  }
}

export function buildStatusChangedActivity(input: {
  oldStatus: string
  newStatus: string
}) {
  return {
    action: ACTIVITY_ACTIONS.STATUS_CHANGED,
    category: ACTIVITY_CATEGORIES.OPERATIONAL,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    title: "Estado actualizado",
    description: `El expediente pasó de ${input.oldStatus} a ${input.newStatus}.`,
    metadata: {
      old_status: input.oldStatus,
      new_status: input.newStatus,
    },
  }
}

export function buildNextStepChangedActivity(input: {
  previousNextStep: string | null
  newNextStep: string | null
}) {
  return {
    action: ACTIVITY_ACTIONS.NEXT_STEP_CHANGED,
    category: ACTIVITY_CATEGORIES.OPERATIONAL,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    title: "Próximo paso actualizado",
    description: "Se actualizó el próximo paso del expediente.",
    metadata: {
      previous_next_step: input.previousNextStep,
      new_next_step: input.newNextStep,
    },
  }
}

export function buildDerivationCreatedActivity(input: {
  fromArea: string
  toArea: string
  motivo?: string | null
}) {
  return {
    action: ACTIVITY_ACTIONS.DERIVATION_CREATED,
    category: ACTIVITY_CATEGORIES.OPERATIONAL,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    title: "Expediente derivado",
    description: "El expediente fue derivado a otra área o circuito.",
    metadata: {
      from_area: input.fromArea,
      to_area: input.toArea,
      motivo: input.motivo ?? null,
    },
  }
}

export function buildOtCreatedActivity(input: {
  taskId: string
  projectId?: string | null
  technology?: string | null
  priority?: string | null
}) {
  return {
    action: ACTIVITY_ACTIONS.OT_CREATED,
    category: ACTIVITY_CATEGORIES.TECHNICAL,
    impact: ACTIVITY_IMPACTS.PRODUCTION,
    title: "OT generada",
    description: "Se vinculó o generó una Orden de Trabajo desde Atención.",
    metadata: {
      task_id: input.taskId,
      project_id: input.projectId ?? null,
      technology: input.technology ?? null,
      priority: input.priority ?? null,
    },
  }
}

export function buildCaseClosedActivity(input: {
  resultado?: string | null
  motivoCierre?: string | null
}) {
  return {
    action: ACTIVITY_ACTIONS.CASE_CLOSED,
    category: ACTIVITY_CATEGORIES.FOLLOW_UP,
    impact: ACTIVITY_IMPACTS.RESULT,
    title: "Expediente cerrado",
    description: "El expediente quedó resuelto.",
    metadata: {
      resultado: input.resultado ?? null,
      motivo_cierre: input.motivoCierre ?? null,
    },
  }
}

/** Sprint 1.1C — unified client contact interaction. */
export function buildCustomerInteractionActivity(input: {
  title: string
  description: string
  medio: string
  resultado: string
  nextStep?: string | null
  expedienteId: string
  customerId?: string | null
}) {
  return {
    action: ACTIVITY_ACTIONS.CUSTOMER_INTERACTION,
    category: ACTIVITY_CATEGORIES.CONTACT,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    title: input.title,
    description: input.description,
    metadata: {
      medio: input.medio,
      resultado: input.resultado,
      next_step: input.nextStep ?? null,
      expediente: input.expedienteId,
      customer_id: input.customerId ?? null,
    },
  }
}

export function resolveDerivationAreas(input: {
  previousNextStep: CustomerAtencionNextStep | string | null
  newNextStep: CustomerAtencionNextStep | string | null
}): { fromArea: string; toArea: string } | null {
  if (
    !input.newNextStep ||
    !isCustomerServiceDerivationNextStep(input.newNextStep)
  ) {
    return null
  }

  return {
    fromArea: input.previousNextStep?.trim() || "atencion",
    toArea: input.newNextStep,
  }
}
