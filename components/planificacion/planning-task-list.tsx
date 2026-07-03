"use client"



import { useMemo } from "react"



import { PlanningTaskTableRow } from "@/components/planificacion/planning-task-table-row"

import { ScrollArea } from "@/components/ui/scroll-area"

import {

  buildPlanningCrewColorIndex,

  PLANNING_CREW_PIN_COLORS,

  PLANNING_PIN_COLOR_NO_CREW,

} from "@/lib/planificacion/planning-map-markers"

import { resolveExecutionOrderMoveAvailability } from "@/lib/planificacion/planning-execution-order"

import type { PlanningDispatchMode } from "@/lib/planificacion/planning-dispatch"

import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"

import { sortTasksByDispatchRoute } from "@/lib/tasks/dispatch-order"

import type { Crew } from "@/lib/types/crews"

import type { Task } from "@/lib/types/tasks"

import { cn } from "@/lib/utils"



type PlanningTaskListProps = {

  mode: PlanningDispatchMode

  tasks: Task[]

  allScopeTasks: Task[]

  crews: Pick<Crew, "id" | "name">[]

  crewIdsInOrder: string[]

  selectedTaskId: string | null

  reorderingTaskId?: string | null

  onSelectTask: (taskId: string) => void

  onEditTask?: (taskId: string) => void

  onMoveTaskOrder?: (taskId: string, direction: "up" | "down") => void

  isTaskEditable?: (task: Task) => boolean

  activeCrewFilterName?: string | null

  className?: string

}



export function PlanningTaskList({

  mode,

  tasks,

  allScopeTasks,

  crews,

  crewIdsInOrder,

  selectedTaskId,

  reorderingTaskId = null,

  onSelectTask,

  onEditTask,

  onMoveTaskOrder,

  isTaskEditable,

  activeCrewFilterName = null,

  className,

}: PlanningTaskListProps) {

  const readOnly = mode === "confirmed"



  const crewColorIndex = useMemo(

    () => buildPlanningCrewColorIndex(crewIdsInOrder),

    [crewIdsInOrder]

  )



  const sortedTasks = useMemo(

    () => sortTasksByDispatchRoute(tasks, crews),

    [tasks, crews]

  )



  const title = readOnly ? "Despacho confirmado" : "Órdenes de trabajo"

  const emptyMessage = activeCrewFilterName

    ? `No hay órdenes asignadas a ${activeCrewFilterName} para esta jornada.`

    : readOnly

      ? "No hay órdenes en el despacho confirmado para esta fecha."

      : "No hay órdenes programadas para la fecha seleccionada."

  const subtitle = activeCrewFilterName

    ? `${activeCrewFilterName} · ${sortedTasks.length} OT en la jornada`

    : readOnly

      ? "Todas las OT confirmadas para la jornada"

      : "Todas las OT programadas para la jornada"



  function resolveCrewBandColor(task: Task): string {

    const crewId = resolveTaskCrewId(task, crews)

    if (!crewId) {

      return PLANNING_PIN_COLOR_NO_CREW

    }



    const index = crewColorIndex.get(crewId)

    if (index === undefined) {

      return PLANNING_PIN_COLOR_NO_CREW

    }



    return PLANNING_CREW_PIN_COLORS[index % PLANNING_CREW_PIN_COLORS.length]

  }



  function isRowEditable(task: Task): boolean {

    if (readOnly) {

      return false

    }



    return isTaskEditable ? isTaskEditable(task) : true

  }



  function resolveMoveAvailability(task: Task): {

    canMoveUp: boolean

    canMoveDown: boolean

  } {

    if (!isRowEditable(task) || !onMoveTaskOrder) {

      return { canMoveUp: false, canMoveDown: false }

    }



    return resolveExecutionOrderMoveAvailability(
      allScopeTasks,
      task.id,
      crews
    )

  }



  return (

    <section

      className={cn(

        "flex min-h-0 h-full w-full shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm",

        className

      )}

    >

      <div className="border-b px-4 py-3">

        <h2 className="text-sm font-semibold text-foreground">{title}</h2>

        <p className="text-xs text-muted-foreground">{subtitle}</p>

      </div>



      <ScrollArea className="min-h-0 flex-1">

        {sortedTasks.length === 0 ? (

          <p className="px-4 py-8 text-center text-sm text-muted-foreground">

            {emptyMessage}

          </p>

        ) : (

          <div className="min-w-[960px]">

            <table className="w-full border-collapse text-left">

              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">

                <tr className="border-b text-xs font-medium uppercase tracking-wide text-muted-foreground">

                  <th className="w-0 p-0" aria-hidden />

                  <th className="px-2 py-2.5 text-center">Orden</th>

                  <th className="w-10 px-1 py-2.5 text-center" aria-label="Mover orden" />

                  <th className="px-2 py-2.5">Código OT</th>

                  <th className="px-2 py-2.5">Cliente</th>

                  <th className="px-2 py-2.5">Localidad</th>

                  <th className="px-2 py-2.5">Turno</th>

                  <th className="px-2 py-2.5">Duración</th>

                  <th className="px-2 py-2.5">Estado</th>

                  <th className="w-10 px-2 py-2.5" aria-label="Editar" />

                </tr>

              </thead>

              <tbody>

                {sortedTasks.map((task) => {

                  const crewColor = resolveCrewBandColor(task)

                  const rowEditable = isRowEditable(task)

                  const { canMoveUp, canMoveDown } = resolveMoveAvailability(task)



                  return (

                    <PlanningTaskTableRow

                      key={task.id}

                      task={task}

                      crewColor={crewColor}

                      readOnly={!rowEditable}

                      selected={task.id === selectedTaskId}

                      canMoveUp={canMoveUp}

                      canMoveDown={canMoveDown}

                      isReordering={reorderingTaskId === task.id}

                      onSelect={() => onSelectTask(task.id)}

                      onEdit={

                        onEditTask && rowEditable

                          ? () => onEditTask(task.id)

                          : undefined

                      }

                      onMoveUp={

                        onMoveTaskOrder && canMoveUp

                          ? () => onMoveTaskOrder(task.id, "up")

                          : undefined

                      }

                      onMoveDown={

                        onMoveTaskOrder && canMoveDown

                          ? () => onMoveTaskOrder(task.id, "down")

                          : undefined

                      }

                    />

                  )

                })}

              </tbody>

            </table>

          </div>

        )}

      </ScrollArea>

    </section>

  )

}


