import {
  filterProgrammedTasksForPlanning,
  resolveTaskPlanningCoordinates,
  taskHasEstimatedDuration,
  taskHasSuggestedCrew,
} from "@/lib/planificacion/planning-utils"
import type { Task } from "@/lib/types/tasks"

export type PlanningConfirmReadiness = {
  taskCount: number
  canConfirm: boolean
  disabledReason: string | null
  validationError: string | null
  taskIds: string[]
}

export function listProgrammedTasksForPlanningDate(
  tasks: Task[],
  date: string
): Task[] {
  return filterProgrammedTasksForPlanning(tasks, { date })
}

export function evaluatePlanningConfirmReadiness(
  tasks: Task[],
  date: string
): PlanningConfirmReadiness {
  const scoped = listProgrammedTasksForPlanningDate(tasks, date)
  const taskIds = scoped.map((task) => task.id)

  if (scoped.length === 0) {
    return {
      taskCount: 0,
      canConfirm: false,
      disabledReason: "No hay órdenes de trabajo programadas para esta fecha.",
      validationError: null,
      taskIds,
    }
  }

  const withoutCrew = scoped.filter((task) => !taskHasSuggestedCrew(task))
  if (withoutCrew.length > 0) {
    return {
      taskCount: scoped.length,
      canConfirm: false,
      disabledReason: null,
      validationError:
        withoutCrew.length === 1
          ? "Hay 1 OT sin cuadrilla asignada. Asigne cuadrilla antes de confirmar la planificación."
          : `Hay ${withoutCrew.length} OT sin cuadrilla asignada. Asigne cuadrilla antes de confirmar la planificación.`,
      taskIds,
    }
  }

  const withoutGps = scoped.filter(
    (task) => resolveTaskPlanningCoordinates(task) == null
  )
  if (withoutGps.length > 0) {
    return {
      taskCount: scoped.length,
      canConfirm: false,
      disabledReason: null,
      validationError:
        withoutGps.length === 1
          ? "Hay 1 OT sin GPS. Resuelva la ubicación antes de confirmar la planificación."
          : `Hay ${withoutGps.length} OT sin GPS. Resuelva la ubicación antes de confirmar la planificación.`,
      taskIds,
    }
  }

  const withoutDuration = scoped.filter((task) => !taskHasEstimatedDuration(task))
  if (withoutDuration.length > 0) {
    return {
      taskCount: scoped.length,
      canConfirm: false,
      disabledReason: null,
      validationError:
        withoutDuration.length === 1
          ? "Hay 1 OT sin duración estimada. Complete la duración antes de confirmar la planificación."
          : `Hay ${withoutDuration.length} OT sin duración estimada. Complete la duración antes de confirmar la planificación.`,
      taskIds,
    }
  }

  return {
    taskCount: scoped.length,
    canConfirm: true,
    disabledReason: null,
    validationError: null,
    taskIds,
  }
}
