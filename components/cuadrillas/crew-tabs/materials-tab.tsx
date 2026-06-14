import { CrewMaterialsPanel } from "@/components/materiales/crew-materials-panel"
import type { Crew } from "@/lib/types/crews"

type CrewMaterialsTabProps = {
  crew: Crew
}

export function CrewMaterialsTab({ crew }: CrewMaterialsTabProps) {
  return <CrewMaterialsPanel crewId={crew.id} crewName={crew.name} />
}
