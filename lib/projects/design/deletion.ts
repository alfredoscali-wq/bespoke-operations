import type {
  ProjectDesignElement,
  ProjectDesignSegment,
} from "@/lib/types/project-design"

export type ProjectDesignElementDeleteImpact = {
  elementId: string
  attachedSegmentIds: string[]
  attachedSegmentCount: number
}

export function resolveProjectDesignElementDeleteImpact(
  elementId: string,
  segments: Pick<
    ProjectDesignSegment,
    "id" | "originElementId" | "destinationElementId"
  >[]
): ProjectDesignElementDeleteImpact {
  const attachedSegmentIds = segments
    .filter(
      (segment) =>
        segment.originElementId === elementId ||
        segment.destinationElementId === elementId
    )
    .map((segment) => segment.id)

  return {
    elementId,
    attachedSegmentIds,
    attachedSegmentCount: attachedSegmentIds.length,
  }
}

export function buildProjectDesignSegmentDeleteMessage(
  attachedGainCount: number
): string {
  if (attachedGainCount === 0) {
    return "¿Eliminar el tramo? Esta acción no se puede deshacer."
  }

  const gainLabel =
    attachedGainCount === 1
      ? "1 ganancia asociada"
      : `${attachedGainCount} ganancias asociadas`

  return `¿Eliminar el tramo y ${gainLabel}? Las ganancias no se conservan.`
}

export function buildProjectDesignElementDeleteMessage(
  element: Pick<ProjectDesignElement, "name">,
  impact: ProjectDesignElementDeleteImpact
): string {
  if (impact.attachedSegmentCount === 0) {
    return `¿Eliminar ${element.name}? Esta acción no se puede deshacer.`
  }

  const tramoLabel =
    impact.attachedSegmentCount === 1
      ? "1 tramo asociado se conservará"
      : `${impact.attachedSegmentCount} tramos asociados se conservarán`

  return `¿Eliminar ${element.name}? ${tramoLabel} sin origen/destino; la geometría no se borra.`
}

export function assertSameProjectDesignTenant(input: {
  companyId: string
  projectCompanyId: string
  projectId: string
  resourceProjectId: string
}): { ok: true } | { ok: false; message: string } {
  if (input.companyId !== input.projectCompanyId) {
    return {
      ok: false,
      message: "La obra no pertenece a esta empresa.",
    }
  }

  if (input.projectId !== input.resourceProjectId) {
    return {
      ok: false,
      message: "El diseño no pertenece a esta obra.",
    }
  }

  return { ok: true }
}
