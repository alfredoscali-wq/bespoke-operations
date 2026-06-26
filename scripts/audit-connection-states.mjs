/**
 * Auditoría funcional — estados de conexiones del sistema comercial (solo lectura).
 * Fuente: data/sistema-comercial.sql (sin código PHP disponible en el repo).
 */
import fs from "node:fs"
import readline from "node:readline"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DUMP_PATH = path.join(__dirname, "..", "data", "sistema-comercial.sql")

function parseMysqlInsertLine(line) {
  const match = line.match(/^INSERT INTO `([^`]+)` VALUES (.+);?\s*$/)
  if (!match) return null
  const table = match[1]
  const valuesPart = match[2].replace(/;\s*$/, "")
  const rows = []
  let i = 0
  const len = valuesPart.length

  while (i < len) {
    while (i < len && valuesPart[i] !== "(") i++
    if (i >= len) break
    i++
    const fields = []
    let current = ""
    let inString = false
    let escaped = false

    while (i < len) {
      const ch = valuesPart[i]
      if (inString) {
        if (escaped) {
          current += ch
          escaped = false
        } else if (ch === "\\") escaped = true
        else if (ch === "'") inString = false
        else current += ch
        i++
        continue
      }
      if (ch === "'") {
        inString = true
        i++
        continue
      }
      if (ch === ",") {
        fields.push(parseField(current))
        current = ""
        i++
        continue
      }
      if (ch === ")") {
        fields.push(parseField(current))
        rows.push(fields)
        i++
        while (i < len && (valuesPart[i] === "," || valuesPart[i] === " ")) i++
        break
      }
      current += ch
      i++
    }
  }
  return { table, rows }
}

function parseField(raw) {
  const trimmed = raw.trim()
  if (trimmed.toUpperCase() === "NULL") return null
  return trimmed
}

function parseConnection(fields) {
  return {
    id: Number(fields[0]),
    idclientes: fields[1] === null ? null : Number(fields[1]),
    fechaalta: fields[23] ?? "",
    gratis: fields[24] ?? "",
    estado: String(fields[25] ?? "").trim().toUpperCase(),
    obsgratis: fields[26] ?? "",
    tipo: fields[6] ?? "",
    plan: fields[5] ?? "",
    empresa: fields[19] ?? "",
  }
}

function parseClient(fields) {
  return {
    id: Number(fields[0]),
    estado: String(fields[13] ?? "").trim().toUpperCase(),
  }
}

function parseTicket(fields) {
  return {
    idconexiones: fields[4] === null ? null : Number(fields[4]),
    asunto: fields[6] ?? "",
    detalle: fields[10] ?? "",
    estado: String(fields[13] ?? "").trim().toUpperCase(),
  }
}

function parsePrefact(fields) {
  return {
    idcliente: fields[1] === null ? null : Number(fields[1]),
    idconexion: fields[2] ?? "",
    fechafactura: fields[21] ?? "",
    montototal: fields[19],
  }
}

function inc(map, key, by = 1) {
  map[key] = (map[key] ?? 0) + by
}

function topEntries(map, n = 8) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

async function loadTables() {
  const clientes = new Map()
  const conexiones = []
  const tickets = []
  const prefacts = []

  const rl = readline.createInterface({
    input: fs.createReadStream(DUMP_PATH, { encoding: "utf8" }),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    if (!line.startsWith("INSERT INTO")) continue
    const parsed = parseMysqlInsertLine(line)
    if (!parsed) continue

    if (parsed.table === "clientes") {
      for (const row of parsed.rows) {
        const c = parseClient(row)
        clientes.set(c.id, c)
      }
    }
    if (parsed.table === "conexiones") {
      for (const row of parsed.rows) {
        conexiones.push(parseConnection(row))
      }
    }
    if (parsed.table === "ticket") {
      for (const row of parsed.rows) {
        tickets.push(parseTicket(row))
      }
    }
    if (parsed.table === "prefacturaciones") {
      for (const row of parsed.rows) {
        prefacts.push(parsePrefact(row))
      }
    }
  }

  return { clientes, conexiones, tickets, prefacts }
}

function uniqueClientsByState(conexiones) {
  const byState = { A: 0, B: 0, C: 0, M: 0, I: 0, P: 0, other: 0 }
  const clientsById = new Map()

  for (const conn of conexiones) {
    if (!conn.idclientes) continue
    const set = clientsById.get(conn.idclientes) ?? new Set()
    set.add(conn.estado || "other")
    clientsById.set(conn.idclientes, set)
  }

  for (const states of clientsById.values()) {
    for (const st of states) {
      if (st in byState) byState[st]++
      else byState.other++
    }
  }
  return byState
}

function main() {
  return loadTables().then(({ clientes, conexiones, tickets, prefacts }) => {
    const connByEstado = {}
    const clientEstadoCross = {}
    const gratisByEstado = {}
    const obsSamples = {}
    const fechaYears = {}
    const tipoByEstado = {}
    const empresaByEstado = {}
    const connIdsByEstado = { A: [], B: [], C: [], M: [], I: [], P: [] }

    for (const conn of conexiones) {
      const st = conn.estado || "?"
      inc(connByEstado, st)
      connIdsByEstado[st] = connIdsByEstado[st] || []
      if (connIdsByEstado[st].length < 50000) connIdsByEstado[st].push(conn.id)

      const client = conn.idclientes ? clientes.get(conn.idclientes) : null
      const cst = client?.estado ?? "?"
      clientEstadoCross[st] = clientEstadoCross[st] ?? {}
      inc(clientEstadoCross[st], cst)

      if (conn.gratis) {
        gratisByEstado[st] = gratisByEstado[st] ?? {}
        inc(gratisByEstado[st], conn.gratis)
      }

      if (conn.obsgratis) {
        obsSamples[st] = obsSamples[st] ?? new Set()
        if (obsSamples[st].size < 5) obsSamples[st].add(conn.obsgratis.slice(0, 120))
      }

      if (conn.fechaalta) {
        const year = conn.fechaalta.slice(0, 4)
        fechaYears[st] = fechaYears[st] ?? {}
        inc(fechaYears[st], year)
      }

      if (conn.tipo) {
        tipoByEstado[st] = tipoByEstado[st] ?? {}
        inc(tipoByEstado[st], conn.tipo)
      }
      if (conn.empresa) {
        empresaByEstado[st] = empresaByEstado[st] ?? {}
        inc(empresaByEstado[st], conn.empresa)
      }
    }

    const uniqueClients = uniqueClientsByState(conexiones)

    // Tickets por estado de conexión referenciada
    const connEstadoById = new Map(conexiones.map((c) => [c.id, c.estado]))
    const ticketAsuntoByConnEstado = {}
    for (const t of tickets) {
      if (!t.idconexiones) continue
      const st = connEstadoById.get(t.idconexiones) ?? "?"
      ticketAsuntoByConnEstado[st] = ticketAsuntoByConnEstado[st] ?? {}
      if (t.asunto) inc(ticketAsuntoByConnEstado[st], t.asunto)
    }

    // Prefacturaciones recientes (2025-2026) por estado de conexión
    const recentPrefactByConnEstado = { A: 0, B: 0, C: 0, M: 0, I: 0, P: 0, other: 0 }
    const recentPrefactClients = { A: 0, B: 0, C: 0, M: 0, I: 0, P: 0, other: 0 }
    for (const pf of prefacts) {
      const ff = pf.fechafactura ?? ""
      if (!ff.startsWith("2025") && !ff.startsWith("2026")) continue
      const connId = Number(pf.idconexion)
      const st = connEstadoById.get(connId)
      if (!st) {
        recentPrefactByConnEstado.other++
        continue
      }
      if (st in recentPrefactByConnEstado) recentPrefactByConnEstado[st]++
      else recentPrefactByConnEstado.other++
    }

    // Clientes con múltiples estados de conexión (transiciones históricas implícitas)
    const multiStateClients = { total: 0, patterns: {} }
    const clientsConnStates = new Map()
    for (const conn of conexiones) {
      if (!conn.idclientes) continue
      const set = clientsConnStates.get(conn.idclientes) ?? new Set()
      set.add(conn.estado)
      clientsConnStates.set(conn.idclientes, set)
    }
    for (const states of clientsConnStates.values()) {
      if (states.size < 2) continue
      multiStateClients.total++
      const key = [...states].sort().join("+")
      inc(multiStateClients.patterns, key)
    }

    // Coexistencia A con otros en mismo cliente
    const coexist = { hasA_and_B: 0, hasA_and_C: 0, hasA_and_M: 0, hasA_and_I: 0, hasA_and_P: 0, onlyNonA: 0 }
    for (const states of clientsConnStates.values()) {
      const hasA = states.has("A")
      if (hasA && states.has("B")) coexist.hasA_and_B++
      if (hasA && states.has("C")) coexist.hasA_and_C++
      if (hasA && states.has("M")) coexist.hasA_and_M++
      if (hasA && states.has("I")) coexist.hasA_and_I++
      if (hasA && states.has("P")) coexist.hasA_and_P++
      if (!hasA && states.size > 0) coexist.onlyNonA++
    }

    const report = {
      meta: {
        database: "solucio3_abnetpro",
        source: DUMP_PATH,
        note: "No hay código PHP/procedimientos del sistema comercial en este repositorio. Análisis basado en esquema DDL + datos del dump.",
        conexionesDefaultEstado: "P (según CREATE TABLE)",
        clientesDefaultEstado: "P (según CREATE TABLE)",
      },
      conteos: {
        conexionesPorEstado: connByEstado,
        clientesUnicosPorEstadoConexion: uniqueClients,
      },
      cruceClienteEstado: clientEstadoCross,
      prefacturacionesRecientes2025_2026_porEstadoConexion: recentPrefactByConnEstado,
      coexistenciaEstadosEnMismoCliente: coexist,
      clientesConMultiplesEstadosConexion: {
        total: multiStateClients.total,
        topPatrones: topEntries(new Map(Object.entries(multiStateClients.patterns)), 15),
      },
      muestrasObsgratis: Object.fromEntries(
        Object.entries(obsSamples).map(([k, v]) => [k, [...v]])
      ),
      ticketsAsuntoTopPorEstadoConexion: Object.fromEntries(
        Object.entries(ticketAsuntoByConnEstado).map(([k, v]) => [
          k,
          topEntries(new Map(Object.entries(v)), 6),
        ])
      ),
      fechaaltaAniosTopPorEstado: Object.fromEntries(
        Object.entries(fechaYears).map(([k, v]) => [
          k,
          topEntries(new Map(Object.entries(v)), 5),
        ])
      ),
    }

    console.log(JSON.stringify(report, null, 2))
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
