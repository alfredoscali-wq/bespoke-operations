"use client"

import { useMemo, useState } from "react"

import { ProjectWorkReportPhotoGrid } from "@/components/obras/project-work-report-photo-grid"
import type { ProjectWorkReportPhoto } from "@/lib/projects/work-report/types"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ProjectWorkReportPhotoGalleryProps = {
  photos: ProjectWorkReportPhoto[]
  hideCaptions?: boolean
}

export function ProjectWorkReportPhotoGallery({
  photos,
  hideCaptions = true,
}: ProjectWorkReportPhotoGalleryProps) {
  const visible = useMemo(
    () => photos.filter((photo) => Boolean(photo.url)),
    [photos]
  )
  const [index, setIndex] = useState<number | null>(null)
  const current = index != null ? visible[index] : null

  return (
    <>
      <ProjectWorkReportPhotoGrid
        photos={photos}
        hideCaptions={hideCaptions}
        onSelect={visible.length > 0 ? setIndex : undefined}
      />

      <Dialog
        open={index != null}
        onOpenChange={(open) => {
          if (!open) setIndex(null)
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Fotografía</DialogTitle>
          </DialogHeader>
          {current?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={current.description ?? "Fotografía"}
              className="max-h-[70vh] w-full rounded-md object-contain bg-black/5"
            />
          ) : null}
          <div className={cn("flex items-center justify-end text-sm")}>
            {visible.length > 1 ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-1"
                  onClick={() =>
                    setIndex((value) =>
                      value == null
                        ? 0
                        : (value + visible.length - 1) % visible.length
                    )
                  }
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="rounded-md border px-3 py-1"
                  onClick={() =>
                    setIndex((value) =>
                      value == null ? 0 : (value + 1) % visible.length
                    )
                  }
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
