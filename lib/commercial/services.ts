import "server-only"

import {
  EXISTING_PROSPECT_NOTICE,
  normalizeCommercialEmail,
  normalizeCommercialPhone,
  validateCommercialCreateOpportunityBundle,
  type CommercialCreateOpportunityBundleInput,
} from "@/lib/commercial/create-opportunity"
import {
  CommercialOpportunityRepository,
  CommercialPeopleRepository,
} from "@/lib/commercial/repositories"
import { resolveCommercialPersonDisplayName } from "@/lib/supabase/commercial.mapper"
import type {
  CommercialOpportunity,
  CommercialOpportunityListItem,
  CommercialPerson,
} from "@/lib/types/commercial"
import type {
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

export class CommercialOpportunityService {
  constructor(
    private readonly repository: CommercialOpportunityRepository = new CommercialOpportunityRepository(),
    private readonly peopleRepository: CommercialPeopleRepository = new CommercialPeopleRepository()
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
          message: "El prospecto indicado no existe.",
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
          message: "El prospecto no pertenece a la empresa.",
        },
      }
    }

    return this.repository.create({
      ...payload,
      companyId: payload.companyId ?? person.data.companyId,
    })
  }

  /**
   * Integrated alta: resolve/create prospecto then create oportunidad.
   * Rolls back a newly created prospecto if the opportunity insert fails.
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
        createdBy: input.createdBy ?? null,
      })

      if (createPersonResult.error || !createPersonResult.data) {
        return {
          data: null,
          error: createPersonResult.error ?? {
            code: "UNKNOWN",
            message: "No se pudo crear el prospecto.",
          },
        }
      }

      person = createPersonResult.data
      createdPersonId = person.id
      matchedExistingPerson = false
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

  update(
    id: string,
    payload: UpdateCommercialOpportunityPayload
  ): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
    return this.repository.update(id, payload)
  }

  delete(
    id: string,
    deletedBy?: string | null
  ): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
    return this.repository.softDelete(id, deletedBy)
  }
}
