import type { OperationalEventActor } from "@/lib/tasks/operational-event-actor"
import { applyOperationalEventActor } from "@/lib/tasks/operational-event-actor"
import type { TaskOperationalEventInsert } from "@/lib/types/operational-control"
import type { Task } from "@/lib/types/tasks"

type BaseEventInput = {
  companyId: string
  task: Pick<Task, "id">
  actor: OperationalEventActor
}

function baseEvent(
  input: BaseEventInput,
  fields: Omit<
    TaskOperationalEventInsert,
    "companyId" | "taskId" | "actorUserId" | "actorEmployeeId" | "actorDisplayName"
  >
): TaskOperationalEventInsert {
  return applyOperationalEventActor(
    {
      companyId: input.companyId,
      taskId: input.task.id,
      ...fields,
    },
    input.actor
  )
}

export function buildCreatedOperationalEvent(
  input: BaseEventInput & { description?: string }
): TaskOperationalEventInsert {
  return baseEvent(input, {
    eventType: "created",
    title: "Creó la OT",
    description: input.description?.trim() ?? "",
  })
}

export function buildPlanningConfirmedOperationalEvent(
  input: BaseEventInput & {
    crewName?: string
    dueDate?: string
  }
): TaskOperationalEventInsert {
  const crew = input.crewName?.trim()
  const dueDate = input.dueDate?.trim()
  const details = [crew ? `Cuadrilla: ${crew}` : "", dueDate ? `Fecha: ${dueDate}` : ""]
    .filter(Boolean)
    .join(" · ")

  return baseEvent(input, {
    eventType: "planning_confirmed",
    title: "Confirmó la planificación",
    description: details,
    payload: {
      crewName: crew ?? "",
      dueDate: dueDate ?? "",
    },
  })
}

export function buildAssignedOperationalEvent(
  input: BaseEventInput & {
    crewName?: string
    supervisor?: string
  }
): TaskOperationalEventInsert {
  const crew = input.crewName?.trim()
  return baseEvent(input, {
    eventType: "assigned",
    title: "Asignó la cuadrilla",
    description: crew ? `Cuadrilla: ${crew}` : "",
    payload: {
      crewName: crew ?? "",
      supervisor: input.supervisor?.trim() ?? "",
    },
  })
}

export function buildStartedOperationalEvent(
  input: BaseEventInput & {
    source?: "web" | "mobile"
    latitude?: number
    longitude?: number
  }
): TaskOperationalEventInsert {
  return baseEvent(input, {
    eventType: "started",
    title: "Inició la OT",
    description:
      input.source === "mobile" ? "Inicio desde Field Agent." : "",
    payload: {
      source: input.source ?? "web",
      ...(input.latitude != null ? { latitude: input.latitude } : {}),
      ...(input.longitude != null ? { longitude: input.longitude } : {}),
    },
  })
}

export function buildChecklistCompletedOperationalEvent(
  input: BaseEventInput & { source?: "web" | "mobile" }
): TaskOperationalEventInsert {
  return baseEvent(input, {
    eventType: "checklist_completed",
    title: "Completó el checklist",
    description:
      input.source === "mobile"
        ? "Checklist operativo completado en Field Agent."
        : "Checklist operativo completado.",
    payload: {
      source: input.source ?? "web",
    },
  })
}

export function buildTrabajoRealizadoOperationalEvent(
  input: BaseEventInput & {
    trabajoRealizado: string
    source?: "web" | "mobile"
  }
): TaskOperationalEventInsert {
  const text = input.trabajoRealizado.trim()
  return baseEvent(input, {
    eventType: "trabajo_realizado",
    title: "Registró el trabajo realizado",
    description: text.length > 180 ? `${text.slice(0, 177)}…` : text,
    observations: text,
    payload: {
      source: input.source ?? "web",
      trabajoRealizado: text,
    },
  })
}

export function buildIncidentOperationalEvent(
  input: BaseEventInput & {
    reasonLabel: string
    observation: string
    incidentId?: string | null
    source?: "web" | "mobile"
  }
): TaskOperationalEventInsert {
  return baseEvent(input, {
    eventType: "incident_created",
    title: "Reportó incidencia",
    description: input.reasonLabel,
    observations: input.observation.trim(),
    payload: {
      reasonLabel: input.reasonLabel,
      notes: input.observation.trim(),
      incidentId: input.incidentId ?? null,
      source: input.source ?? "web",
    },
  })
}

export function buildIncidentResolvedOperationalEvent(
  input: BaseEventInput & {
    action: "continue" | "reprogram" | "cancel"
    comment?: string
    incidentId?: string | null
  }
): TaskOperationalEventInsert {
  const actionLabel =
    input.action === "continue"
      ? "continuá en curso"
      : input.action === "reprogram"
        ? "reprogramación"
        : "cancelación"

  return baseEvent(input, {
    eventType: "incident_resolved",
    title: "Resolvió la incidencia",
    description: `Resolución: ${actionLabel}.`,
    observations: input.comment?.trim() ?? "",
    payload: {
      resolveAction: input.action,
      notes: input.comment?.trim() ?? "",
      incidentId: input.incidentId ?? null,
    },
  })
}

export function buildPendingClosureOperationalEvent(
  input: BaseEventInput & { source?: "web" | "mobile" }
): TaskOperationalEventInsert {
  return baseEvent(input, {
    eventType: "pending_closure",
    title: "Solicitó aprobación",
    description:
      input.source === "mobile"
        ? "Cierre solicitado desde Field Agent."
        : "",
    payload: {
      source: input.source ?? "web",
    },
  })
}

export function buildApprovedOperationalEvent(
  input: BaseEventInput
): TaskOperationalEventInsert {
  return baseEvent(input, {
    eventType: "approved",
    title: "Aprobó la OT",
  })
}

export function buildRejectedOperationalEvent(
  input: BaseEventInput & { reason: string }
): TaskOperationalEventInsert {
  return baseEvent(input, {
    eventType: "rejected",
    title: "Rechazó la OT",
    description: input.reason.trim(),
    observations: input.reason.trim(),
    payload: {
      notes: input.reason.trim(),
    },
  })
}

export function buildResumedOperationalEvent(
  input: BaseEventInput
): TaskOperationalEventInsert {
  return baseEvent(input, {
    eventType: "note",
    title: "Reanudó la OT",
    description: "La orden volvió a En curso tras la incidencia.",
  })
}
