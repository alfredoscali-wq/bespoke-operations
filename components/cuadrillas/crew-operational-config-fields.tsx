"use client"

import {
  CREW_DEFAULT_HABITUAL_START_TIME,
} from "@/lib/crews/operational-config"
import { PLANNING_DEFAULT_AVAILABLE_MINUTES } from "@/lib/planificacion/planning-duration"
import {
  OperationalBaseMapPicker,
  type OperationalBaseLocationValue,
} from "@/components/location/operational-base-map-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type CrewOperationalFormFields = {
  operationalBaseName: string
  operationalBaseAddress: string
  operationalBaseSharedLocation: string
  operationalBaseLatitude: string
  operationalBaseLongitude: string
  habitualStartTime: string
  habitualShiftMinutes: string
}

export const EMPTY_CREW_OPERATIONAL_FORM: CrewOperationalFormFields = {
  operationalBaseName: "",
  operationalBaseAddress: "",
  operationalBaseSharedLocation: "",
  operationalBaseLatitude: "",
  operationalBaseLongitude: "",
  habitualStartTime: CREW_DEFAULT_HABITUAL_START_TIME,
  habitualShiftMinutes: String(PLANNING_DEFAULT_AVAILABLE_MINUTES),
}

type CrewOperationalConfigFieldsProps = {
  value: CrewOperationalFormFields
  onChange: (next: CrewOperationalFormFields) => void
  idPrefix?: string
  readOnly?: boolean
}

export function CrewOperationalConfigFields({
  value,
  onChange,
  idPrefix = "crew-ops",
  readOnly = false,
}: CrewOperationalConfigFieldsProps) {
  function updateLocation(next: OperationalBaseLocationValue) {
    onChange({
      ...value,
      operationalBaseAddress: next.address,
      operationalBaseSharedLocation: next.sharedLocation,
      operationalBaseLatitude:
        next.latitude != null ? String(next.latitude) : "",
      operationalBaseLongitude:
        next.longitude != null ? String(next.longitude) : "",
    })
  }

  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <legend className="px-1 text-[13px] font-semibold text-slate-900">
        Configuración Operativa
      </legend>
      <p className="text-[12px] leading-snug text-slate-500">
        Base Operativa y valores habituales de la cuadrilla. La planificación
        los usa como predeterminados; el override diario no los modifica.
      </p>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-base-name`}>Nombre de Base Operativa</Label>
        <Input
          id={`${idPrefix}-base-name`}
          value={value.operationalBaseName}
          disabled={readOnly}
          onChange={(event) =>
            onChange({
              ...value,
              operationalBaseName: event.target.value,
            })
          }
          placeholder="Ej. Depósito Norte"
        />
      </div>

      <OperationalBaseMapPicker
        idPrefix={`${idPrefix}-map`}
        readOnly={readOnly}
        value={{
          address: value.operationalBaseAddress,
          sharedLocation: value.operationalBaseSharedLocation,
          latitude: value.operationalBaseLatitude
            ? Number.parseFloat(value.operationalBaseLatitude)
            : null,
          longitude: value.operationalBaseLongitude
            ? Number.parseFloat(value.operationalBaseLongitude)
            : null,
        }}
        onChange={updateLocation}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-start`}>Hora habitual de inicio</Label>
          <Input
            id={`${idPrefix}-start`}
            type="time"
            value={value.habitualStartTime}
            disabled={readOnly}
            onChange={(event) =>
              onChange({
                ...value,
                habitualStartTime: event.target.value,
              })
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
            disabled={readOnly}
            onChange={(event) =>
              onChange({
                ...value,
                habitualShiftMinutes: event.target.value,
              })
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
  operationalBaseAddress: string | null
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
    operationalBaseAddress: fields.operationalBaseAddress.trim() || null,
    operationalBaseLatitude: latRaw ? Number.parseFloat(latRaw) : null,
    operationalBaseLongitude: lngRaw ? Number.parseFloat(lngRaw) : null,
    habitualStartTime: fields.habitualStartTime.trim() || null,
    habitualShiftMinutes: durationRaw
      ? Number.parseInt(durationRaw, 10)
      : null,
  }
}
