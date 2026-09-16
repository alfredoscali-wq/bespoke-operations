export const PROJECT_DESIGN_EXPORT_FORMATS = ["pdf"] as const

export type ProjectDesignExportFormat =
  (typeof PROJECT_DESIGN_EXPORT_FORMATS)[number]

export const PROJECT_DESIGN_EXPORT_ORIENTATIONS = [
  "landscape",
  "portrait",
] as const

export type ProjectDesignExportOrientation =
  (typeof PROJECT_DESIGN_EXPORT_ORIENTATIONS)[number]

export const PROJECT_DESIGN_EXPORT_SECTION_IDS = [
  "map",
  "legend",
  "summary",
  "nodes",
  "naps",
  "traces",
  "gains",
  "notes",
] as const

export type ProjectDesignExportSectionId =
  (typeof PROJECT_DESIGN_EXPORT_SECTION_IDS)[number]

export const PROJECT_DESIGN_EXPORT_SECTION_ORDER: readonly ProjectDesignExportSectionId[] =
  PROJECT_DESIGN_EXPORT_SECTION_IDS

export const PROJECT_DESIGN_EXPORT_SECTION_LABELS: Record<
  ProjectDesignExportSectionId,
  string
> = {
  map: "Mapa del diseño",
  legend: "Leyenda",
  summary: "Resumen de la obra",
  nodes: "Tabla de Nodes",
  naps: "Tabla de NAPs",
  traces: "Tabla de trazas",
  gains: "Tabla de ganancias",
  notes: "Observaciones",
}

export type ProjectDesignExportOptions = {
  format: ProjectDesignExportFormat
  orientation: ProjectDesignExportOrientation
  sections: Record<ProjectDesignExportSectionId, boolean>
}

export const DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS: ProjectDesignExportOptions =
  {
    format: "pdf",
    orientation: "landscape",
    sections: {
      map: true,
      legend: true,
      summary: true,
      nodes: true,
      naps: true,
      traces: true,
      gains: true,
      notes: true,
    },
  }

export function createDefaultProjectDesignExportOptions(): ProjectDesignExportOptions {
  return {
    format: "pdf",
    orientation: "landscape",
    sections: { ...DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS.sections },
  }
}

export function isProjectDesignExportSectionEnabled(
  options: ProjectDesignExportOptions,
  section: ProjectDesignExportSectionId
): boolean {
  return options.sections[section] === true
}
