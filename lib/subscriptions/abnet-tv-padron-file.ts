import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

import {
  readAbnetTvPadronMatrix,
  type AbnetTvPadronSourceRow,
} from "@/lib/subscriptions/abnet-tv-padron"

const require = createRequire(import.meta.url)

export const ABNET_TV_PADRON_XLSX_PATH =
  "C:\\Users\\alfre\\Downloads\\Conex. Internet + TV.xlsx"

export function readAbnetTvPadronWorkbook(
  filePath = ABNET_TV_PADRON_XLSX_PATH
): AbnetTvPadronSourceRow[] {
  const xlsx = require("xlsx") as {
    read: (
      data: Buffer,
      options: { type: "buffer"; cellDates: boolean }
    ) => { SheetNames: string[]; Sheets: Record<string, unknown> }
    utils: {
      sheet_to_json: (
        sheet: unknown,
        options: { header: 1; defval: null; raw: boolean }
      ) => unknown[][]
    }
  }
  const workbook = xlsx.read(readFileSync(filePath), {
    type: "buffer",
    cellDates: false,
  })
  const sheet = workbook.Sheets.Datos ?? workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error("El padrón no tiene hoja Datos.")
  return readAbnetTvPadronMatrix(
    xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
  )
}
