/**
 * Tenant-configurable incident type used during work order execution.
 *
 * @see {@link ../incident-types/future-resolution.ts} for the planned supervisor
 * resolution workflow (not implemented yet).
 */
export type IncidentType = {
  id: string
  companyId: string
  code: string
  name: string
  description: string
  color: string
  pausesWorkOrder: boolean
  /** When true, the supervisor must resolve the incident before the OT can continue. */
  requiresSupervisorIntervention: boolean
  notifySupervisor: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type IncidentTypeInput = {
  name: string
  description: string
  color: string
  pausesWorkOrder: boolean
  requiresSupervisorIntervention: boolean
  notifySupervisor: boolean
  isActive: boolean
}
