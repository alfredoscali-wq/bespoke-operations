"use client"

import { PlanningIncidentTaskContextPanel } from "@/components/planificacion/planning-incident-task-context-panel"
import { TaskAdminOperationalChecklist } from "@/components/tareas/task-admin-operational-checklist"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import {
  PLANNING_PENDING_CLOSURE_DETAIL_SECTIONS,
  resolvePendingClosureTechnicianObservations,
  selectPendingClosureBriefHistory,
  selectPendingClosureOperationalEvidences,
} from "@/lib/planificacion/planning-pending-closure-detail"
import type { Task, TaskDetail } from "@/lib/types/tasks"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type PlanningPendingClosureDetailPanelProps = {
  task: Task
  detail: TaskDetail
  crewLabel: string
  operatorLabel: string
}

export function PlanningPendingClosureDetailPanel({
  task,
  detail,
  crewLabel,
  operatorLabel,
}: PlanningPendingClosureDetailPanelProps) {
  const technicianObservations = resolvePendingClosureTechnicianObservations(
    task,
    detail
  )
  const briefHistory = selectPendingClosureBriefHistory(detail.history)
  const operationalEvidences = selectPendingClosureOperationalEvidences(
    detail.evidence
  )

  return (
    <div
      className="space-y-4"
      data-testid="planning-pending-closure-detail-panel"
      data-sections={PLANNING_PENDING_CLOSURE_DETAIL_SECTIONS.join(",")}
    >
      <div data-testid="planning-pending-closure-section-ot">
        <PlanningIncidentTaskContextPanel
          task={task}
          crewLabel={crewLabel}
          operatorLabel={operatorLabel}
          showStatus={false}
        />
      </div>

      <div
        className="space-y-4"
        data-testid="planning-pending-closure-section-execution"
      >
        <TaskAdminOperationalChecklist task={task} />

        {technicianObservations ? (
          <Card
            className="shadow-sm"
            data-testid="planning-pending-closure-technician-observations"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Observaciones del técnico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {technicianObservations}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {operationalEvidences.length > 0 ? (
          <Card
            className="shadow-sm"
            data-testid="planning-pending-closure-operational-evidences"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Evidencias operativas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {operationalEvidences.map((evidence) => (
                <div key={evidence.id}>
                  <p className="text-sm font-medium text-foreground">
                    {evidence.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {evidence.uploadedBy} ·{" "}
                    {formatTaskDateTime(evidence.uploadedAt)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {briefHistory.length > 0 ? (
        <Card
          className="shadow-sm"
          data-testid="planning-pending-closure-section-history"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Historial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {briefHistory.map((event) => (
              <div key={event.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {event.action}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {formatTaskDateTime(event.timestamp)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {event.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
