"use client"

import { useMemo } from "react"

import { CommercialActivityStatusIcon } from "@/components/gestion-comercial/commercial-activity-icons"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { Badge } from "@/components/ui/badge"
import {
  COMMERCIAL_ACTIVITY_STATUS_LABELS,
  COMMERCIAL_ACTIVITY_TYPE_LABELS,
} from "@/lib/commercial/activity-catalogs"
import {
  COMMERCIAL_ACTIVITY_TYPE_TONE,
  formatCommercialTimelineTime,
} from "@/lib/commercial/timeline"
import {
  displayCommercialValue,
  formatCommercialDateTime,
} from "@/lib/commercial/display"
import type { CommercialCommitmentPriority } from "@/lib/commercial/location"
import type { CommercialActivityListItem } from "@/lib/types/commercial-activities"
import type {
  CommercialActivityResultMetadata,
} from "@/lib/types/commercial-commitments"
import { cn } from "@/lib/utils"

const COMMITMENT_PRIORITY_LABELS: Record<CommercialCommitmentPriority, string> =
  {
    alta: "Alta",
    media: "Media",
    baja: "Baja",
  }

type CommercialTimelineContentProps = {
  activity: CommercialActivityListItem
}

function readMetadata(
  activity: CommercialActivityListItem
): CommercialActivityResultMetadata {
  return (activity.metadata ?? {}) as CommercialActivityResultMetadata
}

export function CommercialTimelineContent({
  activity,
}: CommercialTimelineContentProps) {
  const { employees } = useEmployees()
  const tone = COMMERCIAL_ACTIVITY_TYPE_TONE[activity.activityTypeCode]
  const meta = readMetadata(activity)
  const result = meta.result?.trim() || null
  const nextStep = meta.nextStep ?? null

  const nextStepResponsible = useMemo(() => {
    if (!nextStep?.assignedEmployeeId) return null
    const employee = employees.find(
      (entry) => entry.id === nextStep.assignedEmployeeId
    )
    if (!employee) return null
    return (
      `${employee.firstName} ${employee.lastName}`.trim() ||
      employee.employeeCode
    )
  }, [employees, nextStep?.assignedEmployeeId])

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="secondary"
          className={cn("border-transparent", tone.badge)}
        >
          {activity.activityTypeLabel ||
            COMMERCIAL_ACTIVITY_TYPE_LABELS[activity.activityTypeCode]}
        </Badge>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CommercialActivityStatusIcon status={activity.status} />
          {COMMERCIAL_ACTIVITY_STATUS_LABELS[activity.status]}
        </span>
      </div>

      <p className="text-sm font-medium leading-snug text-foreground">
        {activity.title}
      </p>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>
          Por{" "}
          <span className="text-foreground">
            {displayCommercialValue(activity.employeeName)}
          </span>
        </span>
        <span>{formatCommercialTimelineTime(activity.createdAt)}</span>
        <span className="tabular-nums">
          {formatCommercialDateTime(activity.createdAt)}
        </span>
      </div>

      {activity.description.trim() ? (
        <p className="text-sm leading-snug text-muted-foreground line-clamp-3">
          {activity.description}
        </p>
      ) : null}

      {result ? (
        <p className="text-sm leading-snug text-foreground">
          <span className="font-medium text-muted-foreground">Resultado: </span>
          {result}
        </p>
      ) : null}

      {nextStep ? (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <p className="font-medium text-foreground">Próximo paso</p>
          <p className="mt-1 text-foreground">{nextStep.title}</p>
          <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <dt className="uppercase tracking-wide">Responsable</dt>
              <dd className="text-foreground">
                {displayCommercialValue(nextStepResponsible)}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Fecha</dt>
              <dd className="text-foreground">
                {formatCommercialDateTime(nextStep.dueAt)}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Prioridad</dt>
              <dd className="text-foreground">
                {COMMITMENT_PRIORITY_LABELS[nextStep.priority] ??
                  nextStep.priority}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  )
}
