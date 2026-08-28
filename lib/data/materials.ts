import type {
  EntityMaterialsStats,
  Material,
  MaterialAssignment,
} from "@/lib/types/materials"

type AssignmentItem = {
  assignment: MaterialAssignment
  material: Material
}

/** Materiales 1.0 — asignaciones OT aún no persistidas; paneles embebidos vacíos. */
export const mockMaterialAssignments: MaterialAssignment[] = []

export function getMaterialById(
  _id: string,
  _materials?: Material[]
): Material | undefined {
  return undefined
}

export function getAssignmentsByTaskId(_taskId: string): AssignmentItem[] {
  return []
}

export function getAssignmentsByProjectId(_projectId: string): AssignmentItem[] {
  return []
}

export function getAssignmentsByCrewId(_crewId: string): AssignmentItem[] {
  return []
}

export function getTaskMaterialsStats(
  _taskId: string
): EntityMaterialsStats {
  return { totalItems: 0, totalQuantity: 0, materialCount: 0 }
}

export function getProjectMaterialsStats(
  _projectId: string
): EntityMaterialsStats {
  return { totalItems: 0, totalQuantity: 0, materialCount: 0 }
}

export function getCrewMaterialsStats(
  _crewId: string
): EntityMaterialsStats {
  return { totalItems: 0, totalQuantity: 0, materialCount: 0 }
}
