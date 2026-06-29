"use client"

import { useMemo, useState } from "react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { PlanningAccessGuard } from "@/components/planificacion/planning-access-guard"
import { PlanningAlertsPanel } from "@/components/planificacion/planning-alerts-panel"
import { PlanningCrewPanel } from "@/components/planificacion/planning-crew-panel"
import {
  PlanningMap,
  resolvePlanningShiftLabel,
} from "@/components/planificacion/planning-map"
import { PlanningTaskEditSheet } from "@/components/planificacion/planning-task-edit-sheet"
import { PlanningTaskList } from "@/components/planificacion/planning-task-list"
import { PlanningToolbar } from "@/components/planificacion/planning-toolbar"
import { useTasks } from "@/components/tareas/tasks-provider"
import { isCrewAssignable } from "@/lib/crews/status-workflow"
import {
  buildPlanningCrewSummaries,
  computePlanningAlerts,
  computePlanningKpis,
  filterProgrammedTasksForPlanning,
} from "@/lib/planificacion/planning-utils"
import type { WorkOrderShift } from "@/lib/tasks/work-order"

function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

function PlanningModuleContent() {
  const { tasks, isTasksReady } = useTasks()
  const { crews } = useCrews()
  const [date, setDate] = useState(todayDateInputValue)
  const [shift, setShift] = useState<WorkOrderShift>("manana")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const activeCrews = useMemo(
    () => crews.filter(isCrewAssignable),
    [crews]
  )

  const filteredTasks = useMemo(
    () => filterProgrammedTasksForPlanning(tasks, { date, shift }),
    [tasks, date, shift]
  )

  const kpis = useMemo(
    () => computePlanningKpis(filteredTasks, activeCrews),
    [filteredTasks, activeCrews]
  )

  const crewSummaries = useMemo(
    () => buildPlanningCrewSummaries(filteredTasks, activeCrews, shift),
    [filteredTasks, activeCrews, shift]
  )

  const alerts = useMemo(
    () => computePlanningAlerts(filteredTasks, crewSummaries),
    [filteredTasks, crewSummaries]
  )

  const editingTask = useMemo(
    () => tasks.find((task) => task.id === editingTaskId) ?? null,
    [tasks, editingTaskId]
  )

  const shiftLabel = resolvePlanningShiftLabel(shift)

  if (!isTasksReady) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
        Cargando planificación operativa...
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-4">
      <PlanningToolbar
        date={date}
        shift={shift}
        kpis={kpis}
        onDateChange={(nextDate) => {
          setDate(nextDate)
          setSelectedTaskId(null)
          setEditingTaskId(null)
        }}
        onShiftChange={(nextShift) => {
          setShift(nextShift)
          setSelectedTaskId(null)
          setEditingTaskId(null)
        }}
      />

      <PlanningAlertsPanel alerts={alerts} />

      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
        <PlanningTaskList
          tasks={filteredTasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          onEditTask={setEditingTaskId}
        />
        <PlanningMap
          tasks={filteredTasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          shiftLabel={shiftLabel}
        />
        <PlanningCrewPanel summaries={crewSummaries} />
      </div>

      <PlanningTaskEditSheet
        task={editingTask}
        open={editingTaskId != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTaskId(null)
          }
        }}
      />
    </div>
  )
}

export function PlanningModule() {
  return (
    <PlanningAccessGuard>
      <PlanningModuleContent />
    </PlanningAccessGuard>
  )
}
