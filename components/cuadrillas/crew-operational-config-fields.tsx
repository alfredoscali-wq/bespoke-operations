"use client"

import {
  CREW_DEFAULT_HABITUAL_START_TIME,
} from "@/lib/crews/operational-config"
import { PLANNING_DEFAULT_AVAILABLE_MINUTES } from "@/lib/planificacion/planning-duration"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type CrewOperationalFormFields = {
  operationalBaseName: string
  operationalBaseLatitude: string
  operationalBaseLongitude: string
  habitualStartTime: string
  habitualShiftMinutes: string
}

export const EMPTY_CREW_OPERATIONAL_FORM: CrewOperationalFormFields = {
  operationalBaseName: "",
  operationalBaseLatitude: "",
  operationalBaseLongitude: "",
  habitualStartTime: CREW_DEFAULT_HABITUAL_START_TIME,
  habitualShiftMinutes: String(PLANNING_DEFAULT_AVAILABLE_MINUTES),
}

type CrewOperationalConfigFieldsProps = {
  value: CrewOperationalFormFields
  onChange: (next: CrewOperationalFormFields) => void
  idPrefix?: string
}

export function CrewOperationalConfigFields({
  value,
  onChange,
  idPrefix = "crew-ops",
}: CrewOperationalConfigFieldsProps) {
  function update<K extends keyof CrewOperationalFormFields>(
    key: K,
    next: CrewOperationalFormFields[K]
  ) {
    onChange({ ...value, [key]: next })
  }

  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <legend className="px-1 text-[13px] font-semibold text-slate-900">
        Configuración Operativa
      </legend>
      <p className="text-[12px] leading-snug text-slate-500">
        Valores habituales de la cuadrilla. La planificación los usa como
        predeterminados sin modificarlos desde la jornada.
      </p>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-base-name`}>Nombre de Base Operativa</Label>
        <Input
          id={`${idPrefix}-base-name`}
          value={value.operationalBaseName}
          onChange={(event) =>
            update("operationalBaseName", event.target.value)
          }
          placeholder='Ej. Córdoba Capital'
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-lat`}>Latitud</Label>
          <Input
            id={`${idPrefix}-lat`}
            type="number"
            step="any"
            value={value.operationalBaseLatitude}
            onChange={(event) =>
              update("operationalBaseLatitude", event.target.value)
            }
            placeholder="-31.4201"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-lng`}>Longitud</Label>
          <Input
            id={`${idPrefix}-lng`}
            type="number"
            step="any"
            value={value.operationalBaseLongitude}
            onChange={(event) =>
              update("operationalBaseLongitude", event.target.value)
            }
            placeholder="-64.1888"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-start`}>Hora habitual de inicio</Label>
          <Input
            id={`${idPrefix}-start`}
            type="time"
            value={value.habitualStartTime}
            onChange={(event) =>
              update("habitualStartTime", event.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-duration`}>
            Duración habitual de jornada (min)
          </Label>
          <Input
            id={`${idPrefix}-duration`}
            type="number"
            min={1}
            step={1}
            value={value.habitualShiftMinutes}
            onChange={(event) =>
              update("habitualShiftMinutes", event.target.value)
            }
            placeholder="480"
          />
        </div>
      </div>
    </fieldset>
  )
}

export function parseCrewOperationalFormFields(
  fields: CrewOperationalFormFields
): {
  operationalBaseName: string | null
  operationalBaseLatitude: number | null
  operationalBaseLongitude: number | null
  habitualStartTime: string | null
  habitualShiftMinutes: number | null
} {
  const latRaw = fields.operationalBaseLatitude.trim()
  const lngRaw = fields.operationalBaseLongitude.trim()
  const durationRaw = fields.habitualShiftMinutes.trim()

  return {
    operationalBaseName: fields.operationalBaseName.trim() || null,
    operationalBaseLatitude: latRaw
      ? Number.parseFloat(latRaw)
      : null,
    operationalBaseLongitude: lngRaw
      ? Number.parseFloat(lngRaw)
      : null,
    habitualStartTime: fields.habitualStartTime.trim() || null,
    habitualShiftMinutes: durationRaw
      ? Number.parseInt(durationRaw, 10)
      : null,
  }
}
