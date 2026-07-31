/**
 * Presentation-only helpers for Sala de Situación · Últimos movimientos.
 * Does not alter Indicator Engine, SQL, or Activity Engine writes.
 */

import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Contact,
  Headset,
  ListChecks,
  type LucideIcon,
  Wrench,
} from "lucide-react"

import { asBusinessCopy } from "@/lib/activity/day-gestiones/business-copy"
import {
  ACTIVITY_EVENT_TITLES,
  type ActivityEventAction,
} from "@/lib/activity/actions"
import type { ExecutiveRelevantActivityItem } from "@/lib/executive/types"
import type { ModuleColorId } from "@/lib/ui/module-colors"

export type SituationRoomMovementVisual = {
  icon: LucideIcon
  moduleColor: ModuleColorId
}

/** Short business labels for the action column. */
const ACTION_LABEL_BY_ACTION: Record<string, string> = {
  CASE_CREATED: "Consulta creada",
  CASE_CLOSED: "Consulta resuelta",
  OT_CREATED: "OT creada",
  "workorder.finished": "OT finalizada",
  "workorder.started": "OT iniciada",
  "workorder.cancelled": "OT cancelada",
  "commercial_activity.completed": "Venta registrada",
  "customer.created": "Cliente creado",
  "project.started": "Obra iniciada",
  "project.finished": "Obra finalizada",
  "project.created": "Obra creada",
  "attention.resolved": "Consulta resuelta",
  "attention.workorder_generated": "OT generada",
  "attention.transferred": "Consulta derivada",
  "request.resolved": "Solicitud resuelta",
  "request.created": "Solicitud creada",
}

const VISUAL_BY_ACTION: Record<string, SituationRoomMovementVisual> = {
  CASE_CREATED: { icon: Headset, moduleColor: "attention" },
  CASE_CLOSED: { icon: CheckCircle2, moduleColor: "attention" },
  OT_CREATED: { icon: ListChecks, moduleColor: "work" },
  "workorder.finished": { icon: CheckCircle2, moduleColor: "work" },
  "workorder.started": { icon: Wrench, moduleColor: "work" },
  "workorder.cancelled": { icon: ListChecks, moduleColor: "work" },
  "commercial_activity.completed": {
    icon: BriefcaseBusiness,
    moduleColor: "commercial",
  },
  "customer.created": { icon: Contact, moduleColor: "customers" },
  "project.started": { icon: Building2, moduleColor: "ops" },
  "project.finished": { icon: Building2, moduleColor: "ops" },
  "project.created": { icon: Building2, moduleColor: "ops" },
  "attention.resolved": { icon: Headset, moduleColor: "attention" },
  "attention.workorder_generated": { icon: ListChecks, moduleColor: "work" },
  "attention.transferred": { icon: Headset, moduleColor: "attention" },
  "request.resolved": { icon: BriefcaseBusiness, moduleColor: "commercial" },
  "request.created": { icon: BriefcaseBusiness, moduleColor: "commercial" },
}

const VISUAL_BY_ENTITY: Record<string, SituationRoomMovementVisual> = {
  customer: { icon: Contact, moduleColor: "customers" },
  attention: { icon: Headset, moduleColor: "attention" },
  customer_atencion: { icon: Headset, moduleColor: "attention" },
  workorder: { icon: ListChecks, moduleColor: "work" },
  task: { icon: ListChecks, moduleColor: "work" },
  project: { icon: Building2, moduleColor: "ops" },
  commercial_activity: {
    icon: BriefcaseBusiness,
    moduleColor: "commercial",
  },
  request: { icon: BriefcaseBusiness, moduleColor: "commercial" },
}

const DEFAULT_VISUAL: SituationRoomMovementVisual = {
  icon: ListChecks,
  moduleColor: "intelligence",
}

/**
 * Compact business action for the movements feed.
 * Never returns technical event codes.
 */
export function formatSituationRoomActionLabel(
  item: ExecutiveRelevantActivityItem
): string {
  const mapped = ACTION_LABEL_BY_ACTION[item.action]
  if (mapped) return mapped

  const businessTitle = asBusinessCopy(item.title)
  if (businessTitle) return businessTitle

  const catalog = ACTIVITY_EVENT_TITLES[item.action as ActivityEventAction]
  if (catalog) return catalog

  return "Movimiento registrado"
}

export function resolveSituationRoomMovementVisual(
  item: ExecutiveRelevantActivityItem
): SituationRoomMovementVisual {
  return (
    VISUAL_BY_ACTION[item.action] ??
    VISUAL_BY_ENTITY[item.entityType] ??
    DEFAULT_VISUAL
  )
}

/** @deprecated Prefer formatSituationRoomActionLabel for the movements feed. */
export function formatSituationRoomActivityStory(
  item: ExecutiveRelevantActivityItem
): string {
  return formatSituationRoomActionLabel(item)
}
