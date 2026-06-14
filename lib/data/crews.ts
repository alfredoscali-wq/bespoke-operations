import type { Crew } from "@/lib/types/crews"

/** Legacy export kept for dashboard fallback only — cuadrillas module uses Supabase via CrewsProvider */
export const mockCrews: Crew[] = []

export {
  buildCrewListItem,
  filterCrews,
  getCrewById,
  getCrewByName,
  getCrewDetail,
  getCrewListItems,
  getCrewProjects,
  getCrewTasks,
  getCrewsSummary,
  getSupervisorOptions,
  defaultCrewFilters,
} from "@/lib/crews/utils"
