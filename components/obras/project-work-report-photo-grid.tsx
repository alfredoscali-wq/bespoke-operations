import type { ProjectWorkReportPhoto } from "@/lib/projects/work-report/types"

type ProjectWorkReportPhotoGridProps = {
  photos: ProjectWorkReportPhoto[]
  hideCaptions?: boolean
  onSelect?: (index: number) => void
}

export function ProjectWorkReportPhotoGrid({
  photos,
  hideCaptions = true,
  onSelect,
}: ProjectWorkReportPhotoGridProps) {
  const visible = photos.filter((photo) => Boolean(photo.url))

  if (photos.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        Sin evidencia fotográfica registrada.
      </p>
    )
  }

  if (visible.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        Hay evidencias registradas, pero no se pudieron cargar las fotografías.
      </p>
    )
  }

  return (
    <div className="pwr-gallery grid grid-cols-2 gap-3 sm:grid-cols-3">
      {visible.map((photo, photoIndex) => {
        const image = (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url ?? ""}
              alt={photo.description ?? "Fotografía"}
              className="aspect-[4/3] w-full object-cover"
            />
            {!hideCaptions && photo.description ? (
              <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                {photo.description}
              </p>
            ) : null}
          </>
        )

        if (!onSelect) {
          return (
            <div
              key={`${photo.url}-${photoIndex}`}
              className="overflow-hidden rounded-lg border bg-muted"
            >
              {image}
            </div>
          )
        }

        return (
          <button
            key={`${photo.url}-${photoIndex}`}
            type="button"
            className="overflow-hidden rounded-lg border bg-muted text-left"
            onClick={() => onSelect(photoIndex)}
          >
            {image}
          </button>
        )
      })}
    </div>
  )
}
