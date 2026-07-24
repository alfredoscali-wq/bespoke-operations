import { recordActivityEventClient } from "@/lib/activity/record-activity-event.client"
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  ACTIVITY_MODULES,
  ACTIVITY_ORIGINS,
} from "@/lib/activity/types"
import {
  TREASURY_MOVEMENT_TYPES,
  type TreasuryMovementType,
} from "@/lib/tesoreria/categories"
import type { TreasuryMovement } from "@/lib/types/tesoreria"

function movementDetail(movement: TreasuryMovement): string {
  const kind =
    movement.movementType === TREASURY_MOVEMENT_TYPES.INCOME
      ? "Ingreso"
      : "Egreso"
  return `${kind} ${movement.amount} · ${movement.category}`
}

export function emitTreasuryMovementCreated(movement: TreasuryMovement) {
  const action =
    movement.movementType === TREASURY_MOVEMENT_TYPES.INCOME
      ? ACTIVITY_ACTIONS.TREASURY_INCOME_CREATED
      : ACTIVITY_ACTIONS.TREASURY_EXPENSE_CREATED

  void recordActivityEventClient({
    action,
    module: ACTIVITY_MODULES.TREASURY,
    entityType: ACTIVITY_ENTITY_TYPES.TREASURY_MOVEMENT,
    entityId: movement.id,
    detail: movementDetail(movement),
    metadata: {
      movementType: movement.movementType,
      origin: movement.origin,
      category: movement.category,
      amount: movement.amount,
      status: movement.status,
    },
    origin: ACTIVITY_ORIGINS.WEB,
  })
}

export function emitTreasuryMovementUpdated(movement: TreasuryMovement) {
  void recordActivityEventClient({
    action: ACTIVITY_ACTIONS.TREASURY_MOVEMENT_UPDATED,
    module: ACTIVITY_MODULES.TREASURY,
    entityType: ACTIVITY_ENTITY_TYPES.TREASURY_MOVEMENT,
    entityId: movement.id,
    detail: `Actualización · ${movementDetail(movement)}`,
    metadata: {
      movementType: movement.movementType,
      status: movement.status,
      amount: movement.amount,
    },
    origin: ACTIVITY_ORIGINS.WEB,
  })
}

export function emitTreasuryMovementCancelled(movement: TreasuryMovement) {
  void recordActivityEventClient({
    action: ACTIVITY_ACTIONS.TREASURY_MOVEMENT_CANCELLED,
    module: ACTIVITY_MODULES.TREASURY,
    entityType: ACTIVITY_ENTITY_TYPES.TREASURY_MOVEMENT,
    entityId: movement.id,
    detail: `Anulado · ${movementDetail(movement)}`,
    metadata: {
      movementType: movement.movementType as TreasuryMovementType,
      amount: movement.amount,
    },
    origin: ACTIVITY_ORIGINS.WEB,
  })
}

export function emitTreasuryReceiptUploaded(movement: TreasuryMovement) {
  void recordActivityEventClient({
    action: ACTIVITY_ACTIONS.TREASURY_RECEIPT_UPLOADED,
    module: ACTIVITY_MODULES.TREASURY,
    entityType: ACTIVITY_ENTITY_TYPES.TREASURY_MOVEMENT,
    entityId: movement.id,
    detail: `Comprobante · ${movementDetail(movement)}`,
    metadata: {
      receiptUrl: movement.receiptUrl,
    },
    origin: ACTIVITY_ORIGINS.WEB,
  })
}

export function emitTreasuryMovementDeleted(movement: TreasuryMovement) {
  void recordActivityEventClient({
    action: ACTIVITY_ACTIONS.TREASURY_MOVEMENT_DELETED,
    module: ACTIVITY_MODULES.TREASURY,
    entityType: ACTIVITY_ENTITY_TYPES.TREASURY_MOVEMENT,
    entityId: movement.id,
    detail: `Eliminado · ${movementDetail(movement)}`,
    metadata: {
      movementId: movement.id,
      movementType: movement.movementType,
      amount: movement.amount,
      deletedAt: new Date().toISOString(),
    },
    origin: ACTIVITY_ORIGINS.WEB,
  })
}
