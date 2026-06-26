"use client"

import { parseCambioDomicilioFromTask } from "@/lib/tasks/cambio-domicilio"
import type { Task } from "@/lib/types/tasks"
import { WorkOrderAddressLocationBlock } from "@/components/tareas/work-order-address-location-block"

type WorkOrderCambioDomicilioDetailProps = {
  task: Task
  className?: string
}

export function WorkOrderCambioDomicilioDetail({
  task,
}: WorkOrderCambioDomicilioDetailProps) {
  const details = parseCambioDomicilioFromTask(task)

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <WorkOrderAddressLocationBlock
        title="Domicilio actual"
        description="Ubicación de retiro de equipos."
        address={details.current.address}
        locality={details.current.locality}
        sharedLocation={details.current.sharedLocation}
        latitude={details.current.latitude}
        longitude={details.current.longitude}
        onCoordinatesChange={() => undefined}
        readOnly
      />

      <WorkOrderAddressLocationBlock
        title="Domicilio nuevo"
        description="Ubicación de instalación del servicio."
        address={details.new.address}
        locality={details.new.locality}
        sharedLocation={details.new.sharedLocation}
        latitude={details.new.latitude}
        longitude={details.new.longitude}
        onCoordinatesChange={() => undefined}
        readOnly
      />
    </div>
  )
}
