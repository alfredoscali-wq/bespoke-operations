import "server-only"

import fs from "node:fs"
import path from "node:path"

import type { SupabaseClient } from "@supabase/supabase-js"

import { fetchCompanyBranding } from "@/lib/supabase/company-branding.queries"
import type { Database } from "@/lib/supabase/database.types"
import { mapProjectRowToProject } from "@/lib/supabase/projects.mapper"
import { fetchLiveTaskPhotosForTaskIds } from "@/lib/supabase/task-photos.queries"
import { TASK_PHOTOS_STORAGE_BUCKET } from "@/lib/supabase/task-photos.storage"
import { fetchProjectWorkOrderListTasks } from "@/lib/supabase/tasks.queries"
import type { TaskPhoto } from "@/lib/types/task-photos"

import { buildProjectWorkReportData } from "@/lib/projects/work-report/build-report-data"
import {
  buildProjectWorkReportFileName,
  type ProjectWorkReportOptions,
} from "@/lib/projects/work-report/options"
import type { ProjectWorkReportPhotoInput } from "@/lib/projects/work-report/photos"
import { selectProjectWorkReportTasks } from "@/lib/projects/work-report/select-tasks"
import type { ProjectWorkReport } from "@/lib/projects/work-report/types"

const IMAGE_FETCH_CONCURRENCY = 6

export const PROJECT_WORK_REPORT_EMPTY_MESSAGE =
  "No hay órdenes de trabajo para el filtro seleccionado."
export const PROJECT_WORK_REPORT_LOAD_ERROR =
  "No se pudo generar el informe de la obra."

export type ProjectWorkReportPhotoMode = "signed-url" | "embed"

export type ProjectWorkReportLoadResult =
  | {
      ok: true
      report: ProjectWorkReport
      fileName: string
    }
  | { ok: false; status: 400 | 404 | 500; message: string }

function loadFallbackLogoDataUrl(): string | null {
  try {
    const buffer = fs.readFileSync(
      path.join(process.cwd(), "public", "images", "logo", "LOGO_BESPOKE.png")
    )
    return `data:image/png;base64,${buffer.toString("base64")}`
  } catch {
    return null
  }
}

function mimeFromPathOrType(value?: string | null): string {
  const lower = (value ?? "").toLowerCase()
  if (lower.includes("png")) return "image/png"
  if (lower.includes("webp")) return "image/webp"
  return "image/jpeg"
}

function bufferToDataUrl(bytes: ArrayBuffer | Buffer, mimeType: string): string {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  return `data:${mimeType};base64,${buffer.toString("base64")}`
}

async function fetchUrlAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const mime = mimeFromPathOrType(response.headers.get("content-type") ?? url)
    return bufferToDataUrl(await response.arrayBuffer(), mime)
  } catch {
    return null
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index])
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, Math.max(items.length, 1)) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}

async function resolvePhotoImage(
  client: SupabaseClient<Database>,
  photo: TaskPhoto
): Promise<string | null> {
  const storagePath =
    photo.fileUrl && !/^https?:\/\//i.test(photo.fileUrl)
      ? photo.fileUrl
      : undefined

  if (storagePath) {
    try {
      const transformed = await client.storage
        .from(TASK_PHOTOS_STORAGE_BUCKET)
        .download(storagePath, {
          transform: {
            width: 1400,
            height: 1400,
            resize: "contain",
            quality: 72,
          },
        })
      if (!transformed.error && transformed.data) {
        const mime = mimeFromPathOrType(transformed.data.type || storagePath)
        return bufferToDataUrl(await transformed.data.arrayBuffer(), mime)
      }
    } catch {
      // Transformations may be unavailable; fall back to the original object.
    }
  }

  if (photo.signedUrl) {
    const fromSigned = await fetchUrlAsDataUrl(photo.signedUrl)
    if (fromSigned) {
      return fromSigned
    }
  }

  if (!storagePath) {
    return null
  }

  try {
    const downloaded = await client.storage
      .from(TASK_PHOTOS_STORAGE_BUCKET)
      .download(storagePath)
    if (downloaded.error || !downloaded.data) {
      return null
    }
    const mime = mimeFromPathOrType(downloaded.data.type || storagePath)
    return bufferToDataUrl(await downloaded.data.arrayBuffer(), mime)
  } catch {
    return null
  }
}

export async function loadProjectWorkReport(input: {
  client: SupabaseClient<Database>
  companyId: string
  projectId: string
  options: ProjectWorkReportOptions
  photoMode?: ProjectWorkReportPhotoMode
}): Promise<ProjectWorkReportLoadResult> {
  const photoMode = input.photoMode ?? "signed-url"

  const projectQuery = await input.client
    .from("projects")
    .select("*")
    .eq("id", input.projectId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (projectQuery.error || !projectQuery.data) {
    return {
      ok: false,
      status: 404,
      message: "Obra no encontrada.",
    }
  }

  const project = mapProjectRowToProject(projectQuery.data)

  const tasksResult = await fetchProjectWorkOrderListTasks(
    input.client,
    input.companyId,
    project.id
  )

  if (tasksResult.error || !tasksResult.data) {
    return {
      ok: false,
      status: 500,
      message: tasksResult.error?.message ?? PROJECT_WORK_REPORT_LOAD_ERROR,
    }
  }

  const tasks = tasksResult.data.map((task) => ({
    ...task,
    companyId: input.companyId,
    deletedAt: null,
  }))

  const selected = selectProjectWorkReportTasks(
    tasks,
    input.companyId,
    project.id,
    input.options.taskScope,
    input.options.selectedTaskIds ?? []
  )
  const candidateIds = selected.map((task) => task.id)

  const photosResult = await fetchLiveTaskPhotosForTaskIds(
    input.client,
    input.companyId,
    candidateIds
  )

  if (photosResult.error) {
    return {
      ok: false,
      status: 500,
      message: photosResult.error.message,
    }
  }

  const photosWithImages = await mapWithConcurrency(
    photosResult.data ?? [],
    IMAGE_FETCH_CONCURRENCY,
    async (photo): Promise<ProjectWorkReportPhotoInput> => ({
      taskId: photo.taskId,
      description: photo.description,
      createdAt: photo.createdAt,
      signedUrl: photo.signedUrl,
      imageDataUrl:
        photoMode === "embed"
          ? await resolvePhotoImage(input.client, photo)
          : null,
    })
  )

  const branding = await fetchCompanyBranding(input.client, input.companyId)
  const fallbackLogo = loadFallbackLogoDataUrl()
  const logoDataUrl =
    photoMode === "embed"
      ? ((branding?.logoUrl
          ? await fetchUrlAsDataUrl(branding.logoUrl)
          : null) ?? fallbackLogo)
      : null
  const logoUrl =
    photoMode === "embed"
      ? logoDataUrl
      : (branding?.logoUrl ?? fallbackLogo)

  const report = buildProjectWorkReportData({
    companyId: input.companyId,
    project,
    tasks,
    photos: photosWithImages,
    taskScope: input.options.taskScope,
    selectedTaskIds: input.options.selectedTaskIds,
    branding: {
      logoUrl,
      logoDataUrl,
      primaryColor: branding?.primaryColor,
      secondaryColor: branding?.secondaryColor,
    },
  })

  return {
    ok: true,
    report,
    fileName: buildProjectWorkReportFileName(project.code),
  }
}
