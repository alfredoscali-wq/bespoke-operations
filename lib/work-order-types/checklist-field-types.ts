export type ChecklistFieldType = "confirmacion" | "entrada-datos" | "fotografia"

export const CHECKLIST_FIELD_TYPE_OPTIONS: {
  value: ChecklistFieldType
  label: string
}[] = [
  { value: "confirmacion", label: "Confirmación" },
  { value: "entrada-datos", label: "Entrada de datos" },
  { value: "fotografia", label: "Fotografía" },
]

export const CHECKLIST_FIELD_TYPE_LABELS: Record<ChecklistFieldType, string> =
  Object.fromEntries(
    CHECKLIST_FIELD_TYPE_OPTIONS.map((option) => [option.value, option.label])
  ) as Record<ChecklistFieldType, string>

export const DEFAULT_CHECKLIST_FIELD_TYPE: ChecklistFieldType = "confirmacion"

export function resolveChecklistFieldTypeLabel(
  fieldType: ChecklistFieldType | string | null | undefined
): string {
  if (!fieldType) return "—"
  return (
    CHECKLIST_FIELD_TYPE_LABELS[fieldType as ChecklistFieldType] ?? fieldType
  )
}

export function isChecklistFieldType(
  value: string | null | undefined
): value is ChecklistFieldType {
  return (
    value === "confirmacion" ||
    value === "entrada-datos" ||
    value === "fotografia"
  )
}
