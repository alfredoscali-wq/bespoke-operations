"use client"

import { useCallback, useEffect, useState } from "react"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function isFormStateDirty<T>(current: T, baseline: T): boolean {
  return JSON.stringify(current) !== JSON.stringify(baseline)
}

type UseProtectedFormDialogOptions = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDirty: boolean
}

export function useProtectedFormDialog({
  open,
  onOpenChange,
  isDirty,
}: UseProtectedFormDialogOptions) {
  const [discardOpen, setDiscardOpen] = useState(false)

  const requestClose = useCallback(() => {
    if (isDirty) {
      setDiscardOpen(true)
      return
    }

    onOpenChange(false)
  }, [isDirty, onOpenChange])

  const forceClose = useCallback(() => {
    setDiscardOpen(false)
    onOpenChange(false)
  }, [onOpenChange])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true)
        return
      }

      requestClose()
    },
    [onOpenChange, requestClose]
  )

  const confirmDiscard = useCallback(() => {
    setDiscardOpen(false)
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) {
      setDiscardOpen(false)
    }
  }, [open])

  return {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  }
}

type ProtectedFormDialogContentProps = React.ComponentProps<typeof DialogContent> & {
  onRequestClose: () => void
  isDirty: boolean
}

export function ProtectedFormDialogContent({
  onRequestClose,
  isDirty,
  children,
  className,
  ...props
}: ProtectedFormDialogContentProps) {
  return (
    <DialogContent
      className={className}
      showCloseButton={false}
      onPointerDownOutside={(event) => event.preventDefault()}
      onInteractOutside={(event) => event.preventDefault()}
      onEscapeKeyDown={(event) => {
        if (isDirty) {
          event.preventDefault()
          onRequestClose()
        }
      }}
      {...props}
    >
      {children}
      <Button
        type="button"
        variant="ghost"
        className="absolute top-2 right-2"
        size="icon-sm"
        onClick={onRequestClose}
      >
        <XIcon />
        <span className="sr-only">Cerrar</span>
      </Button>
    </DialogContent>
  )
}

type DiscardChangesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function DiscardChangesDialog({
  open,
  onOpenChange,
  onConfirm,
}: DiscardChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Descartar cambios</DialogTitle>
          <DialogDescription>
            Hay cambios sin guardar. Si cierra ahora, perderá la información
            ingresada.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Seguir editando
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Descartar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
