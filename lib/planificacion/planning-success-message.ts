import { formatPlanningConfirmDateTime } from "@/lib/planificacion/planning-confirm-session"

export type PlanningSuccessMessage = {
  id: string
  title: string
  description: string
}

export function buildPlanningDispatchSuccessMessage(input: {
  id: string
  scopeLabel: string
  supervisor: string
  date: string
  confirmedAt: string
  taskCount: number
}): PlanningSuccessMessage {
  const otLabel =
    input.taskCount === 1 ? "1 OT" : `${input.taskCount} OT`
  const formattedDate = formatPlanningConfirmDateTime(input.confirmedAt)

  return {
    id: input.id,
    title: input.scopeLabel,
    description: `Se confirmó ${otLabel}. Supervisor: ${input.supervisor}. Fecha de jornada: ${input.date}. Registrado: ${formattedDate}.`,
  }
}
