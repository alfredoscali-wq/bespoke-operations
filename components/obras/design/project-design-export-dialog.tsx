"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  PROJECT_DESIGN_PDF_EXPORT_ERROR,
  exportProjectDesignToPdf,
} from "@/lib/projects/design/export-pdf"
import {
  PROJECT_DESIGN_EXPORT_SECTION_IDS,
  PROJECT_DESIGN_EXPORT_SECTION_LABELS,
  createDefaultProjectDesignExportOptions,
  type ProjectDesignExportOptions,
  type ProjectDesignExportOrientation,
} from "@/lib/projects/design/export-options"
import type { ProjectDesignSnapshot } from "@/lib/types/project-design"
import type { Project } from "@/lib/types/projects"

type ProjectDesignExportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Pick<
    Project,
    | "id"
    | "code"
    | "name"
    | "status"
    | "location"
    | "description"
    | "latitude"
    | "longitude"
  >
  snapshot: ProjectDesignSnapshot
}

export function ProjectDesignExportDialog({
  open,
  onOpenChange,
  project,
  snapshot,
}: ProjectDesignExportDialogProps) {
  const [options, setOptions] = useState<ProjectDesignExportOptions>(
    createDefaultProjectDesignExportOptions
  )
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setOrientation(orientation: ProjectDesignExportOrientation) {
    setOptions((current) => ({ ...current, orientation }))
  }

  function toggleSection(section: (typeof PROJECT_DESIGN_EXPORT_SECTION_IDS)[number]) {
    setOptions((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [section]: !current.sections[section],
      },
    }))
  }

  async function handleExport() {
    if (generating) {
      return
    }
    setGenerating(true)
    setError(null)
    try {
      await exportProjectDesignToPdf({
        project,
        snapshot,
        options: { ...options, format: "pdf" },
      })
      onOpenChange(false)
    } catch {
      setError(PROJECT_DESIGN_PDF_EXPORT_ERROR)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (generating) {
          return
        }
        if (!next) {
          setError(null)
          setOptions(createDefaultProjectDesignExportOptions())
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[min(92vh,40rem)] w-full overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar diseño de obra</DialogTitle>
          <DialogDescription>
            Genera un PDF técnico a partir del diseño actual. No modifica el
            editor ni la geometría.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Formato</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="project-design-export-format"
                checked
                readOnly
                className="size-3.5 accent-primary"
              />
              PDF
            </label>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Contenido</legend>
            <div className="grid gap-2">
              {PROJECT_DESIGN_EXPORT_SECTION_IDS.map((section) => (
                <label
                  key={section}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={options.sections[section]}
                    disabled={generating}
                    onCheckedChange={() => toggleSection(section)}
                  />
                  {PROJECT_DESIGN_EXPORT_SECTION_LABELS[section]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Orientación</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="project-design-export-orientation"
                className="size-3.5 accent-primary"
                checked={options.orientation === "landscape"}
                disabled={generating}
                onChange={() => setOrientation("landscape")}
              />
              Horizontal (recomendada)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="project-design-export-orientation"
                className="size-3.5 accent-primary"
                checked={options.orientation === "portrait"}
                disabled={generating}
                onChange={() => setOrientation("portrait")}
              />
              Vertical
            </label>
          </fieldset>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={generating}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={generating}
            onClick={() => void handleExport()}
          >
            {generating ? "Generando PDF..." : "Exportar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
