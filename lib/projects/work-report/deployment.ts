/**
 * Deployment work orders are identified from the OT title (and type if it
 * uses the same label). Pattern: "DESPLIEGUE N" with N = 1, 2, 3, ...
 * Never inferred from photos, description, IDs or other fields.
 */
const DEPLOYMENT_NAME = /^despliegue\s+\d+$/i
const DEPLOYMENT_TYPE = /^despliegue(?:\s+\d+)?$/i

export function isProjectWorkReportDeploymentName(
  value?: string | null
): boolean {
  return DEPLOYMENT_NAME.test(value?.trim() ?? "")
}

export function isProjectWorkReportDeploymentTask(task: {
  title?: string | null
  type?: string | null
}): boolean {
  if (isProjectWorkReportDeploymentName(task.title)) {
    return true
  }

  const type = task.type?.trim() ?? ""
  return type.length > 0 && DEPLOYMENT_TYPE.test(type)
}

export function partitionProjectWorkReportDeploymentTasks<
  T extends { title?: string | null; type?: string | null },
>(tasks: T[]): { regular: T[]; deployment: T[] } {
  const regular: T[] = []
  const deployment: T[] = []

  for (const task of tasks) {
    if (isProjectWorkReportDeploymentTask(task)) {
      deployment.push(task)
    } else {
      regular.push(task)
    }
  }

  return { regular, deployment }
}
