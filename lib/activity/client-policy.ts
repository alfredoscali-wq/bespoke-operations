import { isActivityAction } from "@/lib/activity/catalog"
import {
  ACTIVITY_ACTIONS,
  type ActivityAction,
} from "@/lib/activity/types"

/** Actions that must only be written from server (admin / privileged paths). */
export const SERVER_ONLY_ACTIVITY_ACTIONS = new Set<ActivityAction>([
  ACTIVITY_ACTIONS.TASK_DELETE_PERMANENT,
  ACTIVITY_ACTIONS.TASK_FORCE_DELETE,
  ACTIVITY_ACTIONS.PROJECT_DELETE_PERMANENT,
  ACTIVITY_ACTIONS.PROJECT_FORCE_DELETE,
  ACTIVITY_ACTIONS.CUSTOMER_DELETE_PERMANENT,
  ACTIVITY_ACTIONS.ATENCION_DELETE_PERMANENT,
  ACTIVITY_ACTIONS.FORCE_DELETE,
  ACTIVITY_ACTIONS.DEVICE_BLOCK,
])

export function isServerOnlyActivityAction(action: ActivityAction): boolean {
  return SERVER_ONLY_ACTIVITY_ACTIONS.has(action)
}

export function isClientWritableActivityAction(
  action: string
): action is ActivityAction {
  if (!isActivityAction(action)) {
    return false
  }

  return !isServerOnlyActivityAction(action)
}

export function getClientActivityRejectionMessage(action: string): string {
  if (!isActivityAction(action)) {
    return "Acción de Activity Engine inválida."
  }

  if (isServerOnlyActivityAction(action)) {
    return "Esta acción solo puede registrarse desde el servidor."
  }

  return "Acción de Activity Engine no permitida."
}
