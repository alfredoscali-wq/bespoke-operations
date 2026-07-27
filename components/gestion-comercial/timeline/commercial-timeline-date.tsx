"use client"

type CommercialTimelineDateProps = {
  label: string
}

export function CommercialTimelineDate({ label }: CommercialTimelineDateProps) {
  return (
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {label}
    </h3>
  )
}
