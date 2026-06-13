import { EvidenceModule } from "@/components/evidencias/evidence-module"
import { defaultEvidenceFilters } from "@/lib/data/evidence"
import type { EvidenceFilters } from "@/lib/types/evidence"

type EvidenciasPageProps = {
  searchParams: Promise<{ project?: string; task?: string }>
}

export default async function EvidenciasPage({
  searchParams,
}: EvidenciasPageProps) {
  const params = await searchParams
  const initialFilters: EvidenceFilters = {
    ...defaultEvidenceFilters,
    projectId: params.project ?? "all",
    taskId: params.task ?? "all",
  }

  return <EvidenceModule initialFilters={initialFilters} />
}
