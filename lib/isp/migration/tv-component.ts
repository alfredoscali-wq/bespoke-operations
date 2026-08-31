import { resolveCommercialTvComponent } from "@/lib/isp/catalog-integrity"
import {
  ISP_MIGRATION_SERVICE_NOT_FOUND_MESSAGE,
  ispMigrationInvalidTvRefMessage,
} from "@/lib/isp/migration/constants"
import type { IspMigrationExistingCatalog } from "@/lib/isp/migration/types"

export type IspMigrationTvComponent = {
  tvPlanCatalogId: string
  tvPlanName: string
  tvPlanCode: string | null
  tvMonthlyPrice: number | null
}

export type IspMigrationCommercialMatch =
  | { ok: true; source: "existing"; catalog: IspMigrationExistingCatalog }
  | { ok: true; source: "file"; catalog: null }
  | { ok: false; message: string }

function lower(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

export function buildIspMigrationCatalogIndex(
  catalog: readonly IspMigrationExistingCatalog[]
) {
  const byId = new Map<string, IspMigrationExistingCatalog>()
  const byExternalCode = new Map<string, IspMigrationExistingCatalog>()
  const byCode = new Map<string, IspMigrationExistingCatalog>()
  const byName = new Map<string, IspMigrationExistingCatalog>()

  for (const item of catalog) {
    byId.set(item.id, item)
    if (item.externalCode?.trim()) {
      byExternalCode.set(lower(item.externalCode), item)
    }
    if (item.code?.trim()) {
      byCode.set(lower(item.code), item)
    }
    if (item.name.trim()) {
      byName.set(lower(item.name), item)
    }
  }

  return { byId, byExternalCode, byCode, byName }
}

export function resolveIspMigrationCommercialCatalog(input: {
  catalogoIdExterno: string
  nombreServicio: string
  fileCatalogIds: Set<string>
  index: ReturnType<typeof buildIspMigrationCatalogIndex>
}): IspMigrationCommercialMatch {
  const external = input.catalogoIdExterno.trim()
  const name = input.nombreServicio.trim()
  if (!external) {
    return { ok: false, message: ISP_MIGRATION_SERVICE_NOT_FOUND_MESSAGE }
  }

  const byExternal = input.index.byExternalCode.get(lower(external))
  if (byExternal) {
    return { ok: true, source: "existing", catalog: byExternal }
  }

  const byCode = input.index.byCode.get(lower(external))
  if (byCode) {
    return { ok: true, source: "existing", catalog: byCode }
  }

  if (name) {
    const byName = input.index.byName.get(lower(name))
    if (byName) {
      return { ok: true, source: "existing", catalog: byName }
    }
  }

  if (input.fileCatalogIds.has(lower(external))) {
    return { ok: true, source: "file", catalog: null }
  }

  return { ok: false, message: ISP_MIGRATION_SERVICE_NOT_FOUND_MESSAGE }
}

export function resolveIspMigrationTvComponent(
  commercial: IspMigrationExistingCatalog,
  catalogById: ReadonlyMap<string, IspMigrationExistingCatalog>
): { ok: true; component: IspMigrationTvComponent | null } | { ok: false; message: string } {
  const tvPlanId = commercial.tvPlanCatalogId?.trim() ?? ""
  if (!tvPlanId) {
    return { ok: true, component: null }
  }

  const plan = catalogById.get(tvPlanId)
  const companyId =
    commercial.companyId?.trim() || plan?.companyId?.trim() || ""
  const lookup = resolveCommercialTvComponent({
    actorCompanyId: companyId || commercial.id,
    commercial: {
      id: commercial.id,
      companyId: commercial.companyId?.trim() || companyId || commercial.id,
      name: commercial.name,
      monthlyPrice: commercial.monthlyPrice ?? null,
      tvPlanCatalogId: tvPlanId,
    },
    tvPlan: plan
      ? {
          id: plan.id,
          companyId: plan.companyId?.trim() || companyId || commercial.id,
          code: plan.code ?? null,
          name: plan.name,
          monthlyPrice: plan.monthlyPrice ?? null,
          category: (plan.category ?? "").trim().toLowerCase() || "unknown",
        }
      : null,
  })

  if (!lookup) {
    return {
      ok: false,
      message: ispMigrationInvalidTvRefMessage(commercial.name),
    }
  }

  return {
    ok: true,
    component: {
      tvPlanCatalogId: lookup.tvPlanCatalogId,
      tvPlanName: lookup.tvPlanName,
      tvPlanCode: lookup.tvPlanCode,
      tvMonthlyPrice: lookup.tvMonthlyPrice,
    },
  }
}

export function commercialServiceNamesForMigrationTemplate(
  catalog: readonly IspMigrationExistingCatalog[]
): string[] {
  const names = new Set<string>()
  for (const item of catalog) {
    if ((item.category ?? "").trim().toLowerCase() === "tv") continue
    const name = item.name.trim()
    if (name) names.add(name)
  }
  return [...names].sort((a, b) => a.localeCompare(b, "es"))
}
