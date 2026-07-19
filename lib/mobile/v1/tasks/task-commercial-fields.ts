import {
  formatContractedPlanLabel,
  getTaskTechnologyLabel,
} from "@/lib/tasks/commercial-plan"
import { resolveInstallationIpForDisplay } from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"

export type MobileTaskCommercialFields = {
  technology: string | null
  contractedPlan: string | null
  installationIp: string | null
  /** Snake_case alias for legacy Field Agent clients. */
  installation_ip: string | null
  amountToCollect: number | null
}

export function resolveMobileTaskCommercialFields(
  task: Task
): MobileTaskCommercialFields {
  const installationIp = resolveInstallationIpForDisplay(task)

  return {
    technology: getTaskTechnologyLabel(task),
    contractedPlan: formatContractedPlanLabel(task.contractedPlan),
    installationIp,
    installation_ip: installationIp,
    amountToCollect:
      task.amountToCollect == null ? null : Number(task.amountToCollect),
  }
}
