"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { NetworkAlarmDto } from "@/lib/network/alarms/contract"
import {
  NETWORK_QUERY_OPTIONS,
  NETWORK_UI_REFETCH_INTERVAL_MS,
} from "@/lib/network/react-query/defaults"
import { networkQueryKeys } from "@/lib/network/react-query/keys"

async function parseAlarmResponse(
  response: Response,
  fallback: string
): Promise<NetworkAlarmDto> {
  const body = (await response.json()) as {
    success?: boolean
    alarm?: NetworkAlarmDto
    message?: string
  }
  if (!body.success || !body.alarm) {
    throw new Error(body.message ?? fallback)
  }
  return body.alarm
}

async function fetchNetworkAlarms(): Promise<NetworkAlarmDto[]> {
  const response = await fetch("/api/network/v1/alarms")
  const body = (await response.json()) as {
    success?: boolean
    alarms?: NetworkAlarmDto[]
    message?: string
  }
  if (!body.success) {
    throw new Error(body.message ?? "No se pudieron cargar las alarmas.")
  }
  return body.alarms ?? []
}

async function fetchNetworkAlarm(alarmId: string): Promise<NetworkAlarmDto> {
  const response = await fetch(`/api/network/v1/alarms/${alarmId}`)
  return parseAlarmResponse(response, "No se pudo cargar la alarma.")
}

export function useNetworkAlarmsQuery() {
  return useQuery({
    queryKey: networkQueryKeys.alarms(),
    queryFn: fetchNetworkAlarms,
    ...NETWORK_QUERY_OPTIONS,
    refetchInterval: NETWORK_UI_REFETCH_INTERVAL_MS,
  })
}

export function useNetworkAlarmQuery(alarmId: string | null) {
  return useQuery({
    queryKey: [...networkQueryKeys.alarms(), alarmId],
    queryFn: () => fetchNetworkAlarm(alarmId ?? ""),
    enabled: Boolean(alarmId),
    ...NETWORK_QUERY_OPTIONS,
  })
}

export function useNetworkAlarmMutations() {
  const queryClient = useQueryClient()

  async function invalidateAlarms() {
    await queryClient.invalidateQueries({ queryKey: networkQueryKeys.alarms() })
  }

  const acknowledge = useMutation({
    mutationFn: async (alarmId: string) => {
      const response = await fetch(
        `/api/network/v1/alarms/${alarmId}/acknowledge`,
        { method: "POST" }
      )
      return parseAlarmResponse(response, "No se pudo reconocer la alarma.")
    },
    onSuccess: invalidateAlarms,
  })

  const resolve = useMutation({
    mutationFn: async (alarmId: string) => {
      const response = await fetch(`/api/network/v1/alarms/${alarmId}/resolve`, {
        method: "POST",
      })
      return parseAlarmResponse(response, "No se pudo resolver la alarma.")
    },
    onSuccess: invalidateAlarms,
  })

  const seen = useMutation({
    mutationFn: async (alarmId: string) => {
      const response = await fetch(`/api/network/v1/alarms/${alarmId}/seen`, {
        method: "POST",
      })
      return parseAlarmResponse(response, "No se pudo marcar la alarma como vista.")
    },
    onSuccess: invalidateAlarms,
  })

  return { acknowledge, resolve, seen }
}
