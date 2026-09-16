import type {
  ProjectDesignElement,
  ProjectDesignElementKind,
  ProjectDesignSegmentType,
} from "@/lib/types/project-design"

const NAP_NAME_PATTERN = /^NAP\s+(\d+)$/i
const NODE_NAME_PATTERN = /^Nodo\s+(\d+)$/i

function nextNumberedLabel(
  elements: Pick<ProjectDesignElement, "kind" | "name">[],
  kind: ProjectDesignElementKind,
  pattern: RegExp,
  prefix: string
): string {
  let max = 0
  for (const element of elements) {
    if (element.kind !== kind) {
      continue
    }
    const match = element.name.trim().match(pattern)
    if (!match) {
      continue
    }
    const value = Number.parseInt(match[1], 10)
    if (Number.isFinite(value) && value > max) {
      max = value
    }
  }

  return `${prefix} ${max + 1}`
}

export function suggestProjectDesignElementName(
  elements: Pick<ProjectDesignElement, "kind" | "name">[],
  kind: ProjectDesignElementKind
): string {
  if (kind === "nap") {
    return nextNumberedLabel(elements, "nap", NAP_NAME_PATTERN, "NAP")
  }

  return nextNumberedLabel(elements, "node", NODE_NAME_PATTERN, "Nodo")
}

export function formatProjectDesignKindLabel(
  kind: ProjectDesignElementKind
): string {
  return kind === "nap" ? "NAP" : "Nodo"
}

export function formatProjectDesignSegmentTypeLabel(
  type: ProjectDesignSegmentType
): string {
  if (type === "drop") {
    return "Drop"
  }
  if (type === "otro") {
    return "Otro"
  }
  return "Tendido"
}
