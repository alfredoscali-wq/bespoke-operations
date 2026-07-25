"use client"

import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { useState, useSyncExternalStore } from "react"

import type { PlanningDayOperationalConfig } from "@/lib/planificacion/planning-day-config"
import {
  OperationalBaseMapPicker,
  type OperationalBaseLocationValue,
} from "@/components/location/operational-base-map-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const DAY_CONFIG_EXPANDED_SESSION_KEY =
  "bespoke.planning.day-config-panel-expanded"
const DAY_CONFIG_EXPANDED_EVENT = "bespoke-planning-day-config-expanded"

type PlanningDayConfigPanelProps = {
  config: PlanningDayOperationalConfig
  crewName?: string | null
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

function readExpandedPreference(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  try {
    return window.sessionStorage.getItem(DAY_CONFIG_EXPANDED_SESSION_KEY) === "1"
  } catch {
    return false
  }
}

function writeExpandedPreference(expanded: boolean): void {
  if (typeof window === "undefined") {
    return
  }
  try {
    window.sessionStorage.setItem(
      DAY_CONFIG_EXPANDED_SESSION_KEY,
      expanded ? "1" : "0"
    )
    window.dispatchEvent(new Event(DAY_CONFIG_EXPANDED_EVENT))
  } catch {
    // ignore
  }
}

function subscribeExpandedPreference(onStoreChange: () => void): () => void {
  window.addEventListener(DAY_CONFIG_EXPANDED_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(DAY_CONFIG_EXPANDED_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

function locationFromConfig(
  config: PlanningDayOperationalConfig
): OperationalBaseLocationValue {
  return {
    address: config.operationalBaseAddress ?? "",
    sharedLocation: "",
    latitude: config.operationalBase?.latitude ?? null,
    longitude: config.operationalBase?.longitude ?? null,
  }
}

export function PlanningDayConfigPanel({
  config,
  crewName,
  configureBaseHref,
  readOnly = false,
  onChange,
  className,
}: PlanningDayConfigPanelProps) {
  const expanded = useSyncExternalStore(
    subscribeExpandedPreference,
    readExpandedPreference,
    () => false
  )
  const [useHabitual, setUseHabitual] = useState(config.useHabitual)
  const [baseName, setBaseName] = useState(config.operationalBaseName)
  const [startTime, setStartTime] = useState(config.startTime)
  const [duration, setDuration] = useState(String(config.availableMinutes))
  const [location, setLocation] = useState(() => locationFromConfig(config))
  const [syncedConfig, setSyncedConfig] = useState(config)

  if (config !== syncedConfig) {
    setSyncedConfig(config)
    setUseHabitual(config.useHabitual)
    setBaseName(config.operationalBaseName)
    setStartTime(config.startTime)
    setDuration(String(config.availableMinutes))
    setLocation(locationFromConfig(config))
  }

  function toggleExpanded() {
    writeExpandedPreference(!expanded)
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

    onChange({
      useHabitual: nextUse,
      operationalBaseName: nextName,
      operationalBaseAddress: nextLocation.address.trim() || null,
      operationalBaseLatitude: nextLocation.latitude,
      operationalBaseLongitude: nextLocation.longitude,
      startTime: nextStart,
      availableMinutes: nextMinutes,
    })
  }

  const collapsedHint = useHabitual
    ? `Habitual · ${config.startTime} · ${config.availableMinutes} min`
    : `Override · ${config.operationalBaseName}`

  return (
    <aside
      className={cn(
        "rounded-xl border border-slate-200 bg-card px-3 py-2 shadow-sm",
        className
      )}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full items-start gap-2 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold text-slate-900">
            Configuración de Jornada
          </h3>
          {crewName ? (
            <p className="text-[11px] text-slate-500">{crewName}</p>
          ) : null}
          {!expanded ? (
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {collapsedHint}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-slate-500 transition-transform duration-200",
            expanded && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <label className="flex cursor-pointer items-start gap-2 text-[12px] text-slate-700">
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
              <span className="mt-0.5 block text-[10px] text-slate-500">
                Solo esta jornada; no modifica la cuadrilla.
              </span>
            </span>
          </label>

          <div
            className={cn(
              "mt-2 space-y-2",
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
                onBlur={() =>
                  commitFromState({ operationalBaseName: baseName })
                }
                className="h-7 text-[12px]"
              />
            </div>

            <div className="[&_[role=application]]:h-36">
              <OperationalBaseMapPicker
                idPrefix="planning-day-base-map"
                readOnly={readOnly || useHabitual}
                value={location}
                onChange={(next) => {
                  setLocation(next)
                  commitFromState({ location: next })
                }}
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
                  onBlur={() => commitFromState({ startTime })}
                  className="h-7 text-[12px]"
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
                  className="h-7 text-[12px]"
                />
              </div>
            </div>
          </div>

          {!config.operationalBase ? (
            <div className="mt-2 space-y-1.5">
              <p
                className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-900"
                role="status"
              >
                La Base Operativa no tiene coordenadas GPS.
              </p>
              {configureBaseHref ? (
                <Link
                  href={configureBaseHref}
                  className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-800 hover:bg-slate-50"
                >
                  Configurar Base Operativa
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
