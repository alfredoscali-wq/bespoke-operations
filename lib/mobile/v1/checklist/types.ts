/** Field Agent — operational checklist template (read-only contract for future sprints). */

export type MobileOperationalChecklistItem = {
  id: string
  title: string
  required: boolean
  requiresPhoto: boolean
  sortOrder: number
}

export type MobileOperationalChecklistResponse = {
  serviceType: string
  items: MobileOperationalChecklistItem[]
}
