"use client"

import {
  formatContractedPlanLabel,
} from "@/lib/tasks/commercial-plan"
import {
  resolveCurrentContractedPlanFromTask,
  resolveCurrentTechnologyFromTask,
  resolveFinalTechnologyFromTask,
  resolveFtthInstallationFromTask,
  resolveTechnologyLabel,
  taskRequiresFtthInstallation,
} from "@/lib/tasks/ftth-installation"
import type { Task } from "@/lib/types/tasks"
import { WorkOrderFtthInstallationFields } from "@/components/tareas/work-order-ftth-installation-fields"

import type { WorkOrderTechnology } from "@/lib/tasks/work-order"
import type { FtthInstallationValues } from "@/lib/tasks/ftth-installation"

type WorkOrderTechnologyStateDetailProps = {
  title: string
  description?: string
  technology: WorkOrderTechnology | ""
  contractedPlan?: string | null
  showInstallationFields?: boolean
  installationValues?: FtthInstallationValues
}

function TechnologyStateDetailBlock({
  title,
  description,
  technology,
  contractedPlan,
  showInstallationFields = false,
  installationValues,
}: WorkOrderTechnologyStateDetailProps) {
  const technologyLabel = resolveTechnologyLabel(technology)
  const planLabel = formatContractedPlanLabel(contractedPlan)

  if (!technologyLabel && !planLabel) {
    return null
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {technologyLabel ? (
        <div>
          <p className="text-xs text-muted-foreground">Tecnología</p>
          <p className="text-sm font-medium">{technologyLabel}</p>
        </div>
      ) : null}
      {planLabel ? (
        <div>
          <p className="text-xs text-muted-foreground">Plan</p>
          <p className="text-sm font-medium">{planLabel}</p>
        </div>
      ) : null}
      {showInstallationFields && installationValues && technology === "fiber" ? (
        <WorkOrderFtthInstallationFields
          technology={technology}
          values={installationValues}
          readOnly
          showPlan={false}
          showInstallationFields
          idPrefix={`detail-${title}`}
        />
      ) : null}
    </div>
  )
}

export function WorkOrderDualTechnologyDetail({
  task,
  showInstallationFields = true,
}: {
  task: Task
  showInstallationFields?: boolean
}) {
  const metadata = task.taskMetadata ?? {}
  const currentTechnology = resolveCurrentTechnologyFromTask(task)
  const finalTechnology = resolveFinalTechnologyFromTask(task)
  const currentPlan =
    resolveCurrentContractedPlanFromTask(task) ||
    (currentTechnology === finalTechnology ? task.contractedPlan : null)
  const finalPlan = task.contractedPlan
  const installationValues = resolveFtthInstallationFromTask(task)

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <TechnologyStateDetailBlock
        title="Estado actual"
        technology={currentTechnology}
        contractedPlan={currentPlan}
      />
      <TechnologyStateDetailBlock
        title="Estado final"
        technology={finalTechnology}
        contractedPlan={finalPlan}
        showInstallationFields={
          showInstallationFields && taskRequiresFtthInstallation(task)
        }
        installationValues={installationValues}
      />
    </div>
  )
}

export function WorkOrderFtthInstallationDetail({ task }: { task: Task }) {
  if (!taskRequiresFtthInstallation(task)) {
    return null
  }

  const values = resolveFtthInstallationFromTask(task)
  const technology = resolveFinalTechnologyFromTask(task)

  if (technology !== "fiber") {
    return null
  }

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <h4 className="mb-3 text-sm font-semibold text-foreground">
        Instalación FTTH
      </h4>
      <WorkOrderFtthInstallationFields
        technology={technology}
        values={values}
        readOnly
        idPrefix="ftth-detail"
      />
    </div>
  )
}

export function readNewContractedPlanFromMetadata(
  metadata: Record<string, unknown>
): string | null {
  const plan = metadata.newContractedPlan
  return typeof plan === "string" && plan.trim() ? plan.trim() : null
}
