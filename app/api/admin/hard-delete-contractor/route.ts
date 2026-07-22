import { NextResponse } from "next/server"

import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { hardDeleteContractor } from "@/lib/contractors/hard-delete-contractor.server"

type HardDeleteContractorRequestBody = {
  contractorId?: string
}

export async function POST(request: Request) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.message },
      { status: auth.status }
    )
  }

  const companyId = auth.sessionUser.companyId?.trim()
  if (!companyId) {
    return NextResponse.json(
      {
        success: false,
        error: "No se pudo resolver la empresa del administrador.",
      },
      { status: 400 }
    )
  }

  let body: HardDeleteContractorRequestBody

  try {
    body = (await request.json()) as HardDeleteContractorRequestBody
  } catch {
    return NextResponse.json(
      { success: false, error: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const contractorId = body.contractorId?.trim()
  if (!contractorId) {
    return NextResponse.json(
      { success: false, error: "contractorId es obligatorio." },
      { status: 400 }
    )
  }

  try {
    const result = await hardDeleteContractor({
      companyId,
      contractorId,
      sessionUser: auth.sessionUser,
    })

    if (!result.success) {
      return NextResponse.json(result, { status: 422 })
    }

    return NextResponse.json({
      success: true,
      legalName: result.data.legalName,
      deletedCrews: result.data.deletedCrews,
      deletedEmployees: result.data.deletedEmployees,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo eliminar definitivamente el contratista."

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
