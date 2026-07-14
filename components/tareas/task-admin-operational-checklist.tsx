"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { TaskPhotoViewerDialog } from "@/components/tareas/task-photo-viewer-dialog"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { fetchResolvedWorkOrderTypeChecklistItems } from "@/lib/supabase/work-order-type-checklist.browser"
import { listTaskEvidencePhotos } from "@/lib/supabase/task-photos.browser"
import {
  buildOperationalChecklistDisplayItems,
  buildOperationalChecklistDisplayItemsFromResponses,
  readOperationalChecklistResponses,
  type OperationalChecklistDisplayItem,
} from "@/lib/tasks/operational-checklist-responses"
import {
  readOperationalChecklistTemplate,
  shouldShowOperationalChecklistForTask,
} from "@/lib/tasks/operational-checklist-template"
import { resolveWorkOrderTechnologyFromTask } from "@/lib/tasks/work-order"
import type { TaskPhoto } from "@/lib/types/task-photos"
import type { Task } from "@/lib/types/tasks"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskAdminOperationalChecklistProps = {
  task: Task
}

function resolveChecklistFieldValue(
  item: OperationalChecklistDisplayItem
): string | null {
  if (item.fieldType === "confirmacion") {
    if (item.confirmed === true) {
      return "Sí"
    }
    if (item.confirmed === false) {
      return "No"
    }
    return null
  }

  if (item.fieldType === "entrada-datos") {
    return item.textValue
  }

  return null
}

export function TaskAdminOperationalChecklist({
  task,
}: TaskAdminOperationalChecklistProps) {
  const { companyId } = useTenantCompanyId()
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [items, setItems] = useState<OperationalChecklistDisplayItem[]>([])
  const [executionPhotos, setExecutionPhotos] = useState<TaskPhoto[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<TaskPhoto | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  const responses = useMemo(
    () => readOperationalChecklistResponses(task),
    [task]
  )
  const hasStoredResponses = Object.keys(responses).length > 0

  const dataItems = useMemo(
    () => items.filter((item) => item.fieldType !== "fotografia"),
    [items]
  )

  const shouldShowChecklist =
    shouldShowOperationalChecklistForTask(task) || hasStoredResponses

  useEffect(() => {
    if (!shouldShowChecklist) {
      setItems([])
      setExecutionPhotos([])
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function loadChecklist() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const embeddedTemplate = task.projectId
          ? readOperationalChecklistTemplate(task)
          : []

        const templateResult =
          embeddedTemplate.length > 0
            ? { data: embeddedTemplate, error: null }
            : task.serviceType?.trim()
              ? await fetchResolvedWorkOrderTypeChecklistItems(
                  companyId,
                  task.serviceType.trim(),
                  resolveWorkOrderTechnologyFromTask(task)
                )
              : { data: [], error: null }

        if (cancelled) {
          return
        }

        if (templateResult.error) {
          setLoadError(templateResult.error.message)
          setItems([])
          setExecutionPhotos([])
          return
        }

        const displayItems =
          (templateResult.data ?? []).length > 0
            ? buildOperationalChecklistDisplayItems({
                template: templateResult.data ?? [],
                responses,
                includeUnanswered: false,
              })
            : buildOperationalChecklistDisplayItemsFromResponses(responses)

        setItems(displayItems)

        const photosResult = await listTaskEvidencePhotos(task.id)
        if (!cancelled) {
          if (photosResult.error) {
            setExecutionPhotos([])
          } else {
            setExecutionPhotos(photosResult.data ?? [])
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el checklist operativo."
          )
          setItems([])
          setExecutionPhotos([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadChecklist()

    return () => {
      cancelled = true
    }
  }, [companyId, responses, shouldShowChecklist, task])

  if (!shouldShowChecklist) {
    return null
  }

  const hasContent = dataItems.length > 0 || executionPhotos.length > 0

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Checklist de ejecución</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando checklist...
            </div>
          ) : loadError ? (
            <p className="py-4 text-center text-sm text-destructive">
              {loadError}
            </p>
          ) : !hasContent ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {hasStoredResponses
                ? "No se pudieron asociar las respuestas al checklist configurado."
                : "No hay respuestas registradas en el checklist operativo."}
            </p>
          ) : (
            <div className="space-y-5">
              {dataItems.length > 0 ? (
                <div className="space-y-4">
                  {dataItems.map((item) => {
                    const value = resolveChecklistFieldValue(item)

                    return (
                      <div key={item.id}>
                        <p className="text-sm text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {value ?? "—"}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {executionPhotos.length > 0 ? (
                <div
                  className={
                    dataItems.length > 0
                      ? "border-t border-border/70 pt-5"
                      : undefined
                  }
                >
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {executionPhotos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => {
                          setSelectedPhoto(photo)
                          setViewerOpen(true)
                        }}
                        className="group w-28 shrink-0 overflow-hidden rounded-lg border bg-muted/20 text-left transition hover:border-primary/40 sm:w-32"
                      >
                        {photo.signedUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo.signedUrl}
                            alt={photo.description || photo.fileName}
                            className="aspect-square w-full object-cover transition group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex aspect-square items-center justify-center px-2 text-center text-xs text-muted-foreground">
                            {photo.fileName}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <TaskPhotoViewerDialog
        photo={selectedPhoto}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </>
  )
}
