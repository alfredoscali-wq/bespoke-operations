import "server-only"

import { createClient } from "@/lib/supabase/server"
import {
  bulkAssignCommercialOpportunities,
  fetchCommercialMapOpportunities,
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
import {
  fetchCommercialActivitiesByOpportunity,
  fetchCommercialActivityById,
  fetchCommercialActivityStats,
  fetchCommercialActivityTypes,
  insertCommercialActivity,
  patchCommercialActivity,
  softDeleteCommercialActivity,
  type SupabaseCommercialActivitiesClient,
} from "@/lib/supabase/commercial-activities.queries"
import type {
  CommercialActivity,
  CommercialActivityListItem,
  CommercialActivityType,
} from "@/lib/types/commercial-activities"
import type {
  CommercialActivityRepositoryResult,
  CreateCommercialActivityPayload,
  UpdateCommercialActivityPayload,
} from "@/lib/types/supabase/commercial-activities"
import type {
  CommercialMapOpportunity,
  CommercialMapQuery,
  CommercialOpportunity,
  CommercialOpportunityListItem,
  CommercialPerson,
} from "@/lib/types/commercial"
import type {
  BulkAssignCommercialOpportunitiesPayload,
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

  async listMap(
    companyId: string,
    query: CommercialMapQuery
  ): Promise<CommercialRepositoryResult<CommercialMapOpportunity[]>> {
    return fetchCommercialMapOpportunities(
      await this.resolveClient(),
      companyId,
      query
    )
  }

  async bulkAssign(
    companyId: string,
    payload: BulkAssignCommercialOpportunitiesPayload
  ): Promise<CommercialRepositoryResult<CommercialOpportunity[]>> {
    return bulkAssignCommercialOpportunities(
      await this.resolveClient(),
      companyId,
      payload
    )
  }
}

export class CommercialActivityRepository {
  constructor(
    private readonly client?: SupabaseCommercialActivitiesClient
  ) {}

  private async resolveClient(): Promise<SupabaseCommercialActivitiesClient> {
    return this.client ?? (await createServerCommercialClient())
  }

  async listTypes(): Promise<
    CommercialActivityRepositoryResult<CommercialActivityType[]>
  > {
    return fetchCommercialActivityTypes(await this.resolveClient())
  }

  async listByOpportunity(
    companyId: string,
    opportunityId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<
    CommercialActivityRepositoryResult<CommercialActivityListItem[]> & {
      hasMore?: boolean
      totalCount?: number
    }
  > {
    return fetchCommercialActivitiesByOpportunity(
      await this.resolveClient(),
      companyId,
      opportunityId,
      options
    )
  }

  async getStats(
    companyId: string,
    opportunityId: string
  ): Promise<
    CommercialActivityRepositoryResult<{
      total: number
      pending: number
      completed: number
    }>
  > {
    return fetchCommercialActivityStats(
      await this.resolveClient(),
      companyId,
      opportunityId
    )
  }

  async getById(
    id: string
  ): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem>> {
    return fetchCommercialActivityById(await this.resolveClient(), id)
  }

  async create(
    payload: CreateCommercialActivityPayload
  ): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem>> {
    return insertCommercialActivity(await this.resolveClient(), payload)
  }

  async update(
    id: string,
    payload: UpdateCommercialActivityPayload
  ): Promise<CommercialActivityRepositoryResult<CommercialActivityListItem>> {
    return patchCommercialActivity(await this.resolveClient(), id, payload)
  }

  async softDelete(
    id: string,
    deletedBy?: string | null
  ): Promise<CommercialActivityRepositoryResult<CommercialActivity>> {
    return softDeleteCommercialActivity(
      await this.resolveClient(),
      id,
      deletedBy
    )
  }
}
