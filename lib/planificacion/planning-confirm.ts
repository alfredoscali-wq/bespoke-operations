import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import {
  filterPlanningSessionTasks,
  isCrewPlanningComplete,
  listActiveCrewsWithPlanningTasks,
} from "@/lib/planificacion/planning-crew-state"
import {
  filterProgrammedTasksForPlanning,
  resolveTaskPlanningCoordinates,
  taskHasEstimatedDuration,
  taskHasSuggestedCrew,
} from "@/lib/planificacion/planning-utils"
import type { Crew } from "@/lib/types/crews"
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

  if (scoped.length === 0) {
    return {
      taskCount: 0,
      canConfirm: false,
      disabledReason: "No hay órdenes de trabajo programadas para esta fecha.",
      validationError: null,
      taskIds: [],
    }
  }

  const readiness = evaluateScopedPlanningConfirmReadiness(scoped)

  if (!readiness.canConfirm && readiness.validationError) {
    return {
      ...readiness,
      validationError: readiness.validationError
        .replace(/despachar/g, "confirmar la jornada")
        .replace(/Despachar/g, "Confirmar la jornada"),
    }
  }

  return readiness
}

function evaluateScopedPlanningConfirmReadiness(
  scoped: Task[]
): PlanningConfirmReadiness {
  const taskIds = scoped.map((task) => task.id)

  if (scoped.length === 0) {
    return {
      taskCount: 0,
      canConfirm: false,
      disabledReason: "No hay órdenes de trabajo programadas para confirmar.",
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
          ? "Hay 1 OT sin cuadrilla asignada. Asigne cuadrilla antes de confirmar."
          : `Hay ${withoutCrew.length} OT sin cuadrilla asignada. Asigne cuadrilla antes de confirmar.`,
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
          ? "Hay 1 OT sin GPS. Resuelva la ubicación antes de confirmar."
          : `Hay ${withoutGps.length} OT sin GPS. Resuelva la ubicación antes de confirmar.`,
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
          ? "Hay 1 OT sin duración estimada. Complete la duración antes de confirmar."
          : `Hay ${withoutDuration.length} OT sin duración estimada. Complete la duración antes de confirmar.`,
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

export function evaluatePlanningCrewConfirmReadiness(
  tasks: Task[],
  date: string,
  crew: Pick<Crew, "id" | "name">
): PlanningConfirmReadiness {
  const scoped = listProgrammedTasksForPlanningDate(tasks, date).filter((task) =>
    taskMatchesCrewId(task, crew)
  )

  if (scoped.length === 0) {
    return {
      taskCount: 0,
      canConfirm: false,
      disabledReason: "No hay órdenes de trabajo para planificar en esta cuadrilla.",
      validationError: null,
      taskIds: [],
    }
  }

  const readiness = evaluateScopedPlanningConfirmReadiness(scoped)

  if (!readiness.canConfirm && readiness.validationError) {
    return {
      ...readiness,
      validationError: readiness.validationError
        .replace(/confirmar/g, "planificar")
        .replace(/Confirmar/g, "Planificar"),
    }
  }

  return readiness
}

export function evaluateJourneyPlanningConfirmReadiness(
  tasks: Task[],
  date: string,
  activeCrews: Crew[]
): PlanningConfirmReadiness {
  const sessionTasks = filterPlanningSessionTasks(tasks, { date })
  const crewsWithTasks = listActiveCrewsWithPlanningTasks(
    tasks,
    date,
    activeCrews
  )
  const taskIds = sessionTasks.map((task) => task.id)

  if (sessionTasks.length === 0) {
    return {
      taskCount: 0,
      canConfirm: false,
      disabledReason: "No hay órdenes de trabajo para esta jornada.",
      validationError: null,
      taskIds: [],
    }
  }

  const pendingCrews = crewsWithTasks.filter(
    (crew) => !isCrewPlanningComplete(tasks, date, crew)
  )

  if (pendingCrews.length > 0) {
    const crewNames = pendingCrews.map((crew) => crew.name).join(", ")

    return {
      taskCount: sessionTasks.length,
      canConfirm: false,
      disabledReason: `Faltan cuadrillas por planificar: ${crewNames}.`,
      validationError: null,
      taskIds,
    }
  }

  return {
    taskCount: sessionTasks.length,
    canConfirm: true,
    disabledReason: null,
    validationError: null,
    taskIds,
  }
}
