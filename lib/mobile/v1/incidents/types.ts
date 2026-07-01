/**
 * Field Agent contract for incident type configuration.
 * Consumption endpoints will be added in a future sprint.
 *
 * @see {@link ../../../incident-types/future-resolution.ts}
 */
export type MobileIncidentType = {
  id: string
  code: string
  name: string
  description: string
  color: string
  pausesWorkOrder: boolean
  requiresSupervisorIntervention: boolean
  notifySupervisor: boolean
  sortOrder: number
}
