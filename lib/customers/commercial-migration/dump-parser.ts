/** Parsea líneas INSERT de dumps MySQL (tuplas VALUES). */
export function parseMysqlInsertLine(
  line: string
): { table: string; rows: (string | null)[][] } | null {
  const match = line.match(/^INSERT INTO `([^`]+)` VALUES (.+);?\s*$/)
  if (!match) return null

  const table = match[1]
  const valuesPart = match[2].replace(/;\s*$/, "")
  const rows: (string | null)[][] = []
  let i = 0
  const len = valuesPart.length

  while (i < len) {
    while (i < len && valuesPart[i] !== "(") i++
    if (i >= len) break
    i++

    const fields: (string | null)[] = []
    let current = ""
    let inString = false
    let escaped = false

    while (i < len) {
      const ch = valuesPart[i]

      if (inString) {
        if (escaped) {
          current += ch
          escaped = false
        } else if (ch === "\\") {
          escaped = true
        } else if (ch === "'") {
          inString = false
        } else {
          current += ch
        }
        i++
        continue
      }

      if (ch === "'") {
        inString = true
        i++
        continue
      }

      if (ch === ",") {
        fields.push(parseMysqlField(current))
        current = ""
        i++
        continue
      }

      if (ch === ")") {
        fields.push(parseMysqlField(current))
        rows.push(fields)
        i++
        while (i < len && (valuesPart[i] === "," || valuesPart[i] === " ")) {
          i++
        }
        break
      }

      current += ch
      i++
    }
  }

  return { table, rows }
}

function parseMysqlField(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.toUpperCase() === "NULL") return null
  return trimmed
}

export function parseLegacyClientRow(
  fields: (string | null)[]
): import("@/lib/customers/commercial-migration/types").LegacyClientRow {
  return {
    id: Number(fields[0]),
    nombre: fields[1] ?? "",
    ncliente: fields[2] ?? "",
    dnicuit: fields[3] ?? "",
    domicilio: fields[4] ?? "",
    telefono: fields[5] ?? "",
    email: fields[6] ?? "",
    provincia: fields[7] ?? "",
    ciudad: fields[8] ?? "",
    lat: fields[9] ?? "",
    lng: fields[10] ?? "",
    observ: fields[11] ?? "",
    fecha: fields[12] ?? "",
    estado: fields[13] ?? "",
  }
}

export function parseLegacyConnectionRow(
  fields: (string | null)[]
): import("@/lib/customers/commercial-migration/types").LegacyConnectionRow {
  return {
    id: Number(fields[0]),
    idclientes: fields[1] === null ? null : Number(fields[1]),
    idplanes: fields[4] === null ? null : Number(fields[4]),
    plan: fields[5] ?? "",
    tipo: fields[6] ?? "",
    nodo: fields[3] ?? "",
    ip: fields[7] ?? "",
    estado: fields[25] ?? "",
  }
}

export function loadLegacyTablesFromDump(sqlContent: string): {
  clientes: import("@/lib/customers/commercial-migration/types").LegacyClientRow[]
  conexiones: import("@/lib/customers/commercial-migration/types").LegacyConnectionRow[]
} {
  const clientes: import("@/lib/customers/commercial-migration/types").LegacyClientRow[] =
    []
  const conexiones: import("@/lib/customers/commercial-migration/types").LegacyConnectionRow[] =
    []

  for (const line of sqlContent.split(/\r?\n/)) {
    if (!line.startsWith("INSERT INTO")) continue
    const parsed = parseMysqlInsertLine(line)
    if (!parsed) continue

    if (parsed.table === "clientes") {
      for (const row of parsed.rows) {
        clientes.push(parseLegacyClientRow(row))
      }
    }

    if (parsed.table === "conexiones") {
      for (const row of parsed.rows) {
        conexiones.push(parseLegacyConnectionRow(row))
      }
    }
  }

  return { clientes, conexiones }
}
