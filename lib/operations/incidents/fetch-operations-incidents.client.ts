import type {
  AddIncidentEventRequest,
  IncidentResponse,
  IncidentSummary,
  UpdateIncidentStatusRequest,
} from "@/lib/types/task-incidents"

type OperationsIncidentApiResponse<T> =
  | { success: true; data: T }
  | { success: false; message: string; code?: string }

async function parseOperationsIncidentResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  let payload: OperationsIncidentApiResponse<T>

  try {
    payload = (await response.json()) as OperationsIncidentApiResponse<T>
  } catch {
    throw new Error(fallbackMessage)
  }

  if (!response.ok || !payload.success) {
    throw new Error(
      payload.success === false ? payload.message : fallbackMessage
    )
  }

  return payload.data
}

export async function fetchActiveOperationsIncidents(): Promise<
  IncidentSummary[]
> {
  const response = await fetch("/api/operations/incidents?activeOnly=true", {
    method: "GET",
    cache: "no-store",
  })

  return parseOperationsIncidentResponse(
    response,
    "No fue posible cargar las incidencias activas."
  )
}

export async function fetchOperationsIncidentById(
  incidentId: string
): Promise<IncidentResponse> {
  const response = await fetch(
    `/api/operations/incidents/${encodeURIComponent(incidentId)}`,
    {
      method: "GET",
      cache: "no-store",
    }
  )

  return parseOperationsIncidentResponse(
    response,
    "No fue posible cargar el detalle de la incidencia."
  )
}

export async function updateOperationsIncidentStatus(
  incidentId: string,
  body: UpdateIncidentStatusRequest
): Promise<IncidentResponse> {
  const response = await fetch(
    `/api/operations/incidents/${encodeURIComponent(incidentId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  )

  return parseOperationsIncidentResponse(
    response,
    "No fue posible actualizar la incidencia."
  )
}

export async function addOperationsIncidentEvent(
  incidentId: string,
  body: AddIncidentEventRequest
): Promise<IncidentResponse> {
  const response = await fetch(
    `/api/operations/incidents/${encodeURIComponent(incidentId)}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  )

  return parseOperationsIncidentResponse(
    response,
    "No fue posible registrar el evento de la incidencia."
  )
}

export async function transitionOperationsIncidentStatus(
  incidentId: string,
  currentStatus: IncidentSummary["status"],
  nextStatus: IncidentSummary["status"],
  body?: Omit<UpdateIncidentStatusRequest, "status">
): Promise<IncidentResponse> {
  if (currentStatus === nextStatus) {
    return fetchOperationsIncidentById(incidentId)
  }

  if (
    currentStatus === "REPORTADA" &&
    (nextStatus === "RESUELTA" || nextStatus === "RECHAZADA")
  ) {
    await updateOperationsIncidentStatus(incidentId, {
      status: "EN_ANALISIS",
      ...body,
    })

    return updateOperationsIncidentStatus(incidentId, {
      status: nextStatus,
      ...body,
    })
  }

  return updateOperationsIncidentStatus(incidentId, {
    status: nextStatus,
    ...body,
  })
}
