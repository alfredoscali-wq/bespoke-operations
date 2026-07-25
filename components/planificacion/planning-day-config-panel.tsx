"use client"

import { useEffect, useState } from "react"

import type { PlanningDayOperationalConfig } from "@/lib/planificacion/planning-day-config"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type PlanningDayConfigPanelProps = {
  config: PlanningDayOperationalConfig
  crewName?: string | null
  readOnly?: boolean
  onChange: (next: {
    useHabitual: boolean
    operationalBaseName: string
    startTime: string
    availableMinutes: number
  }) => void
  className?: string
}

export function PlanningDayConfigPanel({
  config,
  crewName,
  readOnly = false,
  onChange,
  className,
}: PlanningDayConfigPanelProps) {
  const [useHabitual, setUseHabitual] = useState(config.useHabitual)
  const [baseName, setBaseName] = useState(config.operationalBaseName)
  const [startTime, setStartTime] = useState(config.startTime)
  const [duration, setDuration] = useState(String(config.availableMinutes))

  useEffect(() => {
    setUseHabitual(config.useHabitual)
    setBaseName(config.operationalBaseName)
    setStartTime(config.startTime)
    setDuration(String(config.availableMinutes))
  }, [config])

  function commit(next: {
    useHabitual: boolean
    operationalBaseName: string
    startTime: string
    availableMinutes: number
  }) {
    onChange(next)
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
            commit({
              useHabitual: nextUse,
              operationalBaseName: baseName,
              startTime,
              availableMinutes: Number.parseInt(duration, 10) || config.availableMinutes,
            })
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
            Base Operativa
          </Label>
          <Input
            id="planning-day-base"
            value={baseName}
            disabled={readOnly || useHabitual}
            onChange={(event) => setBaseName(event.target.value)}
            onBlur={() =>
              commit({
                useHabitual,
                operationalBaseName: baseName,
                startTime,
                availableMinutes:
                  Number.parseInt(duration, 10) || config.availableMinutes,
              })
            }
            className="h-8 text-[13px]"
          />
        </div>
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
              onBlur={() =>
                commit({
                  useHabitual,
                  operationalBaseName: baseName,
                  startTime,
                  availableMinutes:
                    Number.parseInt(duration, 10) || config.availableMinutes,
                })
              }
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
                commit({
                  useHabitual,
                  operationalBaseName: baseName,
                  startTime,
                  availableMinutes: nextMinutes,
                })
              }}
              className="h-8 text-[13px]"
            />
          </div>
        </div>
      </div>

      {config.operationalBase ? (
        <p className="mt-3 text-[11px] leading-snug text-slate-500">
          GPS base: {config.operationalBase.latitude.toFixed(5)},{" "}
          {config.operationalBase.longitude.toFixed(5)}
        </p>
      ) : (
        <p className="mt-3 text-[11px] leading-snug text-amber-700">
          Sin coordenadas de base en la cuadrilla (requeridas para OPS 2.3).
        </p>
      )}
    </aside>
  )
}
