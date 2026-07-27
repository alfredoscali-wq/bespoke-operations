import "server-only"

import {
  CommercialOpportunityRepository,
  CommercialPeopleRepository,
} from "@/lib/commercial/repositories"
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
