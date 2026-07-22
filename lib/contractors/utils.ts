import type {
  Contractor,
  ContractorFilters,
  ContractorListItem,
  ContractorSummary,
} from "@/lib/types/contractors"
import type { Crew } from "@/lib/types/crews"
import type { Employee } from "@/lib/types/employees"
import { filterExternalCrews } from "@/lib/crews/origin"
import { filterContractorEmployees } from "@/lib/contractors/employees"

export const defaultContractorFilters: ContractorFilters = {
  search: "",
  status: "all",
}

export function getContractorDisplayName(
  contractor: Pick<Contractor, "legalName" | "tradeName">
): string {
  const trade = contractor.tradeName.trim()
  if (trade) return trade
  return contractor.legalName
}

export function buildContractorListItems(
  contractors: Contractor[],
  crews: Crew[],
  employees: Employee[]
): ContractorListItem[] {
  return contractors.map((contractor) => ({
    ...contractor,
    crewCount: filterExternalCrews(crews, contractor.id).length,
    userCount: filterContractorEmployees(employees, contractor.id).length,
  }))
}

export function getContractorSummary(
  contractors: Contractor[],
  crews: Crew[]
): ContractorSummary {
  return {
    total: contractors.length,
    active: contractors.filter((item) => item.status === "activo").length,
    inactive: contractors.filter((item) => item.status === "inactivo").length,
    externalCrews: filterExternalCrews(crews).length,
  }
}

export function filterContractors(
  items: ContractorListItem[],
  filters: ContractorFilters
): ContractorListItem[] {
  const query = filters.search.trim().toLowerCase()

  return items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) {
      return false
    }

    if (!query) return true

    const haystack = [
      item.legalName,
      item.tradeName,
      item.taxId,
      item.responsibleName,
      item.email,
      item.phone,
    ]
      .join(" ")
      .toLowerCase()

    return haystack.includes(query)
  })
}
