import "server-only"

import { COMMERCIAL_STATUS_LABELS } from "@/lib/commercial/catalogs"
import {
  EXISTING_PROSPECT_NOTICE,
  normalizeCommercialEmail,
  normalizeCommercialPhone,
  validateCommercialCreateOpportunityBundle,
  type CommercialCreateOpportunityBundleInput,
} from "@/lib/commercial/create-opportunity"
import {
  CommercialActivityRepository,
  CommercialOpportunityRepository,
  CommercialPeopleRepository,
} from "@/lib/commercial/repositories"
import { resolveCommercialPersonDisplayName } from "@/lib/supabase/commercial.mapper"
import type {
  CommercialActivity,
  CommercialActivityListItem,
  CommercialActivityType,
} from "@/lib/types/commercial-activities"
import type {
  CommercialMapOpportunity,
  CommercialMapQuery,
  CommercialOpportunity,
  CommercialOpportunityListItem,
  CommercialPerson,
} from "@/lib/types/commercial"
import type {
  CommercialActivityRepositoryResult,
  CreateCommercialActivityPayload,
  UpdateCommercialActivityPayload,
} from "@/lib/types/supabase/commercial-activities"
import type {
  BulkAssignCommercialOpportunitiesPayload,
  CommercialRepositoryResult,
  CreateCommercialOpportunityPayload,
  CreateCommercialPersonPayload,
  UpdateCommercialOpportunityPayload,
  UpdateCommercialPersonPayload,
} from "@/lib/types/supabase/commercial"

export type CommercialCreateOpportunityBundleResult = {
  person: CommercialPerson
  opportunity: CommercialOpportunityListItem
  matchedExistingPerson: boolean
  notice: string | null
}

export class CommercialPeopleService {
  constructor(
    private readonly repository: CommercialPeopleRepository = new CommercialPeopleRepository()
  ) {}

  list(
    companyId: string
  ): Promise<CommercialRepositoryResult<CommercialPerson[]>> {
    return this.repository.list(companyId)
  }

  getById(
    id: string
  ): Promise<CommercialRepositoryResult<CommercialPerson>> {
    return this.repository.getById(id)
  }

  create(
    payload: CreateCommercialPersonPayload
  ): Promise<CommercialRepositoryResult<CommercialPerson>> {
    return this.repository.create(payload)
  }

  update(
    id: string,
    payload: UpdateCommercialPersonPayload
  ): Promise<CommercialRepositoryResult<CommercialPerson>> {
    return this.repository.update(id, payload)
  }

  delete(
    id: string,
    deletedBy?: string | null
  ): Promise<CommercialRepositoryResult<CommercialPerson>> {
    return this.repository.softDelete(id, deletedBy)
  }
}

export class CommercialActivityService {
  constructor(
    private readonly repository: CommercialActivityRepository = new CommercialActivityRepository()
  ) {}

  listTypes(): Promise<
    CommercialActivityRepositoryResult<CommercialActivityType[]>
  > {
    return this.repository.listTypes()
  }

  listByOpportunity(
    companyId: string,
    opportunityId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<
    CommercialActivityRepositoryResult<CommercialActivityListItem[]> & {
      hasMore?: boolean
      totalCount?: number
    }
  > {
    return this.repository.listByOpportunity(companyId, opportunityId, options)
  }

  getStats(
    companyId: string,
    opportunityId: string
  ): Promise<
    CommercialActivityRepositoryResult<{
      total: number
      pending: number
      completed: number
    }>
  > {
    return this.repository.getStats(companyId, opportunityId)
  }

  getById(
    id: string
  ): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem>> {
    return this.repository.getById(id)
  }

  create(
    payload: CreateCommercialActivityPayload
  ): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem>> {
    return this.repository.create(payload)
  }

  update(
    id: string,
    payload: UpdateCommercialActivityPayload
  ): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem>> {
    return this.repository.update(id, payload)
  }

  delete(
    id: string,
    deletedBy?: string | null
  ): Promise<CommercialActivityRepositoryResult<CommercialActivity>> {
    return this.repository.softDelete(id, deletedBy)
  }

  async recordSystemOpportunityCreated(input: {
    companyId: string
    opportunityId: string
    employeeId?: string | null
  }): Promise<void> {
    await this.repository.create({
      companyId: input.companyId,
      opportunityId: input.opportunityId,
      activityTypeCode: "sistema",
      employeeId: input.employeeId ?? null,
      title: "Oportunidad creada.",
      description: "",
      status: "completed",
      createdBy: input.employeeId ?? null,
      metadata: { automatic: true, event: "opportunity_created" },
    })
  }

  async recordStatusChanged(input: {
    companyId: string
    opportunityId: string
    employeeId?: string | null
    statusLabel: string
    previousStatus?: string
    nextStatus: string
    lostReason?: string | null
  }): Promise<void> {
    const previousLabel =
      input.previousStatus &&
      input.previousStatus in COMMERCIAL_STATUS_LABELS
        ? COMMERCIAL_STATUS_LABELS[
            input.previousStatus as keyof typeof COMMERCIAL_STATUS_LABELS
          ]
        : input.previousStatus

    const title =
      previousLabel
        ? `Cambio de etapa: ${previousLabel} → ${input.statusLabel}`
        : `Estado actualizado a: ${input.statusLabel}`

    const descriptionParts = [
      input.lostReason?.trim()
        ? `Motivo de pérdida: ${input.lostReason.trim()}`
        : "",
    ].filter(Boolean)

    await this.repository.create({
      companyId: input.companyId,
      opportunityId: input.opportunityId,
      activityTypeCode: "cambio_estado",
      employeeId: input.employeeId ?? null,
      title,
      description: descriptionParts.join("\n"),
      status: "completed",
      createdBy: input.employeeId ?? null,
      metadata: {
        automatic: true,
        event: "status_changed",
        previousStatus: input.previousStatus ?? null,
        nextStatus: input.nextStatus,
        lostReason: input.lostReason?.trim() || null,
      },
    })
  }
}

export class CommercialOpportunityService {
  constructor(
    private readonly repository: CommercialOpportunityRepository = new CommercialOpportunityRepository(),
    private readonly peopleRepository: CommercialPeopleRepository = new CommercialPeopleRepository(),
    private readonly activityService: CommercialActivityService = new CommercialActivityService()
  ) {}

  list(
    companyId: string
  ): Promise<CommercialRepositoryResult<CommercialOpportunityListItem[]>> {
    return this.repository.list(companyId)
  }

  getById(
    id: string
  ): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
    return this.repository.getById(id)
  }

  async create(
    payload: CreateCommercialOpportunityPayload
  ): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
    const person = await this.peopleRepository.getById(payload.personId)
    if (person.error || !person.data) {
      return {
        data: null,
        error: {
          code: "VALIDATION",
          message: "La persona indicada no existe.",
        },
      }
    }

    if (
      payload.companyId &&
      person.data.companyId !== payload.companyId
    ) {
      return {
        data: null,
        error: {
          code: "VALIDATION",
          message: "La persona no pertenece a la empresa.",
        },
      }
    }

    const created = await this.repository.create({
      ...payload,
      companyId: payload.companyId ?? person.data.companyId,
    })

    if (created.data) {
      await this.activityService.recordSystemOpportunityCreated({
        companyId: created.data.companyId,
        opportunityId: created.data.id,
        employeeId: payload.createdBy ?? null,
      })
    }

    return created
  }

  /**
   * Integrated alta: resolve/create Persona then create oportunidad.
   * Rolls back a newly created Persona if the opportunity insert fails.
   */
  async createWithPerson(input: {
    companyId: string
    createdBy?: string | null
    bundle: CommercialCreateOpportunityBundleInput
  }): Promise<CommercialRepositoryResult<CommercialCreateOpportunityBundleResult>> {
    const validationError = validateCommercialCreateOpportunityBundle(
      input.bundle
    )
    if (validationError) {
      return {
        data: null,
        error: { code: "VALIDATION", message: validationError },
      }
    }

    const email = normalizeCommercialEmail(input.bundle.person.email)
    const phone = normalizeCommercialPhone(input.bundle.person.phone)
    const mobile = normalizeCommercialPhone(input.bundle.person.mobile)

    const existingResult = await this.peopleRepository.findByContact(
      input.companyId,
      { email, phone, mobile }
    )

    if (existingResult.error) {
      return { data: null, error: existingResult.error }
    }

    let person = existingResult.data
    let matchedExistingPerson = Boolean(person)
    let createdPersonId: string | null = null

    if (!person) {
      const createPersonResult = await this.peopleRepository.create({
        companyId: input.companyId,
        personType: input.bundle.person.personType,
        firstName: input.bundle.person.firstName,
        lastName: input.bundle.person.lastName,
        companyName: input.bundle.person.companyName,
        phone,
        mobile,
        email,
        street: input.bundle.person.street,
        streetNumber: input.bundle.person.streetNumber,
        floor: input.bundle.person.floor,
        apartment: input.bundle.person.apartment,
        neighborhood: input.bundle.person.neighborhood,
        address: input.bundle.person.address,
        city: input.bundle.person.city,
        province: input.bundle.person.province,
        postalCode: input.bundle.person.postalCode,
        latitude: input.bundle.person.latitude,
        longitude: input.bundle.person.longitude,
        locationSource: input.bundle.person.locationSource,
        createdBy: input.createdBy ?? null,
      })

      if (createPersonResult.error || !createPersonResult.data) {
        return {
          data: null,
          error: createPersonResult.error ?? {
            code: "UNKNOWN",
            message: "No se pudo crear la persona.",
          },
        }
      }

      person = createPersonResult.data
      createdPersonId = person.id
      matchedExistingPerson = false
    } else {
      const hasAddressUpdate =
        Boolean(input.bundle.person.street?.trim()) ||
        Boolean(input.bundle.person.city?.trim()) ||
        input.bundle.person.latitude != null

      if (hasAddressUpdate) {
        const updatedPerson = await this.peopleRepository.update(person.id, {
          street: input.bundle.person.street,
          streetNumber: input.bundle.person.streetNumber,
          floor: input.bundle.person.floor,
          apartment: input.bundle.person.apartment,
          neighborhood: input.bundle.person.neighborhood,
          address: input.bundle.person.address,
          city: input.bundle.person.city,
          province: input.bundle.person.province,
          postalCode: input.bundle.person.postalCode,
          latitude: input.bundle.person.latitude,
          longitude: input.bundle.person.longitude,
          locationSource: input.bundle.person.locationSource,
          updatedBy: input.createdBy ?? null,
        })
        if (updatedPerson.data) {
          person = updatedPerson.data
        }
      }
    }

    const opportunityResult = await this.repository.create({
      companyId: input.companyId,
      personId: person.id,
      title: input.bundle.opportunity.title,
      status: "nueva",
      priority: input.bundle.opportunity.priority,
      source: input.bundle.opportunity.source,
      assignedEmployeeId: input.bundle.opportunity.assignedEmployeeId,
      description: input.bundle.opportunity.observations.trim(),
      latitude: input.bundle.opportunity.latitude,
      longitude: input.bundle.opportunity.longitude,
      locationSource: input.bundle.opportunity.locationSource,
      createdBy: input.createdBy ?? null,
    })

    if (opportunityResult.error || !opportunityResult.data) {
      if (createdPersonId) {
        await this.peopleRepository.softDelete(
          createdPersonId,
          input.createdBy ?? null
        )
      }

      return {
        data: null,
        error: opportunityResult.error ?? {
          code: "UNKNOWN",
          message: "No se pudo crear la oportunidad.",
        },
      }
    }

    await this.activityService.recordSystemOpportunityCreated({
      companyId: input.companyId,
      opportunityId: opportunityResult.data.id,
      employeeId: input.createdBy ?? null,
    })

    const listItem: CommercialOpportunityListItem = {
      ...opportunityResult.data,
      personDisplayName: resolveCommercialPersonDisplayName(person),
    }

    return {
      data: {
        person,
        opportunity: listItem,
        matchedExistingPerson,
        notice: matchedExistingPerson ? EXISTING_PROSPECT_NOTICE : null,
      },
      error: null,
    }
  }

  async update(
    id: string,
    payload: UpdateCommercialOpportunityPayload
  ): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
    const previous = await this.repository.getById(id)
    if (previous.error || !previous.data) {
      return {
        data: null,
        error: previous.error ?? {
          code: "NOT_FOUND",
          message: "Oportunidad no encontrada.",
        },
      }
    }

    const updated = await this.repository.update(id, payload)
    if (updated.error || !updated.data) {
      return updated
    }

    if (
      payload.status !== undefined &&
      payload.status !== previous.data.status
    ) {
      await this.activityService.recordStatusChanged({
        companyId: updated.data.companyId,
        opportunityId: updated.data.id,
        employeeId: payload.updatedBy ?? null,
        statusLabel: COMMERCIAL_STATUS_LABELS[payload.status],
        previousStatus: previous.data.status,
        nextStatus: payload.status,
        lostReason:
          payload.status === "perdida"
            ? payload.lostReason ?? updated.data.lostReason
            : null,
      })
    }

    return updated
  }

  delete(
    id: string,
    deletedBy?: string | null
  ): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
    return this.repository.softDelete(id, deletedBy)
  }

  listMap(
    companyId: string,
    query: CommercialMapQuery
  ): Promise<CommercialRepositoryResult<CommercialMapOpportunity[]>> {
    return this.repository.listMap(companyId, query)
  }

  bulkAssign(
    companyId: string,
    payload: BulkAssignCommercialOpportunitiesPayload
  ): Promise<CommercialRepositoryResult<CommercialOpportunity[]>> {
    return this.repository.bulkAssign(companyId, payload)
  }

  /**
   * Marks the first seller open of a dossier. Idempotent if already opened.
   */
  async markSellerOpened(
    id: string,
    updatedBy?: string | null
  ): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
    const existing = await this.repository.getById(id)
    if (existing.error || !existing.data) {
      return {
        data: null,
        error: existing.error ?? {
          code: "NOT_FOUND",
          message: "Oportunidad no encontrada.",
        },
      }
    }

    if (existing.data.sellerOpenedAt) {
      return existing
    }

    return this.repository.update(id, {
      sellerOpenedAt: new Date().toISOString(),
      updatedBy: updatedBy ?? null,
    })
  }
}
