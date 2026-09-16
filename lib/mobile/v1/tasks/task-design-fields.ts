import { readProjectDesignSourceMetadata } from "@/lib/projects/design/ot-proposals"
import type {
  MobileProjectDesignSourceDto,
  MobileProjectDesignWorkTypeDto,
} from "@/lib/mobile/v1/projects/types"
import type { Task } from "@/lib/types/tasks"

export type MobileTaskProjectDesignFields = {
  projectId: string | null
  projectName: string | null
  isProjectTask: boolean
  projectDesignWorkType: MobileProjectDesignWorkTypeDto | null
  projectDesignSource: MobileProjectDesignSourceDto | null
}

function projectMobileDesignSource(
  source: ReturnType<typeof readProjectDesignSourceMetadata>
): {
  workType: MobileProjectDesignWorkTypeDto
  source: MobileProjectDesignSourceDto
} | null {
  if (!source) {
    return null
  }

  if (source.kind === "segments") {
    return {
      workType: "tendido",
      source: {
        kind: "segments",
        segmentIds: source.segmentIds,
      },
    }
  }

  return {
    workType: source.kind,
    source: {
      kind: source.kind,
      elementId: source.elementId,
      identifier: source.identifier,
    },
  }
}

export function resolveMobileTaskProjectDesignFields(
  task: Pick<Task, "projectId" | "projectName" | "taskMetadata">
): MobileTaskProjectDesignFields {
  const projectId = task.projectId?.trim() || null
  const isProjectTask = Boolean(projectId)
  const projectName = isProjectTask ? task.projectName?.trim() || null : null
  const projected = projectMobileDesignSource(
    readProjectDesignSourceMetadata(task.taskMetadata)
  )

  return {
    projectId,
    projectName,
    isProjectTask,
    projectDesignWorkType: projected?.workType ?? null,
    projectDesignSource: projected?.source ?? null,
  }
}
