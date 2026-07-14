import { resolvePlanningTaskCrewObservations } from "@/lib/planificacion/planning-task-observations"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type PlanningTaskObservationsBlockProps = {
  task: Pick<Task, "observationsForCrew" | "description">
  className?: string
  title?: string
}

export function PlanningTaskObservationsBlock({
  task,
  className,
  title = "Información para la Cuadrilla",
}: PlanningTaskObservationsBlockProps) {
  const observations = resolvePlanningTaskCrewObservations(task)

  if (!observations) {
    return null
  }

  return (
    <div className={cn("border-t pt-3", className)}>
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
        {observations}
      </p>
    </div>
  )
}
