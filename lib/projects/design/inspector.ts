import type { ProjectDesignTool } from "@/lib/types/project-design"

export function resolveDesignInspectorAfterSave(saved: boolean): {
  close: boolean
  selected: null
  tool: ProjectDesignTool
} {
  if (!saved) {
    return { close: false, selected: null, tool: "select" }
  }
  return { close: true, selected: null, tool: "select" }
}
