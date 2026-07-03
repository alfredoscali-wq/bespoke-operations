import type { TaskStatus } from "@/lib/types/tasks"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import {
  CALENDAR_EVENT_TONE_STYLES,
  STATUS_BADGE_BASE,
  STATUS_TONE_STYLES,
} from "@/lib/ui/visual-tokens"

/** Tono visual unificado por estado de OT en toda la plataforma. */
export type TaskStatusVisualTone =
  | "blue"
  | "yellow"
  | "amber"
  | "orange"
  | "violet"
  | "green"
  | "red"
  | "dark"

/**
 * Paleta operativa Sprint UX 3.0:
 * Programada → azul · Asignada → amarillo · En curso → naranja ·
 * Pendiente de cierre → violeta · Finalizada → verde · Cancelada → rojo ·
 * Incidencia → gris oscuro
 */
export const TASK_STATUS_VISUAL_TONE: Record<TaskStatus, TaskStatusVisualTone> =
  {
    programada: "blue",
    asignada: "yellow",
    vencida: "amber",
    "en-curso": "orange",
    incidencia: "dark",
    "pendiente-cierre": "violet",
    finalizada: "green",
    "en-aprobacion": "violet",
    cerrada: "green",
    cancelada: "red",
  }

export const TASK_STATUS_DASHBOARD_TONE: Record<TaskStatus, VisualTone> = {
  programada: "blue",
  asignada: "yellow",
  vencida: "amber",
  "en-curso": "orange",
  incidencia: "dark",
  "pendiente-cierre": "violet",
  finalizada: "green",
  "en-aprobacion": "violet",
  cerrada: "green",
  cancelada: "red",
}

const TASK_STATUS_BADGE_BY_TONE: Record<TaskStatusVisualTone, string> = {
  blue: STATUS_TONE_STYLES.blue,
  yellow: STATUS_TONE_STYLES.yellow,
  amber: STATUS_TONE_STYLES.amber,
  orange: STATUS_TONE_STYLES.orange,
  violet: STATUS_TONE_STYLES.violet,
  green: STATUS_TONE_STYLES.green,
  red: STATUS_TONE_STYLES.red,
  dark: STATUS_TONE_STYLES.dark,
}

const TASK_STATUS_SURFACE_BY_TONE: Record<TaskStatusVisualTone, string> = {
  blue: "border-blue-200/80 bg-blue-50/70",
  yellow: "border-amber-200/80 bg-amber-50/70",
  amber: "border-amber-300/80 bg-amber-50/80",
  orange: "border-orange-200/80 bg-orange-50/70",
  violet: "border-violet-200/80 bg-violet-50/70",
  green: "border-emerald-200/80 bg-emerald-50/70",
  red: "border-red-200/80 bg-red-50/70",
  dark: "border-zinc-300/80 bg-zinc-50/90",
}

const TASK_STATUS_ACCENT_BY_TONE: Record<TaskStatusVisualTone, string> = {
  blue: "border-l-blue-500",
  yellow: "border-l-amber-500",
  amber: "border-l-amber-600",
  orange: "border-l-orange-500",
  violet: "border-l-violet-500",
  green: "border-l-emerald-500",
  red: "border-l-red-500",
  dark: "border-l-zinc-600",
}

const TASK_STATUS_RING_BY_TONE: Record<TaskStatusVisualTone, string> = {
  blue: "ring-blue-200/60",
  yellow: "ring-amber-200/60",
  amber: "ring-amber-300/60",
  orange: "ring-orange-200/60",
  violet: "ring-violet-200/60",
  green: "ring-emerald-200/60",
  red: "ring-red-200/60",
  dark: "ring-zinc-300/60",
}

const TASK_STATUS_CALENDAR_BY_TONE: Record<TaskStatusVisualTone, string> = {
  blue: CALENDAR_EVENT_TONE_STYLES.blue,
  yellow: CALENDAR_EVENT_TONE_STYLES.yellow,
  amber: CALENDAR_EVENT_TONE_STYLES.amber,
  orange: CALENDAR_EVENT_TONE_STYLES.orange,
  violet: CALENDAR_EVENT_TONE_STYLES.violet,
  green: CALENDAR_EVENT_TONE_STYLES.green,
  red: CALENDAR_EVENT_TONE_STYLES.red,
  dark: CALENDAR_EVENT_TONE_STYLES.dark,
}

const TASK_STATUS_CIRCLE_BY_TONE: Record<TaskStatusVisualTone, string> = {
  blue: "border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-200",
  yellow:
    "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
  amber:
    "border-amber-600 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
  orange:
    "border-orange-500 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-200",
  violet:
    "border-violet-500 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-200",
  green:
    "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
  red: "border-red-500 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200",
  dark: "border-zinc-600 bg-zinc-100 text-zinc-800 dark:border-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-200",
}

export function resolveTaskStatusVisualTone(
  status: TaskStatus
): TaskStatusVisualTone {
  return TASK_STATUS_VISUAL_TONE[status]
}

export function getTaskStatusBadgeClass(status: TaskStatus): string {
  const tone = resolveTaskStatusVisualTone(status)
  return `${STATUS_BADGE_BASE} ${TASK_STATUS_BADGE_BY_TONE[tone]}`
}

export function getTaskStatusSurfaceClass(
  status: TaskStatus,
  options?: { accent?: boolean; ring?: boolean }
): string {
  const tone = resolveTaskStatusVisualTone(status)
  const parts = [TASK_STATUS_SURFACE_BY_TONE[tone]]

  if (options?.accent !== false) {
    parts.push("border-l-4", TASK_STATUS_ACCENT_BY_TONE[tone])
  }

  if (options?.ring) {
    parts.push("ring-1 ring-inset", TASK_STATUS_RING_BY_TONE[tone])
  }

  return parts.join(" ")
}

export function getTaskStatusCalendarEventClass(status: TaskStatus): string {
  const tone = resolveTaskStatusVisualTone(status)
  return TASK_STATUS_CALENDAR_BY_TONE[tone]
}

export function getTaskStatusCircleClass(status: TaskStatus): string {
  const tone = resolveTaskStatusVisualTone(status)
  return TASK_STATUS_CIRCLE_BY_TONE[tone]
}

export function buildTaskStatusStyleMap(): Record<TaskStatus, string> {
  return Object.fromEntries(
    (Object.keys(TASK_STATUS_VISUAL_TONE) as TaskStatus[]).map((status) => [
      status,
      getTaskStatusBadgeClass(status),
    ])
  ) as Record<TaskStatus, string>
}
