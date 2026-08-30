import { keepPreviousData } from "@tanstack/react-query"

export const NETWORK_UI_REFETCH_INTERVAL_MS = 15_000

export const NETWORK_QUERY_OPTIONS = {
  refetchInterval: NETWORK_UI_REFETCH_INTERVAL_MS,
  refetchIntervalInBackground: false,
  refetchOnMount: true,
  staleTime: 0,
  placeholderData: keepPreviousData,
} as const
