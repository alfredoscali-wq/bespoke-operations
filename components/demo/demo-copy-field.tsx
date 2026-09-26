"use client"

import { useState } from "react"

export function DemoCopyField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  const [copied, setCopied] = useState(false)
  const canCopy = value.length > 0

  async function copyValue() {
    if (!canCopy) {
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5A7188]">
          {label}
        </p>
        <p className="mt-1 truncate font-mono text-base font-semibold text-[#12324D]">
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void copyValue()}
        disabled={!canCopy}
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-[#D7E4EC] bg-white px-3.5 text-xs font-semibold text-[#12324D] shadow-sm transition hover:border-[#FF6E3D] hover:text-[#FF6E3D] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  )
}
