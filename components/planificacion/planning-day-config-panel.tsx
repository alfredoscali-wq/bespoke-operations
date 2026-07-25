"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import type { PlanningDayOperationalConfig } from "@/lib/planificacion/planning-day-config"
import {
  OperationalBaseMapPicker,
  type OperationalBaseLocationValue,
} from "@/components/location/operational-base-map-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type PlanningDayConfigPanelProps = {
  config: PlanningDayOperationalConfig
  crewName?: string | null
  /** Prepared navigation to crew config (OPS 2.3C map UX). */
  configureBaseHref?: string | null
  readOnly?: boolean
  onChange: (next: {
    useHabitual: boolean
    operationalBaseName: string
    operationalBaseAddress: string | null
    operationalBaseLatitude: number | null
    operationalBaseLongitude: number | null
    startTime: string
    availableMinutes: number
  }) => void
  className?: string
}

export function PlanningDayConfigPanel({
  config,
  crewName,
  configureBaseHref,
  readOnly = false,
  onChange,
  className,
}: PlanningDayConfigPanelProps) {
  const [useHabitual, setUseHabitual] = useState(config.useHabitual)
  const [baseName, setBaseName] = useState(config.operationalBaseName)
  const [startTime, setStartTime] = useState(config.startTime)
  const [duration, setDuration] = useState(String(config.availableMinutes))
  const [location, setLocation] = useState<OperationalBaseLocationValue>({
    address: config.operationalBaseAddress ?? "",
    sharedLocation: "",
    latitude: config.operationalBase?.latitude ?? null,
    longitude: config.operationalBase?.longitude ?? null,
  })

  useEffect(() => {
    setUseHabitual(config.useHabitual)
    setBaseName(config.operationalBaseName)
    setStartTime(config.startTime)
    setDuration(String(config.availableMinutes))
    setLocation({
      address: config.operationalBaseAddress ?? "",
      sharedLocation: "",
      latitude: config.operationalBase?.latitude ?? null,
      longitude: config.operationalBase?.longitude ?? null,
    })
  }, [config])

  function commit(next: {
    useHabitual: boolean
    operationalBaseName: string
    operationalBaseAddress: string | null
    operationalBaseLatitude: number | null
    operationalBaseLongitude: number | null
    startTime: string
    availableMinutes: number
  }) {
    onChange(next)
  }

  function commitFromState(partial?: {
    useHabitual?: boolean
    operationalBaseName?: string
    location?: OperationalBaseLocationValue
    startTime?: string
    availableMinutes?: number
  }) {
    const nextUse = partial?.useHabitual ?? useHabitual
    const nextName = partial?.operationalBaseName ?? baseName
    const nextLocation = partial?.location ?? location
    const nextStart = partial?.startTime ?? startTime
    const nextMinutes =
      partial?.availableMinutes ??
      (Number.parseInt(duration, 10) || config.availableMinutes)

    commit({
      useHabitual: nextUse,
      operationalBaseName: nextName,
      operationalBaseAddress: nextLocation.address.trim() || null,
      operationalBaseLatitude: nextLocation.latitude,
      operationalBaseLongitude: nextLocation.longitude,
      startTime: nextStart,
      availableMinutes: nextMinutes,
    })
  }

  return (
    <aside
      className={cn(
        "rounded-xl border border-slate-200 bg-card px-4 py-3 shadow-sm",
        className
      )}
    >
      <h3 className="text-[13px] font-semibold text-slate-900">
        Configuración de Jornada
      </h3>
      {crewName ? (
        <p className="mt-0.5 text-[12px] text-slate-500">{crewName}</p>
      ) : null}

      <label className="mt-3 flex cursor-pointer items-start gap-2 text-[12px] text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5 size-3.5 accent-sky-600"
          checked={useHabitual}
          disabled={readOnly}
          onChange={(event) => {
            const nextUse = event.target.checked
            setUseHabitual(nextUse)
            commitFromState({ useHabitual: nextUse })
          }}
        />
        <span>
          Usar configuración habitual
          <span className="mt-0.5 block text-[11px] text-slate-500">
            Los cambios aplican solo a esta jornada; no modifican la cuadrilla.
          </span>
        </span>
      </label>

      <div
        className={cn(
          "mt-3 space-y-2.5",
          useHabitual && "pointer-events-none opacity-60"
        )}
      >
        <div className="space-y-1">
          <Label htmlFor="planning-day-base" className="text-[11px]">
            Nombre de Base
          </Label>
          <Input
            id="planning-day-base"
            value={baseName}
            disabled={readOnly || useHabitual}
            onChange={(event) => setBaseName(event.target.value)}
            onBlur={() => commitFromState({ operationalBaseName: baseName })}
            className="h-8 text-[13px]"
          />
        </div>

        <OperationalBaseMapPicker
          idPrefix="planning-day-base-map"
          readOnly={readOnly || useHabitual}
          value={location}
          onChange={(next) => {
            setLocation(next)
            commitFromState({ location: next })
          }}
        />

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="planning-day-start" className="text-[11px]">
              Hora de inicio
            </Label>
            <Input
              id="planning-day-start"
              type="time"
              value={startTime}
              disabled={readOnly || useHabitual}
              onChange={(event) => setStartTime(event.target.value)}
              onBlur={() => commitFromState({ startTime })}
              className="h-8 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="planning-day-duration" className="text-[11px]">
              Duración (min)
            </Label>
            <Input
              id="planning-day-duration"
              type="number"
              min={1}
              step={1}
              value={duration}
              disabled={readOnly || useHabitual}
              onChange={(event) => setDuration(event.target.value)}
              onBlur={() => {
                const parsed = Number.parseInt(duration, 10)
                const nextMinutes =
                  Number.isFinite(parsed) && parsed > 0
                    ? parsed
                    : config.availableMinutes
                setDuration(String(nextMinutes))
                commitFromState({ availableMinutes: nextMinutes })
              }}
              className="h-8 text-[13px]"
            />
          </div>
        </div>
      </div>

      {!config.operationalBase ? (
        <div className="mt-3 space-y-2">
          <p
            className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-900"
            role="status"
          >
            La Base Operativa no tiene coordenadas GPS. Los traslados Base↔OT
            no se calculan automáticamente.
          </p>
          {configureBaseHref ? (
            <Link
              href={configureBaseHref}
              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-800 hover:bg-slate-50"
            >
              Configurar Base Operativa
            </Link>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
