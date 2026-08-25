"use client"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { IspActivityTimeline } from "@/components/isp/isp-activity-timeline"
import type { IspActivityEvent } from "@/lib/isp/types"

export function IspSubscriberHistorySheet({
  open,
  events,
  onClose,
}: {
  open: boolean
  events: IspActivityEvent[]
  onClose: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto sm:max-w-lg data-[side=right]:sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>Historial del abonado</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-2 px-4 pb-4 text-sm">
          <IspActivityTimeline
            events={events}
            emptyTitle="Todavía no hay actividad registrada para este abonado."
          />
        </div>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
