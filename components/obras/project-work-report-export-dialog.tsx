"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DEFAULT_PROJECT_WORK_REPORT_TASK_SCOPE,
  buildProjectWorkReportFileName,
  buildProjectWorkReportViewHref,
  defaultProjectWorkReportSelectedTaskIds,
  filterProjectWorkReportTasksByScope,
  isProjectWorkReportDeploymentTask,
  type ProjectWorkReportOptions,
  type ProjectWorkReportTaskScope,
} from "@/lib/projects/work-report"
import {
  DEFAULT_PROJECT_WORK_REPORT_SHARE_PASSWORD_PROTECTED,
  DEFAULT_PROJECT_WORK_REPORT_SHARE_TTL,
  PROJECT_WORK_REPORT_SHARE_TTL_OPTIONS,
  type ProjectWorkReportShareTtl,
} from "@/lib/projects/work-report/share-options"
import { formatDate } from "@/lib/projects/constants"
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import type { Task } from "@/lib/types/tasks"

type ShareStatus = {
  active: boolean
  isPasswordProtected: boolean
  expiresAt: string | null
  createdAt: string | null
  url: string | null
  taskScope: "all" | "completed" | "selected" | null
}

type ProjectWorkReportExportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectCode: string
  tasks: Task[]
  tasksReady: boolean
}

async function downloadWorkReportPdf(input: {
  projectId: string
  projectCode: string
  options: ProjectWorkReportOptions
}) {
  const response = await fetch(`/api/projects/${input.projectId}/work-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input.options),
  })

  const contentType = response.headers.get("content-type") ?? ""
  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as { message?: string }
      throw new Error(payload.message ?? "No se pudo generar el informe.")
    }
    throw new Error("No se pudo generar el informe.")
  }

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as {
      signedUrl?: string
      fileName?: string
    }
    if (!payload.signedUrl) {
      throw new Error("No se pudo preparar la descarga del informe.")
    }
    const anchor = document.createElement("a")
    anchor.href = payload.signedUrl
    anchor.download =
      payload.fileName ?? buildProjectWorkReportFileName(input.projectCode)
    anchor.target = "_blank"
    anchor.rel = "noopener noreferrer"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    return
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = buildProjectWorkReportFileName(input.projectCode)
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export function ProjectWorkReportExportDialog({
  open,
  onOpenChange,
  projectId,
  projectCode,
  tasks,
  tasksReady,
}: ProjectWorkReportExportDialogProps) {
  const [taskScope, setTaskScope] = useState<ProjectWorkReportTaskScope>(
    DEFAULT_PROJECT_WORK_REPORT_TASK_SCOPE
  )
  const [panel, setPanel] = useState<"menu" | "share">("menu")
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [share, setShare] = useState<ShareStatus | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [passwordProtected, setPasswordProtected] = useState(
    DEFAULT_PROJECT_WORK_REPORT_SHARE_PASSWORD_PROTECTED
  )
  const [password, setPassword] = useState("")
  const [expiresIn, setExpiresIn] = useState<ProjectWorkReportShareTtl>(
    DEFAULT_PROJECT_WORK_REPORT_SHARE_TTL
  )
  const [copyState, setCopyState] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [otSearch, setOtSearch] = useState("")
  const [showDeployment, setShowDeployment] = useState(false)

  const reportOptions = useMemo<ProjectWorkReportOptions>(
    () => ({
      taskScope,
      selectedTaskIds: taskScope === "selected" ? selectedIds : [],
    }),
    [taskScope, selectedIds]
  )

  const selectedCount = useMemo(
    () =>
      filterProjectWorkReportTasksByScope(
        tasks,
        taskScope,
        reportOptions.selectedTaskIds
      ).length,
    [tasks, taskScope, reportOptions.selectedTaskIds]
  )

  const informeHref = buildProjectWorkReportViewHref(projectId, reportOptions)

  const pickerTasks = useMemo(() => {
    const query = otSearch.trim().toLowerCase()
    return tasks.filter((task) => {
      const isDeployment = isProjectWorkReportDeploymentTask(task)
      if (isDeployment && !showDeployment) {
        return false
      }
      if (!query) {
        return true
      }
      const haystack = `${task.code} ${task.title ?? ""}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [tasks, otSearch, showDeployment])

  useEffect(() => {
    if (!open || panel !== "share") {
      return
    }

    let cancelled = false
    setShareLoading(true)
    void fetch(`/api/projects/${projectId}/work-report/share`)
      .then(async (response) => {
        const payload = (await response.json()) as {
          share?: ShareStatus
          message?: string
        }
        if (!response.ok) {
          throw new Error(payload.message ?? "No se pudo leer el enlace.")
        }
        if (!cancelled) {
          setShare(payload.share ?? null)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudo leer el enlace."
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setShareLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, panel, projectId])

  async function handleExport() {
    if (generating || !tasksReady || selectedCount === 0) {
      return
    }

    setGenerating(true)
    setError(null)

    try {
      await downloadWorkReportPdf({
        projectId,
        projectCode,
        options: reportOptions,
      })
      onOpenChange(false)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo generar el informe."
      )
    } finally {
      setGenerating(false)
    }
  }

  async function handleCreateShare(regenerate: boolean) {
    if (generating) return
    if (passwordProtected && password.trim().length === 0) {
      setError("Ingrese una contraseña para proteger el informe.")
      return
    }

    setGenerating(true)
    setError(null)
    setCopyState(null)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/work-report/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskScope,
            selectedTaskIds: reportOptions.selectedTaskIds,
            passwordProtected,
            password: passwordProtected ? password : null,
            expiresIn,
            regenerate,
          }),
        }
      )
      const payload = (await response.json()) as {
        share?: ShareStatus
        url?: string
        message?: string
      }
      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo crear el enlace.")
      }
      setShare(payload.share ?? null)
      setPassword("")
      if (payload.url) {
        await navigator.clipboard.writeText(payload.url)
        setCopyState("Enlace copiado.")
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo crear el enlace."
      )
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    const url = share?.url
    if (!url) {
      setError("Genere un nuevo enlace para copiarlo.")
      return
    }
    await navigator.clipboard.writeText(url)
    setCopyState("Enlace copiado.")
  }

  async function handleRevoke() {
    if (generating) return
    setGenerating(true)
    setError(null)
    setCopyState(null)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/work-report/share/revoke`,
        { method: "POST" }
      )
      const payload = (await response.json()) as {
        share?: ShareStatus
        message?: string
      }
      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo revocar el enlace.")
      }
      setShare(payload.share ?? { active: false } as ShareStatus)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo revocar el enlace."
      )
    } finally {
      setGenerating(false)
    }
  }

  const busy = generating || shareLoading

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (generating) {
          return
        }
        if (!next) {
          setError(null)
          setCopyState(null)
          setPanel("menu")
          setTaskScope(DEFAULT_PROJECT_WORK_REPORT_TASK_SCOPE)
          setSelectedIds([])
          setOtSearch("")
          setShowDeployment(false)
          setPasswordProtected(DEFAULT_PROJECT_WORK_REPORT_SHARE_PASSWORD_PROTECTED)
          setPassword("")
          setExpiresIn(DEFAULT_PROJECT_WORK_REPORT_SHARE_TTL)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Informe de Obra</DialogTitle>
          <DialogDescription>
            {panel === "menu"
              ? "Ver, descargar o compartir el informe de trabajos realizados."
              : "El cliente abre el enlace en Bespoke, sin usuario ni acceso a Operations."}
          </DialogDescription>
        </DialogHeader>

        {panel === "menu" ? (
          <>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Órdenes a incluir</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="project-work-report-scope"
                  className="size-3.5 accent-primary"
                  checked={taskScope === "all"}
                  disabled={busy}
                  onChange={() => setTaskScope("all")}
                />
                Todas las OT
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="project-work-report-scope"
                  className="size-3.5 accent-primary"
                  checked={taskScope === "completed"}
                  disabled={busy}
                  onChange={() => setTaskScope("completed")}
                />
                Solo OT finalizadas
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="project-work-report-scope"
                  className="size-3.5 accent-primary"
                  checked={taskScope === "selected"}
                  disabled={busy}
                  onChange={() => {
                    setTaskScope("selected")
                    if (selectedIds.length === 0) {
                      setSelectedIds(defaultProjectWorkReportSelectedTaskIds(tasks))
                    }
                  }}
                />
                Seleccionar OT
              </label>
            </fieldset>

            {taskScope === "selected" ? (
              <div className="space-y-2 rounded-md border p-3">
                <input
                  type="search"
                  value={otSearch}
                  disabled={busy}
                  placeholder="Buscar por código o nombre"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  onChange={(event) => setOtSearch(event.target.value)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    checked={showDeployment}
                    disabled={busy}
                    onChange={(event) => setShowDeployment(event.target.checked)}
                  />
                  Mostrar OT de despliegue
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      const visibleIds = pickerTasks.map((task) => task.id)
                      setSelectedIds((current) =>
                        [...new Set([...current, ...visibleIds])]
                      )
                    }}
                  >
                    Seleccionar todas
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      const visible = new Set(pickerTasks.map((task) => task.id))
                      setSelectedIds((current) =>
                        current.filter((id) => !visible.has(id))
                      )
                    }}
                  >
                    Deseleccionar todas
                  </Button>
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {pickerTasks.map((task) => {
                    const checked = selectedIds.includes(task.id)
                    const isDeployment = isProjectWorkReportDeploymentTask(task)
                    return (
                      <label
                        key={task.id}
                        className="flex items-start gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-3.5 accent-primary"
                          checked={checked}
                          disabled={busy}
                          onChange={(event) => {
                            const enabled = event.target.checked
                            setSelectedIds((current) =>
                              enabled
                                ? [...new Set([...current, task.id])]
                                : current.filter((id) => id !== task.id)
                            )
                          }}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium">
                            {task.code}
                            {isDeployment ? (
                              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Despliegue
                              </span>
                            ) : null}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {task.title || "Sin título"}
                            {" · "}
                            {TASK_STATUS_LABELS[task.status] ?? task.status}
                            {task.startDate
                              ? ` · ${formatDate(task.startDate)}`
                              : ""}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                  {pickerTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay órdenes para mostrar.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Las órdenes de despliegue se excluyen automáticamente.
              </p>
            )}

            <p className="text-sm text-muted-foreground">
              {tasksReady
                ? `${selectedCount} OT seleccionadas`
                : "Cargando órdenes de trabajo..."}
            </p>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-2">
              <Button asChild variant="default" disabled={!tasksReady || selectedCount === 0}>
                <Link href={informeHref}>Ver informe</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !tasksReady || selectedCount === 0}
                onClick={() => void handleExport()}
              >
                {generating ? "Generando PDF..." : "Descargar PDF"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  setPanel("share")
                }}
              >
                Compartir informe
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {shareLoading ? (
              <p className="text-sm text-muted-foreground">Cargando enlace...</p>
            ) : share?.active ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Informe compartido</p>
                  <p className="text-sm text-muted-foreground">Estado: Activo</p>
                  <p className="text-sm text-muted-foreground">
                    {share.isPasswordProtected
                      ? "Protegido por contraseña"
                      : "Sin contraseña"}
                    {share.expiresAt
                      ? ` · Vence ${new Date(share.expiresAt).toLocaleDateString("es-AR")}`
                      : " · Sin vencimiento"}
                  </p>
                </div>
                {share.url ? (
                  <p className="break-all rounded-md bg-muted px-3 py-2 text-xs">
                    {share.url}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Genere un nuevo enlace para copiarlo.
                  </p>
                )}
                <div className="grid gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !share.url}
                    onClick={() => void handleCopy()}
                  >
                    Copiar enlace
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void handleRevoke()}
                  >
                    Revocar
                  </Button>
                </div>
              </div>
            ) : null}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {share?.active ? "Generar nuevo enlace" : "Nuevo enlace"}
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-3.5 accent-primary"
                  checked={passwordProtected}
                  disabled={busy}
                  onChange={(event) =>
                    setPasswordProtected(event.target.checked)
                  }
                />
                Protegido por contraseña
              </label>
              {passwordProtected ? (
                <label className="block space-y-1 text-sm">
                  <span>Contraseña</span>
                  <input
                    type="text"
                    value={password}
                    disabled={busy}
                    placeholder="ABC123"
                    className="w-full rounded-md border bg-background px-3 py-2"
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
              ) : null}
              <label className="block space-y-1 text-sm">
                <span>Vencimiento</span>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2"
                  value={expiresIn}
                  disabled={busy}
                  onChange={(event) =>
                    setExpiresIn(event.target.value as ProjectWorkReportShareTtl)
                  }
                >
                  {PROJECT_WORK_REPORT_SHARE_TTL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>

            {copyState ? (
              <p className="text-sm text-muted-foreground">{copyState}</p>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void handleCreateShare(Boolean(share?.active))}
              >
                {share?.active ? "Generar nuevo enlace" : "Crear enlace"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={generating}
                onClick={() => {
                  setError(null)
                  setPanel("menu")
                }}
              >
                Volver
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
