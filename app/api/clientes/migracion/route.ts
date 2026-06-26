import { NextResponse } from "next/server"

import { enrichMigrationCustomers } from "@/lib/customers/commercial-migration/review-utils"
import {
  readMigrationReviewState,
  readPreparedMigrationDataset,
  upsertMigrationReviewDecision,
} from "@/lib/customers/commercial-migration/review-storage"
import type { MigrationReviewAction } from "@/lib/customers/commercial-migration/review-types"

export async function GET() {
  try {
    const dataset = readPreparedMigrationDataset()
    const reviewState = readMigrationReviewState()
    const records = enrichMigrationCustomers(
      dataset.records,
      reviewState.decisions
    )

    return NextResponse.json({
      generatedAt: dataset.generatedAt,
      sourceDump: dataset.sourceDump,
      reviewStateUpdatedAt: reviewState.updatedAt,
      summary: dataset.summary,
      duplicateGroups: dataset.duplicateGroups,
      records,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible cargar el dataset"
    return NextResponse.json({ error: message }, { status: 404 })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      legacyId?: number
      action?: MigrationReviewAction | null
    }

    if (typeof body.legacyId !== "number" || !Number.isFinite(body.legacyId)) {
      return NextResponse.json(
        { error: "legacyId inválido" },
        { status: 400 }
      )
    }

    if (
      body.action !== null &&
      body.action !== "aprobado" &&
      body.action !== "revisar_posterior" &&
      body.action !== "excluido"
    ) {
      return NextResponse.json({ error: "action inválida" }, { status: 400 })
    }

    const reviewState = upsertMigrationReviewDecision({
      legacyId: body.legacyId,
      action: body.action ?? null,
    })

    return NextResponse.json({ ok: true, reviewState })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible guardar la decisión"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
