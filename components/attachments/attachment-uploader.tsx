"use client"

import { useRef, useState } from "react"
import { Paperclip, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatAttachmentFileSize } from "@/lib/attachments/format"

export type StagedAttachmentFile = {
  key: string
  file: File
}

type AttachmentUploaderProps = {
  files: StagedAttachmentFile[]
  onChange: (files: StagedAttachmentFile[]) => void
  disabled?: boolean
  className?: string
}

function createStagedFile(file: File): StagedAttachmentFile {
  return {
    key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
    file,
  }
}

export function AttachmentUploader({
  files,
  onChange,
  disabled = false,
  className,
}: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function addFiles(list: FileList | File[]) {
    const next = [...files]
    for (const file of Array.from(list)) {
      next.push(createStagedFile(file))
    }
    onChange(next)
  }

  function removeFile(key: string) {
    onChange(files.filter((item) => item.key !== key))
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "rounded-md border border-dashed px-3 py-3 transition-colors",
          isDragging ? "border-sky-500 bg-sky-50/70" : "border-slate-300 bg-white",
          disabled && "opacity-60"
        )}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setIsDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          if (disabled || !event.dataTransfer.files?.length) return
          addFiles(event.dataTransfer.files)
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="gap-1.5"
          >
            <Upload className="size-3.5" aria-hidden />
            + Agregar archivo
          </Button>
          <p className="text-[12px] text-muted-foreground">
            Arrastrá archivos o seleccioná varios a la vez.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            if (event.target.files?.length) {
              addFiles(event.target.files)
            }
            event.target.value = ""
          }}
        />
      </div>

      {files.length > 0 ? (
        <ul className="space-y-1.5">
          {files.map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-1.5"
            >
              <Paperclip className="size-3.5 shrink-0 text-slate-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-slate-800">{item.file.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatAttachmentFileSize(item.file.size)}
                </p>
              </div>
              <button
                type="button"
                className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50"
                disabled={disabled}
                aria-label={`Quitar ${item.file.name}`}
                onClick={() => removeFile(item.key)}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
