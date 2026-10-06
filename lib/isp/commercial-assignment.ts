import {
  commercialComponentAssignmentError,
  type IspCommercialAssignmentStatus,
  type IspCommercialCatalogContext,
  type IspCommercialCompatibility,
  type IspCommercialComponentType,
  type IspCommercialPrice,
} from "@/lib/isp/commercial-pricing"

export const ISP_COMMERCIAL_SERVICE_NOT_FOUND =
  "El servicio contratado no existe."
export const ISP_COMMERCIAL_BASE_MISSING =
  "El abono base del servicio no existe."
export const ISP_COMMERCIAL_COMPONENT_NOT_FOUND =
  "El componente comercial no existe."
export const ISP_COMMERCIAL_COMPONENT_ALREADY_ASSIGNED =
  "El servicio ya tiene este componente activo."
export const ISP_COMMERCIAL_COMPONENT_EXCLUSIVE_GROUP =
  "El servicio ya tiene un componente activo de este grupo."
export const ISP_COMMERCIAL_COMPONENT_NOT_ASSIGNED =
  "El servicio no tiene este componente activo."
export const ISP_COMMERCIAL_CONDITION_NOT_FOUND =
  "La condición comercial no existe."
export const ISP_COMMERCIAL_CONDITION_INACTIVE =
  "La condición comercial no está activa."
export const ISP_COMMERCIAL_CONDITION_NOT_ASSIGNED =
  "El servicio no tiene una condición comercial activa."
export const ISP_COMMERCIAL_PRICE_NOT_PERSISTED =
  "No se pudo persistir el precio comercial del servicio."

export type IspCommercialComponentRecord = {
  id: string
  code: string
  name: string
  description: string | null
  componentType: IspCommercialComponentType
  monthlyPrice: number | null
  currency: string
  isRecurring: boolean
  isActive: boolean
  compatibility: IspCommercialCompatibility
  exclusiveGroup: string | null
  tvPlanCatalogId: string | null
}

export type IspCommercialConditionRecord = {
  id: string
  code: string
  name: string
  description: string | null
  discountPercent: number
  isActive: boolean
}

export type IspCommercialBasePlan = {
  category: string | null
  monthlyPrice: number | null
  includedTvCode: string | null
}

export type IspActiveCommercialComponent = {
  assignmentId: string
  componentId: string
  code: string
  name: string
  componentType: IspCommercialComponentType
  unitPrice: number
  isRecurring: boolean
  exclusiveGroup: string | null
  status: Extract<IspCommercialAssignmentStatus, "active">
}

export type IspActiveCommercialCondition = {
  assignmentId: string
  conditionId: string
  code: string
  name: string
  discountPercent: number
  status: Extract<IspCommercialAssignmentStatus, "active">
}

export type IspCommercialServiceSnapshot = {
  serviceId: string
  catalogId: string | null
  listPrice: number | null
  base: IspCommercialBasePlan | null
  components: readonly IspCommercialComponentRecord[]
  conditions: readonly IspCommercialConditionRecord[]
  activeComponents: readonly IspActiveCommercialComponent[]
  activeCondition: IspActiveCommercialCondition | null
}

export type IspCommercialPersistedPrice = IspCommercialPrice & {
  serviceId: string
  catalogId: string | null
}

export type AvailableCommercialComponent = {
  id: string
  code: string
  name: string
  description: string | null
  componentType: IspCommercialComponentType
  monthlyPrice: number
  currency: string
  isRecurring: boolean
  exclusiveGroup: string | null
  tvPlanCatalogId: string | null
}

export type IspCommercialAssignmentGateway = {
  load(
    companyId: string,
    serviceId: string
  ): Promise<IspCommercialServiceSnapshot | null>
  insertComponentAssignment(input: {
    companyId: string
    serviceId: string
    componentId: string
    unitPrice: number
    isRecurring: boolean
  }): Promise<void>
  cancelComponentAssignment(input: {
    companyId: string
    serviceId: string
    assignmentId: string
  }): Promise<void>
  insertConditionAssignment(input: {
    companyId: string
    serviceId: string
    conditionId: string
    discountPercent: number
  }): Promise<void>
  cancelConditionAssignment(input: {
    companyId: string
    serviceId: string
    assignmentId: string
  }): Promise<void>
  readPrice(
    companyId: string,
    serviceId: string
  ): Promise<IspCommercialPersistedPrice | null>
}

export function resolveCommercialListPrice(
  listPrice: number | null,
  catalogMonthlyPrice: number | null
): number | null {
  return listPrice ?? catalogMonthlyPrice
}

export function commercialCatalogContext(
  snapshot: IspCommercialServiceSnapshot
): IspCommercialCatalogContext {
  return {
    category: snapshot.base?.category ?? null,
    includedTvCode: snapshot.base?.includedTvCode ?? null,
  }
}

export function availableCommercialComponents(
  snapshot: IspCommercialServiceSnapshot
): AvailableCommercialComponent[] {
  if (!snapshot.base || !snapshot.catalogId) return []

  const activeIds = new Set(
    snapshot.activeComponents.map((component) => component.componentId)
  )
  const activeGroups = new Set(
    snapshot.activeComponents
      .map((component) => component.exclusiveGroup)
      .filter((group): group is string => Boolean(group))
  )
  const catalog = commercialCatalogContext(snapshot)

  return snapshot.components
    .filter((component) => {
      if (activeIds.has(component.id)) return false
      if (
        component.exclusiveGroup &&
        activeGroups.has(component.exclusiveGroup)
      ) {
        return false
      }
      if (
        commercialComponentAssignmentError({
          isActive: component.isActive,
          monthlyPrice: component.monthlyPrice,
          compatibility: component.compatibility,
          catalog,
        })
      ) {
        return false
      }
      return component.monthlyPrice != null
    })
    .map((component) => ({
      id: component.id,
      code: component.code,
      name: component.name,
      description: component.description,
      componentType: component.componentType,
      monthlyPrice: component.monthlyPrice as number,
      currency: component.currency,
      isRecurring: component.isRecurring,
      exclusiveGroup: component.exclusiveGroup,
      tvPlanCatalogId: component.tvPlanCatalogId,
    }))
    .sort((left, right) => left.code.localeCompare(right.code))
}

export function commercialComponentSelectionError(
  snapshot: IspCommercialServiceSnapshot,
  componentId: string
): string | null {
  const component = snapshot.components.find((item) => item.id === componentId)
  if (!component) return ISP_COMMERCIAL_COMPONENT_NOT_FOUND
  if (!snapshot.catalogId || !snapshot.base) return ISP_COMMERCIAL_BASE_MISSING

  const assignmentError = commercialComponentAssignmentError({
    isActive: component.isActive,
    monthlyPrice: component.monthlyPrice,
    compatibility: component.compatibility,
    catalog: commercialCatalogContext(snapshot),
  })
  if (assignmentError) return assignmentError

  if (
    snapshot.activeComponents.some((item) => item.componentId === component.id)
  ) {
    return ISP_COMMERCIAL_COMPONENT_ALREADY_ASSIGNED
  }

  if (
    component.exclusiveGroup &&
    snapshot.activeComponents.some(
      (item) => item.exclusiveGroup === component.exclusiveGroup
    )
  ) {
    return ISP_COMMERCIAL_COMPONENT_EXCLUSIVE_GROUP
  }

  return null
}

export function commercialConditionSelectionError(
  snapshot: IspCommercialServiceSnapshot,
  conditionId: string
): string | null {
  const condition = snapshot.conditions.find((item) => item.id === conditionId)
  if (!condition) return ISP_COMMERCIAL_CONDITION_NOT_FOUND
  if (!condition.isActive) return ISP_COMMERCIAL_CONDITION_INACTIVE
  if (!snapshot.catalogId || !snapshot.base) return ISP_COMMERCIAL_BASE_MISSING
  return null
}

async function requireSnapshot(
  gateway: IspCommercialAssignmentGateway,
  companyId: string,
  serviceId: string
): Promise<IspCommercialServiceSnapshot> {
  const snapshot = await gateway.load(companyId, serviceId)
  if (!snapshot || snapshot.serviceId !== serviceId) {
    throw new Error(ISP_COMMERCIAL_SERVICE_NOT_FOUND)
  }
  return snapshot
}

async function requirePersistedPrice(
  gateway: IspCommercialAssignmentGateway,
  companyId: string,
  serviceId: string
): Promise<IspCommercialPersistedPrice> {
  const price = await gateway.readPrice(companyId, serviceId)
  if (!price || price.serviceId !== serviceId) {
    throw new Error(ISP_COMMERCIAL_PRICE_NOT_PERSISTED)
  }
  return price
}

function throwIf(message: string | null) {
  if (message) throw new Error(message)
}

export function createIspCommercialAssignmentService(
  gateway: IspCommercialAssignmentGateway
) {
  return {
    async listAvailableComponents(companyId: string, serviceId: string) {
      const snapshot = await requireSnapshot(gateway, companyId, serviceId)
      return {
        serviceId: snapshot.serviceId,
        catalogId: snapshot.catalogId,
        components: availableCommercialComponents(snapshot),
      }
    },

    async listActiveComponents(companyId: string, serviceId: string) {
      const snapshot = await requireSnapshot(gateway, companyId, serviceId)
      return {
        serviceId: snapshot.serviceId,
        catalogId: snapshot.catalogId,
        components: [...snapshot.activeComponents],
        price: await gateway.readPrice(companyId, serviceId),
      }
    },

    async assignComponent(
      companyId: string,
      input: { serviceId: string; componentId: string }
    ) {
      const snapshot = await requireSnapshot(gateway, companyId, input.serviceId)
      throwIf(commercialComponentSelectionError(snapshot, input.componentId))
      const component = snapshot.components.find(
        (item) => item.id === input.componentId
      )
      if (!component || component.monthlyPrice == null) {
        throw new Error(ISP_COMMERCIAL_COMPONENT_NOT_FOUND)
      }

      await gateway.insertComponentAssignment({
        companyId,
        serviceId: input.serviceId,
        componentId: component.id,
        unitPrice: component.monthlyPrice,
        isRecurring: component.isRecurring,
      })
      return requirePersistedPrice(gateway, companyId, input.serviceId)
    },

    async cancelComponent(
      companyId: string,
      input: { serviceId: string; componentId: string }
    ) {
      const snapshot = await requireSnapshot(gateway, companyId, input.serviceId)
      const active = snapshot.activeComponents.find(
        (item) => item.componentId === input.componentId
      )
      if (!active) throw new Error(ISP_COMMERCIAL_COMPONENT_NOT_ASSIGNED)

      await gateway.cancelComponentAssignment({
        companyId,
        serviceId: input.serviceId,
        assignmentId: active.assignmentId,
      })
      return requirePersistedPrice(gateway, companyId, input.serviceId)
    },

    async listConditions(companyId: string, serviceId: string) {
      const snapshot = await requireSnapshot(gateway, companyId, serviceId)
      return {
        serviceId: snapshot.serviceId,
        catalogId: snapshot.catalogId,
        conditions: snapshot.conditions
          .filter((condition) => condition.isActive)
          .sort((left, right) => left.code.localeCompare(right.code)),
      }
    },

    async getActiveCondition(companyId: string, serviceId: string) {
      const snapshot = await requireSnapshot(gateway, companyId, serviceId)
      return {
        serviceId: snapshot.serviceId,
        catalogId: snapshot.catalogId,
        condition: snapshot.activeCondition,
        price: await gateway.readPrice(companyId, serviceId),
      }
    },

    async assignCondition(
      companyId: string,
      input: { serviceId: string; conditionId: string }
    ) {
      const snapshot = await requireSnapshot(gateway, companyId, input.serviceId)
      throwIf(commercialConditionSelectionError(snapshot, input.conditionId))
      const condition = snapshot.conditions.find(
        (item) => item.id === input.conditionId
      )
      if (!condition) throw new Error(ISP_COMMERCIAL_CONDITION_NOT_FOUND)

      if (snapshot.activeCondition?.conditionId === condition.id) {
        return requirePersistedPrice(gateway, companyId, input.serviceId)
      }

      if (snapshot.activeCondition) {
        await gateway.cancelConditionAssignment({
          companyId,
          serviceId: input.serviceId,
          assignmentId: snapshot.activeCondition.assignmentId,
        })
      }

      await gateway.insertConditionAssignment({
        companyId,
        serviceId: input.serviceId,
        conditionId: condition.id,
        discountPercent: condition.discountPercent,
      })
      return requirePersistedPrice(gateway, companyId, input.serviceId)
    },

    async removeCondition(companyId: string, serviceId: string) {
      const snapshot = await requireSnapshot(gateway, companyId, serviceId)
      if (!snapshot.activeCondition) {
        throw new Error(ISP_COMMERCIAL_CONDITION_NOT_ASSIGNED)
      }

      await gateway.cancelConditionAssignment({
        companyId,
        serviceId,
        assignmentId: snapshot.activeCondition.assignmentId,
      })
      return requirePersistedPrice(gateway, companyId, serviceId)
    },
  }
}
