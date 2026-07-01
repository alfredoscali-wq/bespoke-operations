/** Field Agent — operational checklist template (read-only contract for future sprints). */

export type MobileChecklistFieldType = "confirmacion" | "entrada-datos" | "fotografia"

export type MobileOperationalChecklistItem = {
  id: string
  title: string
  fieldType: MobileChecklistFieldType
  required: boolean
  sortOrder: number
}

export type MobileOperationalChecklistResponse = {
  serviceType: string
  items: MobileOperationalChecklistItem[]
}
