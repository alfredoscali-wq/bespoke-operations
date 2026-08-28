"use client"

import type { ReactNode } from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type MaterialsSheetShellProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  footer: ReactNode
  children: ReactNode
}

export function MaterialsSheetShell({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: MaterialsSheetShellProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full max-h-[100dvh] w-full flex-col overflow-hidden p-0 sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 space-y-1 border-b px-6 py-4">
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
          {children}
        </div>

        <div className="shrink-0 border-t bg-background px-6 py-4">
          {footer}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function FormSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export const MaterialsFormSection = FormSection
