"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { CuratedTopologyTree } from "@/components/network/curated-topology-tree"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  NETWORK_DEVICE_STATUS_LABELS,
} from "@/lib/network/labels"
import { networkQueryKeys } from "@/lib/network/react-query/keys"
import { useNetworkDevicesQuery } from "@/lib/network/react-query/use-network-devices-query"
import type { NetworkDevice } from "@/lib/network/types"
import type {
  CuratedTopologyForest,
  CuratedTopologyNode,
} from "@/lib/network/topology/types"
import { cn } from "@/lib/utils"

type BusyAction = "add" | "move" | "remove" | null
type AddMode = "root" | "child"
type MoveMode = "root" | "child"

function walkNodes(
  nodes: readonly CuratedTopologyNode[],
  visit: (node: CuratedTopologyNode) => void
) {
  for (const node of nodes) {
    visit(node)
    walkNodes(node.children, visit)
  }
}

function flattenForest(forest: CuratedTopologyForest): CuratedTopologyNode[] {
  const nodes: CuratedTopologyNode[] = []
  walkNodes(forest.roots, (node) => nodes.push(node))
  return nodes
}

function descendantIds(node: CuratedTopologyNode): Set<string> {
  const ids = new Set<string>()
  walkNodes(node.children, (child) => ids.add(child.deviceId))
  return ids
}

function deviceLabel(device: Pick<NetworkDevice, "id" | "hostname" | "managementIp">) {
  return device.hostname?.trim() || device.managementIp?.trim() || device.id
}

function monitoringLabel(status: string | null | undefined): string {
  if (
    status === "online" ||
    status === "offline" ||
    status === "degraded" ||
    status === "unknown"
  ) {
    return NETWORK_DEVICE_STATUS_LABELS[status]
  }
  return "Sin monitoreo"
}

function statusDotClass(status: string | null | undefined): string {
  if (status === "online") return "bg-emerald-500"
  if (status === "offline") return "bg-red-500"
  if (status === "degraded") return "bg-amber-500"
  return "bg-slate-400"
}

async function parsePlacementResponse(response: Response): Promise<void> {
  const body = (await response.json().catch(() => null)) as {
    success?: boolean
    error?: string
    message?: string
  } | null
  if (response.ok && body?.success !== false) return
  throw new Error(
    body?.error?.trim() ||
      body?.message?.trim() ||
      "No se pudo guardar la topología."
  )
}

async function postPlacement(input: {
  deviceId: string
  parentDeviceId: string | null
}) {
  const response = await fetch("/api/network/topology/placements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  await parsePlacementResponse(response)
}

async function patchPlacement(input: {
  deviceId: string
  parentDeviceId: string | null
}) {
  const response = await fetch("/api/network/topology/placements", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  await parsePlacementResponse(response)
}

async function deletePlacement(deviceId: string) {
  const response = await fetch(
    `/api/network/topology/placements?deviceId=${encodeURIComponent(deviceId)}`,
    { method: "DELETE" }
  )
  await parsePlacementResponse(response)
}

function DeviceOption({ device }: { device: NetworkDevice }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate font-medium">{deviceLabel(device)}</span>
      {device.managementIp ? (
        <span className="block truncate text-xs text-muted-foreground">
          {device.managementIp}
        </span>
      ) : null}
      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={cn(
            "inline-block size-1.5 rounded-full",
            statusDotClass(device.operationalStatus)
          )}
        />
        {monitoringLabel(device.operationalStatus)}
      </span>
    </span>
  )
}

export function CuratedTopologyEditor({
  forest,
  selectedDeviceId,
  onSelectDevice,
}: {
  forest: CuratedTopologyForest
  selectedDeviceId?: string | null
  onSelectDevice?: (deviceId: string) => void
}) {
  const queryClient = useQueryClient()
  const devicesQuery = useNetworkDevicesQuery()
  const [busy, setBusy] = useState<BusyAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addDeviceId, setAddDeviceId] = useState("")
  const [addMode, setAddMode] = useState<AddMode>("root")
  const [addParentId, setAddParentId] = useState("")
  const [moveNode, setMoveNode] = useState<CuratedTopologyNode | null>(null)
  const [moveMode, setMoveMode] = useState<MoveMode>("root")
  const [moveParentId, setMoveParentId] = useState("")
  const [removeNode, setRemoveNode] = useState<CuratedTopologyNode | null>(null)

  const placedIds = useMemo(() => {
    const ids = new Set<string>()
    walkNodes(forest.roots, (node) => ids.add(node.deviceId))
    return ids
  }, [forest])

  const placedNodes = useMemo(() => flattenForest(forest), [forest])
  const availableDevices = useMemo(
    () =>
      (devicesQuery.data ?? [])
        .filter((device) => !placedIds.has(device.id))
        .sort((left, right) =>
          deviceLabel(left).localeCompare(deviceLabel(right), "es")
        ),
    [devicesQuery.data, placedIds]
  )

  const moveTargets = useMemo(() => {
    if (!moveNode) return []
    const blocked = descendantIds(moveNode)
    blocked.add(moveNode.deviceId)
    return placedNodes.filter((node) => !blocked.has(node.deviceId))
  }, [moveNode, placedNodes])

  async function refreshTopology() {
    await queryClient.invalidateQueries({ queryKey: networkQueryKeys.topology() })
  }

  async function runAction(action: BusyAction, work: () => Promise<void>) {
    if (busy) return
    setBusy(action)
    setError(null)
    try {
      await work()
      await refreshTopology()
      setAddOpen(false)
      setMoveNode(null)
      setRemoveNode(null)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo guardar la topología."
      )
    } finally {
      setBusy(null)
    }
  }

  function openAdd() {
    setError(null)
    setAddDeviceId(availableDevices[0]?.id ?? "")
    setAddMode(forest.roots.length === 0 ? "root" : "root")
    setAddParentId(placedNodes[0]?.deviceId ?? "")
    setAddOpen(true)
  }

  function openMove(node: CuratedTopologyNode) {
    setError(null)
    const blocked = descendantIds(node)
    blocked.add(node.deviceId)
    const firstValid =
      placedNodes.find((item) => !blocked.has(item.deviceId))?.deviceId ?? ""
    setMoveMode("root")
    setMoveParentId(firstValid)
    setMoveNode(node)
  }

  const addDisabled =
    busy !== null ||
    !addDeviceId ||
    (addMode === "child" && (!addParentId || addParentId === addDeviceId))
  const moveDisabled =
    busy !== null ||
    !moveNode ||
    (moveMode === "child" && !moveParentId)

  return (
    <div>
      {forest.roots.length > 0 ? (
        <CuratedTopologyTree
          forest={forest}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={onSelectDevice}
          actions={(node) => (
            <div
              className="flex items-center gap-0.5 rounded-md border bg-background/95 p-0.5 shadow-sm"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => openMove(node)}
              >
                Mover
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => {
                  setError(null)
                  setRemoveNode(node)
                }}
              >
                Quitar de topología
              </Button>
            </div>
          )}
        />
      ) : (
        <p className="p-6 text-sm text-muted-foreground">
          Todavía no hay una topología curada
        </p>
      )}

      <div className="border-t px-6 py-4">
        <Button
          type="button"
          variant="outline"
          disabled={busy !== null}
          onClick={openAdd}
        >
          {busy === "add" ? "Guardando…" : "+ Agregar dispositivo"}
        </Button>
        {error && !addOpen && !moveNode && !removeNode ? (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        ) : null}
        {busy && !addOpen && !moveNode && !removeNode ? (
          <p className="mt-2 text-xs text-muted-foreground">Guardando…</p>
        ) : null}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar dispositivo</DialogTitle>
            <DialogDescription>
              El dispositivo se agrega a la topología curada. No se crea un
              dispositivo nuevo en el inventario.
            </DialogDescription>
          </DialogHeader>
          {devicesQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Cargando dispositivos…</p>
          ) : availableDevices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay dispositivos disponibles para agregar. Los que ya están en
              la topología no se listan.
            </p>
          ) : (
            <div className="space-y-4">
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Dispositivo</span>
                <select
                  className="block h-auto min-h-9 w-full rounded-md border bg-background px-3 py-2"
                  value={addDeviceId}
                  onChange={(event) => setAddDeviceId(event.target.value)}
                >
                  {availableDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {deviceLabel(device)}
                      {device.managementIp ? ` · ${device.managementIp}` : ""}
                      {` · ${monitoringLabel(device.operationalStatus)}`}
                    </option>
                  ))}
                </select>
              </label>
              {addDeviceId
                ? (() => {
                    const selected = availableDevices.find(
                      (device) => device.id === addDeviceId
                    )
                    return selected ? <DeviceOption device={selected} /> : null
                  })()
                : null}
              <fieldset className="space-y-2 text-sm">
                <legend className="text-muted-foreground">Colocación</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="add-mode"
                    checked={addMode === "root"}
                    onChange={() => setAddMode("root")}
                  />
                  Como raíz
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="add-mode"
                    checked={addMode === "child"}
                    disabled={placedNodes.length === 0}
                    onChange={() => setAddMode("child")}
                  />
                  Como hijo de...
                </label>
                {addMode === "child" ? (
                  <select
                    className="block h-9 w-full rounded-md border bg-background px-3"
                    value={addParentId}
                    onChange={(event) => setAddParentId(event.target.value)}
                  >
                    {placedNodes
                      .filter((node) => node.deviceId !== addDeviceId)
                      .map((node) => (
                        <option key={node.deviceId} value={node.deviceId}>
                          {node.label}
                        </option>
                      ))}
                  </select>
                ) : null}
              </fieldset>
            </div>
          )}
          {error && addOpen ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => setAddOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={addDisabled || availableDevices.length === 0}
              onClick={() =>
                void runAction("add", () =>
                  postPlacement({
                    deviceId: addDeviceId,
                    parentDeviceId: addMode === "root" ? null : addParentId,
                  })
                )
              }
            >
              {busy === "add" ? "Guardando…" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={moveNode != null}
        onOpenChange={(open) => {
          if (!open) setMoveNode(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover</DialogTitle>
            <DialogDescription>
              {moveNode
                ? `Cambiar el padre de ${moveNode.label} en la topología curada.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="move-mode"
                checked={moveMode === "root"}
                onChange={() => setMoveMode("root")}
              />
              Convertir en raíz
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="move-mode"
                checked={moveMode === "child"}
                disabled={moveTargets.length === 0}
                onChange={() => setMoveMode("child")}
              />
              Mover debajo de...
            </label>
            {moveMode === "child" ? (
              <select
                className="block h-9 w-full rounded-md border bg-background px-3"
                value={moveParentId}
                onChange={(event) => setMoveParentId(event.target.value)}
              >
                {moveTargets.map((node) => (
                  <option key={node.deviceId} value={node.deviceId}>
                    {node.label}
                  </option>
                ))}
              </select>
            ) : null}
          </fieldset>
          {error && moveNode ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => setMoveNode(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={moveDisabled}
              onClick={() => {
                if (!moveNode) return
                void runAction("move", () =>
                  patchPlacement({
                    deviceId: moveNode.deviceId,
                    parentDeviceId: moveMode === "root" ? null : moveParentId,
                  })
                )
              }}
            >
              {busy === "move" ? "Guardando…" : "Mover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeNode != null}
        onOpenChange={(open) => {
          if (!open) setRemoveNode(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitar de topología</DialogTitle>
            <DialogDescription>
              {removeNode
                ? `${removeNode.label} se quita solo de la topología curada. El dispositivo permanece en el inventario Network.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción no elimina el dispositivo.
          </p>
          {error && removeNode ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => setRemoveNode(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy !== null || !removeNode}
              onClick={() => {
                if (!removeNode) return
                void runAction("remove", () =>
                  deletePlacement(removeNode.deviceId)
                )
              }}
            >
              {busy === "remove" ? "Quitando…" : "Quitar de topología"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
