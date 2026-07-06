export const PERMANENT_DELETE_ENTITY_TYPES = [
  "task",
  "customer",
  "project",
  "employee",
  "crew",
  "material",
  "evidence",
  "incident",
] as const

export type PermanentDeleteEntityType =
  (typeof PERMANENT_DELETE_ENTITY_TYPES)[number]

export const PERMANENT_DELETE_ENTITY_TYPE_LABELS: Record<
  PermanentDeleteEntityType,
  string
> = {
  task: "Orden de Trabajo",
  customer: "Cliente",
  project: "Obra",
  employee: "Empleado",
  crew: "Cuadrilla",
  material: "Material",
  evidence: "Evidencia",
  incident: "Incidencia",
}

export const PERMANENT_DELETE_IMPLEMENTED_ENTITY_TYPES = [
  "task",
  "customer",
] as const satisfies readonly PermanentDeleteEntityType[]

export function isPermanentDeleteEntityType(
  value: string | undefined
): value is PermanentDeleteEntityType {
  return PERMANENT_DELETE_ENTITY_TYPES.includes(
    value as PermanentDeleteEntityType
  )
}

export function isPermanentDeleteImplemented(
  entityType: PermanentDeleteEntityType
): entityType is (typeof PERMANENT_DELETE_IMPLEMENTED_ENTITY_TYPES)[number] {
  return (
    PERMANENT_DELETE_IMPLEMENTED_ENTITY_TYPES as readonly string[]
  ).includes(entityType)
}

export function resolvePermanentDeleteEntityTypeLabel(
  entityType: PermanentDeleteEntityType
): string {
  return PERMANENT_DELETE_ENTITY_TYPE_LABELS[entityType]
}

export function buildPermanentDeleteSuccessMessage(
  entityType: PermanentDeleteEntityType,
  entityLabel: string
): string {
  return `${resolvePermanentDeleteEntityTypeLabel(entityType)} ${entityLabel} eliminado definitivamente.`
}
