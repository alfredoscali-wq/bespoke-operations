"use client"

import type { ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { IspTechnicalProfile } from "@/lib/isp/catalog-types"
import {
  ISP_CORE_NOT_CONNECTED_MESSAGE,
  ISP_TECHNICAL_STATUSES,
  type IspConnectionType,
} from "@/lib/isp/constants"
import { connectionFieldsForType } from "@/lib/isp/integrity"
import {
  ISP_CONNECTION_TYPE_LABELS,
  ISP_TECHNICAL_STATUS_LABELS,
} from "@/lib/isp/labels"
import { compatibleTechnicalProfiles } from "@/lib/isp/subscriber-service-integrity"
import type { IspConnectionDraft } from "@/lib/isp/types"

export function IspConnectionFields({
  draft,
  onChange,
  allowedTypes,
  profiles,
  inheritedDownload,
  inheritedUpload,
  inheritedPair,
  passwordPlaceholder,
  allowTechnicalStatus,
  disabled,
}: {
  draft: IspConnectionDraft
  onChange: (next: IspConnectionDraft) => void
  allowedTypes: IspConnectionType[]
  profiles: IspTechnicalProfile[]
  inheritedDownload: string
  inheritedUpload: string
  inheritedPair?: string
  passwordPlaceholder?: string
  allowTechnicalStatus?: boolean
  disabled?: boolean
}) {
  const fields = connectionFieldsForType(draft.connectionType)
  const compatible = compatibleTechnicalProfiles(profiles, draft.connectionType)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Tipo de conexión">
        <Select
          value={draft.connectionType || undefined}
          disabled={disabled}
          onValueChange={(value) => {
            const nextType = value as IspConnectionType
            const stillValid = compatibleTechnicalProfiles(
              profiles,
              nextType
            ).some((profile) => profile.id === draft.technicalProfileId)
            onChange({
              ...draft,
              connectionType: nextType,
              technicalProfileId: stillValid ? draft.technicalProfileId : "",
              pppoeUsername: nextType === "pppoe" ? draft.pppoeUsername : "",
              pppoePassword: nextType === "pppoe" ? draft.pppoePassword : "",
              ipAddress: nextType === "static_ip" ? draft.ipAddress : "",
              prefixLength: nextType === "static_ip" ? draft.prefixLength : "",
              gateway: nextType === "static_ip" ? draft.gateway : "",
            })
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar" />
          </SelectTrigger>
          <SelectContent>
            {allowedTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {ISP_CONNECTION_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Velocidad">
        <Input
          value={inheritedPair || `${inheritedDownload} / ${inheritedUpload}`}
          disabled
        />
      </Field>
      <Field label="Bajada">
        <Input value={inheritedDownload} disabled />
      </Field>
      <Field label="Subida">
        <Input value={inheritedUpload} disabled />
      </Field>

      {fields.showPppoe ? (
        <>
          <Field label="Usuario PPPoE">
            <Input
              disabled={disabled}
              value={draft.pppoeUsername}
              onChange={(event) =>
                onChange({ ...draft, pppoeUsername: event.target.value })
              }
            />
          </Field>
          <Field label="Contraseña PPPoE">
            <Input
              type="password"
              disabled={disabled}
              autoComplete="new-password"
              placeholder={passwordPlaceholder}
              value={draft.pppoePassword}
              onChange={(event) =>
                onChange({ ...draft, pppoePassword: event.target.value })
              }
            />
          </Field>
        </>
      ) : null}

      {fields.showStaticIp ? (
        <>
          <Field label="IP">
            <Input
              disabled={disabled}
              value={draft.ipAddress}
              onChange={(event) =>
                onChange({ ...draft, ipAddress: event.target.value })
              }
            />
          </Field>
          <Field label="Máscara/prefijo">
            <Input
              disabled={disabled}
              value={draft.prefixLength}
              onChange={(event) =>
                onChange({ ...draft, prefixLength: event.target.value })
              }
            />
          </Field>
          <Field label="Gateway">
            <Input
              disabled={disabled}
              value={draft.gateway}
              onChange={(event) =>
                onChange({ ...draft, gateway: event.target.value })
              }
            />
          </Field>
        </>
      ) : null}

      <Field label="VLAN">
        <Input
          disabled={disabled}
          value={draft.vlan}
          onChange={(event) => onChange({ ...draft, vlan: event.target.value })}
        />
      </Field>

      <Field label="Perfil técnico">
        <Select
          value={draft.technicalProfileId || undefined}
          disabled={disabled}
          onValueChange={(value) => {
            const profile = profiles.find((item) => item.id === value)
            onChange({
              ...draft,
              technicalProfileId: value,
              technicalProfile: profile?.code ?? draft.technicalProfile,
              coreName: profile?.coreName || draft.coreName || "MikroTik",
              coreProfileId: profile?.coreProfileId ?? draft.coreProfileId,
            })
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar perfil" />
          </SelectTrigger>
          <SelectContent>
            {compatible.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Core">
        <Input value={draft.coreName || "MikroTik"} disabled />
      </Field>
      <Field label="Perfil en Core">
        <Input
          disabled={disabled}
          value={draft.coreProfileId ?? ""}
          onChange={(event) =>
            onChange({ ...draft, coreProfileId: event.target.value })
          }
        />
      </Field>

      {allowTechnicalStatus ? (
        <Field label="Estado técnico">
          <Select
            value={draft.technicalStatus}
            disabled={disabled}
            onValueChange={(value) =>
              onChange({
                ...draft,
                technicalStatus: value as IspConnectionDraft["technicalStatus"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ISP_TECHNICAL_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {ISP_TECHNICAL_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : (
        <Field label="Estado técnico">
          <Input value="Provisionamiento pendiente" disabled />
        </Field>
      )}

      <p className="text-xs text-muted-foreground sm:col-span-2">
        {ISP_CORE_NOT_CONNECTED_MESSAGE}
      </p>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
