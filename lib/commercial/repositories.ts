import "server-only"

import { createClient } from "@/lib/supabase/server"
import {
  fetchCommercialOpportunities,
  fetchCommercialOpportunityById,
  fetchCommercialPeople,
  fetchCommercialPersonById,
  findCommercialPersonByContact,
  insertCommercialOpportunity,
  insertCommercialPerson,
  patchCommercialOpportunity,
  patchCommercialPerson,
  softDeleteCommercialOpportunity,
  softDeleteCommercialPerson,
  type SupabaseCommercialClient,
} from "@/lib/supabase/commercial.queries"
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

async function createServerCommercialClient(): Promise<SupabaseCommercialClient> {
  return createClient()
}

export class CommercialPeopleRepository {
  constructor(private readonly client?: SupabaseCommercialClient) {}

  private async resolveClient(): Promise<SupabaseCommercialClient> {
    return this.client ?? (await createServerCommercialClient())
  }

  async list(
    companyId: string
  ): Promise<CommercialRepositoryResult<CommercialPerson[]>> {
    return fetchCommercialPeople(await this.resolveClient(), companyId)
  }

  async getById(
    id: string
  ): Promise<CommercialRepositoryResult<CommercialPerson>> {
    return fetchCommercialPersonById(await this.resolveClient(), id)
  }

  async create(
    payload: CreateCommercialPersonPayload
  ): Promise<CommercialRepositoryResult<CommercialPerson>> {
    return insertCommercialPerson(await this.resolveClient(), payload)
  }

  async update(
    id: string,
    payload: UpdateCommercialPersonPayload
  ): Promise<CommercialRepositoryResult<CommercialPerson>> {
    return patchCommercialPerson(await this.resolveClient(), id, payload)
  }

  async softDelete(
    id: string,
    deletedBy?: string | null
  ): Promise<CommercialRepositoryResult<CommercialPerson>> {
    return softDeleteCommercialPerson(
      await this.resolveClient(),
      id,
      deletedBy
    )
  }

  async findByContact(
    companyId: string,
    contact: { email?: string; phone?: string; mobile?: string }
  ): Promise<CommercialRepositoryResult<CommercialPerson | null>> {
    return findCommercialPersonByContact(
      await this.resolveClient(),
      companyId,
      contact
    )
  }
}

export class CommercialOpportunityRepository {
  constructor(private readonly client?: SupabaseCommercialClient) {}

  private async resolveClient(): Promise<SupabaseCommercialClient> {
    return this.client ?? (await createServerCommercialClient())
  }

  async list(
    companyId: string
  ): Promise<CommercialRepositoryResult<CommercialOpportunityListItem[]>> {
    return fetchCommercialOpportunities(await this.resolveClient(), companyId)
  }

  async getById(
    id: string
  ): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
    return fetchCommercialOpportunityById(await this.resolveClient(), id)
  }

  async create(
    payload: CreateCommercialOpportunityPayload
  ): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
    return insertCommercialOpportunity(await this.resolveClient(), payload)
  }

  async update(
    id: string,
    payload: UpdateCommercialOpportunityPayload
  ): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
    return patchCommercialOpportunity(await this.resolveClient(), id, payload)
  }

  async softDelete(
    id: string,
    deletedBy?: string | null
  ): Promise<CommercialRepositoryResult<CommercialOpportunity>> {
    return softDeleteCommercialOpportunity(
      await this.resolveClient(),
      id,
      deletedBy
    )
  }
}
