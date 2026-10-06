import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ISP_COMMERCIAL_COMPONENT_ALREADY_ASSIGNED,
  ISP_COMMERCIAL_COMPONENT_EXCLUSIVE_GROUP,
  ISP_COMMERCIAL_COMPONENT_NOT_ASSIGNED,
  ISP_COMMERCIAL_CONDITION_INACTIVE,
  ISP_COMMERCIAL_CONDITION_NOT_ASSIGNED,
  ISP_COMMERCIAL_SERVICE_NOT_FOUND,
  availableCommercialComponents,
  createIspCommercialAssignmentService,
  resolveCommercialListPrice,
} from "../lib/isp/commercial-assignment.ts"
import {
  ISP_COMMERCIAL_COMPONENT_INACTIVE,
  ISP_COMMERCIAL_COMPONENT_INCOMPATIBLE,
  calculateCommercialPrice,
} from "../lib/isp/commercial-pricing.ts"

const root = resolve(import.meta.dirname, "..")
const COMPANY = "abnet"
const SERVICE = "service-100"
const CATALOG = "catalog-ftth-100-tv-basico"

const packFutbol = component({
  id: "c-futbol",
  code: "PACK-FUTBOL",
  name: "Pack Fútbol",
  monthlyPrice: 3000,
  compatibility: { category: "internet", requiresIncludedTv: true },
})
const publicIp = component({
  id: "c-ip",
  code: "IP-PUBLICA",
  name: "IP Pública",
  monthlyPrice: null,
  isActive: false,
  compatibility: { category: "internet" },
})
const tvFull = component({
  id: "c-tv",
  code: "TV-FULL-UPGRADE",
  name: "TV Full",
  componentType: "tv_upgrade",
  monthlyPrice: 5400,
  exclusiveGroup: "tv_tier",
  tvPlanCatalogId: "tv-full",
  compatibility: {
    category: "internet",
    requiresIncludedTv: true,
    includedTvCode: "TV-BASICO",
  },
})
const extra = component({
  id: "c-extra",
  code: "EXTRA",
  name: "Extra",
  monthlyPrice: 1000,
  compatibility: { category: "internet" },
})
const otherTier = component({
  id: "c-other",
  code: "TV-OTHER",
  name: "Otro TV",
  componentType: "tv_upgrade",
  monthlyPrice: 1000,
  exclusiveGroup: "tv_tier",
  compatibility: {
    category: "internet",
    requiresIncludedTv: true,
    includedTvCode: "TV-BASICO",
  },
})
const jubilado = condition({
  id: "k-jubilado",
  code: "JUBILADO",
  name: "Jubilado",
  discountPercent: 50,
})
const convenio = condition({
  id: "k-convenio",
  code: "CONVENIO-NODO",
  name: "Convenio Nodo",
  discountPercent: 100,
})
const inactiveCondition = condition({
  id: "k-off",
  code: "INACTIVA",
  name: "Inactiva",
  discountPercent: 10,
  isActive: false,
})

function component(overrides) {
  return {
    id: overrides.id,
    code: overrides.code,
    name: overrides.name,
    description: null,
    componentType: overrides.componentType ?? "addon",
    monthlyPrice: overrides.monthlyPrice,
    currency: "ARS",
    isRecurring: true,
    isActive: overrides.isActive ?? true,
    compatibility: overrides.compatibility,
    exclusiveGroup: overrides.exclusiveGroup ?? null,
    tvPlanCatalogId: overrides.tvPlanCatalogId ?? null,
  }
}

function condition(overrides) {
  return {
    id: overrides.id,
    code: overrides.code,
    name: overrides.name,
    description: null,
    discountPercent: overrides.discountPercent,
    isActive: overrides.isActive ?? true,
  }
}

function memoryGateway(options = {}) {
  const state = {
    serviceId: SERVICE,
    catalogId: options.catalogId === undefined ? CATALOG : options.catalogId,
    listPrice: options.listPrice === undefined ? 39300 : options.listPrice,
    base:
      options.base === undefined
        ? {
            category: "internet",
            monthlyPrice: 39300,
            includedTvCode:
              options.includedTvCode === undefined ? "TV-BASICO" : options.includedTvCode,
          }
        : options.base,
    components: structuredClone([packFutbol, publicIp, tvFull, extra, otherTier]),
    conditions: structuredClone([jubilado, convenio, inactiveCondition]),
    assignments: [],
    conditionAssignment: null,
    priced: false,
    componentInserts: 0,
    conditionInserts: 0,
    nextId: 1,
  }

  function snapshot() {
    const activeComponents = state.assignments
      .filter((assignment) => assignment.status === "active")
      .map((assignment) => {
        const item = state.components.find(
          (component) => component.id === assignment.componentId
        )
        return {
          assignmentId: assignment.id,
          componentId: assignment.componentId,
          code: item.code,
          name: item.name,
          componentType: item.componentType,
          unitPrice: assignment.unitPrice,
          isRecurring: assignment.isRecurring,
          exclusiveGroup: item.exclusiveGroup,
          status: "active",
        }
      })
    const active = state.conditionAssignment
    const activeCondition =
      active && active.status === "active"
        ? {
            assignmentId: active.id,
            conditionId: active.conditionId,
            code: state.conditions.find((item) => item.id === active.conditionId)
              .code,
            name: state.conditions.find((item) => item.id === active.conditionId)
              .name,
            discountPercent: active.discountPercent,
            status: "active",
          }
        : null

    return {
      serviceId: state.serviceId,
      catalogId: state.catalogId,
      listPrice: state.listPrice,
      base: state.base,
      components: state.components,
      conditions: state.conditions,
      activeComponents,
      activeCondition,
    }
  }

  function persistedPrice() {
    if (!state.priced) return null
    const current = snapshot()
    const price = calculateCommercialPrice({
      listPrice: resolveCommercialListPrice(
        current.listPrice,
        current.base?.monthlyPrice ?? null
      ),
      components: current.activeComponents.map((component) => ({
        unitPrice: component.unitPrice,
        isRecurring: component.isRecurring,
        status: "active",
      })),
      discountPercent: current.activeCondition?.discountPercent ?? null,
    })
    return {
      serviceId: state.serviceId,
      catalogId: state.catalogId,
      ...price,
    }
  }

  return {
    state,
    async load(companyId, serviceId) {
      if (companyId !== COMPANY || serviceId !== SERVICE || options.missing) return null
      return snapshot()
    },
    async insertComponentAssignment(input) {
      state.componentInserts += 1
      const duplicate = state.assignments.some(
        (assignment) =>
          assignment.componentId === input.componentId &&
          assignment.status === "active"
      )
      if (duplicate) throw new Error("isp_service_components_one_active_idx")
      state.assignments.push({
        id: `a-${state.nextId++}`,
        componentId: input.componentId,
        unitPrice: input.unitPrice,
        isRecurring: input.isRecurring,
        status: "active",
      })
      state.priced = true
    },
    async cancelComponentAssignment(input) {
      const assignment = state.assignments.find(
        (item) => item.id === input.assignmentId && item.status === "active"
      )
      if (!assignment) throw new Error("missing component")
      assignment.status = "cancelled"
      state.priced = true
    },
    async insertConditionAssignment(input) {
      state.conditionInserts += 1
      if (state.conditionAssignment?.status === "active") {
        throw new Error("isp_service_conditions_one_active_idx")
      }
      state.conditionAssignment = {
        id: `k-${state.nextId++}`,
        conditionId: input.conditionId,
        discountPercent: input.discountPercent,
        status: "active",
      }
      state.priced = true
    },
    async cancelConditionAssignment(input) {
      if (state.conditionAssignment?.id !== input.assignmentId) {
        throw new Error("missing condition")
      }
      state.conditionAssignment = {
        ...state.conditionAssignment,
        status: "cancelled",
      }
      state.priced = true
    },
    async readPrice() {
      return persistedPrice()
    },
  }
}

function serviceFor(options) {
  const gateway = memoryGateway(options)
  return { gateway, service: createIspCommercialAssignmentService(gateway) }
}

test("un abono con TV ofrece Pack Fútbol y TV Full, y no ofrece IP Pública", async () => {
  const { service } = serviceFor()
  const available = await service.listAvailableComponents(COMPANY, SERVICE)
  assert.equal(available.catalogId, CATALOG)
  assert.deepEqual(
    available.components.map((component) => component.code),
    ["EXTRA", "PACK-FUTBOL", "TV-FULL-UPGRADE", "TV-OTHER"]
  )
  assert.equal(
    available.components.find((component) => component.code === "TV-FULL-UPGRADE")
      .monthlyPrice,
    5400
  )
})

test("sin TV incluida no se puede asignar Pack Fútbol ni el upgrade", async () => {
  const { service } = serviceFor({ includedTvCode: null })
  const available = await service.listAvailableComponents(COMPANY, SERVICE)
  assert.deepEqual(
    available.components.map((component) => component.code),
    ["EXTRA"]
  )

  await assert.rejects(
    service.assignComponent(COMPANY, { serviceId: SERVICE, componentId: "c-futbol" }),
    { message: ISP_COMMERCIAL_COMPONENT_INCOMPATIBLE }
  )
  await assert.rejects(
    service.assignComponent(COMPANY, { serviceId: SERVICE, componentId: "c-ip" }),
    { message: ISP_COMMERCIAL_COMPONENT_INACTIVE }
  )
})

test("asignar y quitar componentes persiste el precio sin cambiar el abono base", async () => {
  const { gateway, service } = serviceFor()
  const before = await service.listActiveComponents(COMPANY, SERVICE)
  assert.equal(before.catalogId, CATALOG)
  assert.deepEqual(before.components, [])
  assert.equal(before.price, null)

  const withFootball = await service.assignComponent(COMPANY, {
    serviceId: SERVICE,
    componentId: "c-futbol",
  })
  assert.equal(withFootball.catalogId, CATALOG)
  assert.equal(withFootball.priceSubtotal, 42300)
  assert.equal(withFootball.discountAmount, 0)
  assert.equal(withFootball.monthlyFee, 42300)

  const withUpgrade = await service.assignComponent(COMPANY, {
    serviceId: SERVICE,
    componentId: "c-tv",
  })
  assert.equal(withUpgrade.priceSubtotal, 47700)
  assert.equal(withUpgrade.monthlyFee, 47700)

  const active = await service.listActiveComponents(COMPANY, SERVICE)
  assert.deepEqual(
    active.components.map((component) => [component.code, component.unitPrice]),
    [
      ["PACK-FUTBOL", 3000],
      ["TV-FULL-UPGRADE", 5400],
    ]
  )

  gateway.state.components.find((component) => component.id === "c-futbol").monthlyPrice =
    9999
  const stillSnapshot = await service.listActiveComponents(COMPANY, SERVICE)
  assert.equal(
    stillSnapshot.components.find((component) => component.code === "PACK-FUTBOL")
      .unitPrice,
    3000
  )
  assert.equal(stillSnapshot.price.monthlyFee, 47700)

  await assert.rejects(
    service.assignComponent(COMPANY, { serviceId: SERVICE, componentId: "c-futbol" }),
    { message: ISP_COMMERCIAL_COMPONENT_ALREADY_ASSIGNED }
  )
  await assert.rejects(
    service.assignComponent(COMPANY, { serviceId: SERVICE, componentId: "c-other" }),
    { message: ISP_COMMERCIAL_COMPONENT_EXCLUSIVE_GROUP }
  )
  assert.equal(gateway.state.componentInserts, 2)

  const withoutFootball = await service.cancelComponent(COMPANY, {
    serviceId: SERVICE,
    componentId: "c-futbol",
  })
  assert.equal(withoutFootball.monthlyFee, 44700)
  assert.equal(withoutFootball.catalogId, CATALOG)

  const withoutUpgrade = await service.cancelComponent(COMPANY, {
    serviceId: SERVICE,
    componentId: "c-tv",
  })
  assert.equal(withoutUpgrade.priceSubtotal, 39300)
  assert.equal(withoutUpgrade.monthlyFee, 39300)

  await assert.rejects(
    service.cancelComponent(COMPANY, { serviceId: SERVICE, componentId: "c-futbol" }),
    { message: ISP_COMMERCIAL_COMPONENT_NOT_ASSIGNED }
  )
})

test("un componente nuevo entra por compatibilidad y precio, no por código", async () => {
  const { service } = serviceFor({ listPrice: 10000 })
  const priced = await service.assignComponent(COMPANY, {
    serviceId: SERVICE,
    componentId: "c-extra",
  })
  assert.equal(priced.priceSubtotal, 11000)
  assert.equal(priced.monthlyFee, 11000)
  assert.equal(priced.catalogId, CATALOG)
})

test("la condición reemplaza a la anterior y puede dejar el abono en cero", async () => {
  const { gateway, service } = serviceFor()
  await service.assignComponent(COMPANY, {
    serviceId: SERVICE,
    componentId: "c-futbol",
  })
  await service.assignComponent(COMPANY, {
    serviceId: SERVICE,
    componentId: "c-tv",
  })

  const retired = await service.assignCondition(COMPANY, {
    serviceId: SERVICE,
    conditionId: "k-jubilado",
  })
  assert.equal(retired.priceSubtotal, 47700)
  assert.equal(retired.discountAmount, 23850)
  assert.equal(retired.monthlyFee, 23850)
  assert.equal((await service.getActiveCondition(COMPANY, SERVICE)).condition.code, "JUBILADO")

  const same = await service.assignCondition(COMPANY, {
    serviceId: SERVICE,
    conditionId: "k-jubilado",
  })
  assert.equal(same.monthlyFee, 23850)
  assert.equal(gateway.state.conditionInserts, 1)

  const waived = await service.assignCondition(COMPANY, {
    serviceId: SERVICE,
    conditionId: "k-convenio",
  })
  assert.equal(waived.priceSubtotal, 47700)
  assert.equal(waived.discountAmount, 47700)
  assert.equal(waived.monthlyFee, 0)
  assert.equal(gateway.state.conditionAssignment.status, "active")
  assert.equal(gateway.state.conditionInserts, 2)
  assert.equal(
    (await service.getActiveCondition(COMPANY, SERVICE)).condition.code,
    "CONVENIO-NODO"
  )

  const restored = await service.removeCondition(COMPANY, SERVICE)
  assert.equal(restored.discountAmount, 0)
  assert.equal(restored.monthlyFee, 47700)
  assert.equal((await service.getActiveCondition(COMPANY, SERVICE)).condition, null)

  await assert.rejects(service.removeCondition(COMPANY, SERVICE), {
    message: ISP_COMMERCIAL_CONDITION_NOT_ASSIGNED,
  })
  await assert.rejects(
    service.assignCondition(COMPANY, { serviceId: SERVICE, conditionId: "k-off" }),
    { message: ISP_COMMERCIAL_CONDITION_INACTIVE }
  )
})

test("el servicio inexistente no se modifica", async () => {
  const { service } = serviceFor({ missing: true })
  await assert.rejects(service.listAvailableComponents(COMPANY, SERVICE), {
    message: ISP_COMMERCIAL_SERVICE_NOT_FOUND,
  })
})

test("la consulta no reescribe el catálogo ni el precio a mano", () => {
  const source = readFileSync(
    resolve(root, "lib/isp/commercial-assignment-queries.ts"),
    "utf8"
  )
  const domain = readFileSync(
    resolve(root, "lib/isp/commercial-assignment.ts"),
    "utf8"
  )
  assert.match(source, /apply_isp_service_commercial_price/)
  assert.doesNotMatch(source, /calculateCommercialPrice/)
  assert.doesNotMatch(source, /PACK-FUTBOL/)
  assert.doesNotMatch(source, /\.update\(\s*\{[^}]*monthly_fee/)
  assert.doesNotMatch(source, /\.update\(\s*\{[^}]*catalog_id/)
  assert.doesNotMatch(domain, /PACK-FUTBOL/)
  assert.doesNotMatch(domain, /JUBILADO/)
  assert.equal(
    availableCommercialComponents({
      serviceId: SERVICE,
      catalogId: null,
      listPrice: 39300,
      base: null,
      components: [packFutbol],
      conditions: [],
      activeComponents: [],
      activeCondition: null,
    }).length,
    0
  )
})
