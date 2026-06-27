"use client"

import {
  DEMO_RESTRICTED_DIALOG_ACCEPT,
  DEMO_RESTRICTED_DIALOG_MESSAGE,
  DEMO_RESTRICTED_DIALOG_TITLE,
} from "@/lib/demo/constants"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type DemoRestrictedDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DemoRestrictedDialog({
  open,
  onOpenChange,
}: DemoRestrictedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{DEMO_RESTRICTED_DIALOG_TITLE}</DialogTitle>
          <DialogDescription className="whitespace-pre-line pt-1 text-sm leading-relaxed">
            {DEMO_RESTRICTED_DIALOG_MESSAGE}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {DEMO_RESTRICTED_DIALOG_ACCEPT}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
