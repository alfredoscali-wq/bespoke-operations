/**
 * RC1.1A — Auditoría read-only del dump comercial (data/sistema-comercial.sql)
 * No modifica Bespoke ni Supabase.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DUMP_PATH = path.join(__dirname, "..", "data", "sistema-comercial.sql")

function isBlank(value) {
  if (value === null || value === undefined) return true
  return String(value).trim() === ""
}

function normalizeLocality(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

function normalizeDni(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^0-9]/g, "")
}

function isTestName(name) {
  const n = String(name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
  return (
    n.includes("test") ||
    n.includes("prueba") ||
    n.includes("demo") ||
    n === "xxx" ||
    n.startsWith("cliente prueba")
  )
}

function isValidEmail(email) {
  const e = String(email ?? "").trim()
  if (!e) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

/** Parse MySQL INSERT VALUES tuples from a line. */
function parseInsertLine(line) {
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

function mapTechnology(tipo) {
  const t = String(tipo ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
  if (t.includes("fibra") || t === "fo") return "fiber"
  if (t.includes("wireless") || t.includes("radio") || t.includes("aire"))
    return "wireless"
  if (!t) return null
  return "other"
}

function classifyClient(client, ctx) {
  const reasons = []
  const {
    id,
    ncliente,
    nombre,
    dnicuit,
    domicilio,
    telefono,
    email,
    ciudad,
    observ,
    estado,
  } = client

  if (estado === "B") {
    reasons.push("estado B (baja)")
  }
  if (isTestName(nombre)) {
    reasons.push("nombre de prueba")
  }
  if (isBlank(nombre)) {
    reasons.push("sin nombre")
  }

  const hasMinContact = !isBlank(telefono) || !isBlank(email)
  const hasAddress = !isBlank(domicilio)
  if (!hasMinContact && !hasAddress) {
    reasons.push("sin datos mínimos (teléfono/email/dirección)")
  }

  if (ctx.duplicateNcliente.has(ncliente)) {
    reasons.push("ncliente duplicado")
  }
  if (ctx.duplicateDni.has(dnicuit) && !isBlank(dnicuit)) {
    reasons.push("DNI duplicado")
  }

  const obsLower = String(observ ?? "").toLowerCase()
  if (obsLower.includes("baja")) {
    reasons.push("observación contiene baja")
  }

  const activeConnections = ctx.connectionsByClient.get(id) ?? []
  const activeConn = activeConnections.filter((c) => c.estado === "A")
  if (estado === "A" && activeConn.length === 0 && activeConnections.length === 0) {
    reasons.push("cliente activo sin conexiones")
  }

  // NO IMPORTAR
  if (
    estado === "B" ||
    isTestName(nombre) ||
    isBlank(nombre) ||
    (!hasMinContact && !hasAddress) ||
    ctx.duplicateNcliente.has(ncliente)
  ) {
    return { bucket: "NO_IMPORTAR", reasons }
  }

  // REVISAR
  const reviewReasons = []
  if (isBlank(domicilio)) reviewReasons.push("sin dirección")
  if (isBlank(ciudad)) reviewReasons.push("sin localidad")
  if (isBlank(telefono)) reviewReasons.push("sin teléfono")
  if (isBlank(dnicuit)) reviewReasons.push("sin DNI")
  if (isBlank(email)) reviewReasons.push("sin email")
  if (ctx.duplicateDni.has(dnicuit) && !isBlank(dnicuit))
    reviewReasons.push("DNI duplicado")
  if (obsLower.includes("baja")) reviewReasons.push("observación contiene baja")
  if (estado === "A" && activeConn.length === 0)
    reviewReasons.push("activo sin conexión activa")
  if (email && !isValidEmail(email)) reviewReasons.push("email inválido")
  if (
    client.techFromConn &&
    client.techFromConn !== "fiber" &&
    client.techFromConn !== "wireless"
  )
    reviewReasons.push(`tecnología inconsistente: ${client.techRaw}`)

  if (reviewReasons.length > 0) {
    return { bucket: "REVISAR", reasons: reviewReasons }
  }

  return { bucket: "IMPORTAR", reasons: [] }
}

function main() {
  const content = fs.readFileSync(DUMP_PATH, "utf8")
  const lines = content.split(/\r?\n/)

  const tableCounts = {}
  const tableRows = {}
  const autoIncrements = {}

  for (const line of lines) {
    const ai = line.match(
      /AUTO_INCREMENT=(\d+) DEFAULT CHARSET/
    )
    if (ai) {
      // will capture last per table from CREATE - also parse table name from previous lines
    }

    if (!line.startsWith("INSERT INTO")) continue
    const parsed = parseInsertLine(line)
    if (!parsed) continue
    const { table, rows } = parsed
    tableCounts[table] = (tableCounts[table] ?? 0) + rows.length
    if (!tableRows[table]) tableRows[table] = []
    tableRows[table].push(...rows)
  }

  // Parse AUTO_INCREMENT from CREATE TABLE blocks
  for (let idx = 0; idx < lines.length; idx++) {
    const createMatch = lines[idx].match(/^CREATE TABLE `([^`]+)`/)
    if (!createMatch) continue
    for (let j = idx; j < Math.min(idx + 25, lines.length); j++) {
      const aiMatch = lines[j].match(
        /AUTO_INCREMENT=(\d+) DEFAULT CHARSET/
      )
      if (aiMatch) {
        autoIncrements[createMatch[1]] = Number(aiMatch[1]) - 1
        break
      }
    }
  }

  const clientRows = tableRows.clientes ?? []
  const conexionRows = tableRows.conexiones ?? []
  const planRows = tableRows.planes ?? []

  const clients = clientRows.map((r) => ({
    id: Number(r[0]),
    nombre: r[1],
    ncliente: r[2],
    dnicuit: r[3],
    domicilio: r[4],
    telefono: r[5],
    email: r[6],
    provincia: r[7],
    ciudad: r[8],
    lat: r[9],
    lng: r[10],
    observ: r[11],
    fecha: r[12],
    estado: r[13],
    enviomail: r[14],
  }))

  const connections = conexionRows.map((r) => ({
    id: Number(r[0]),
    idclientes: r[1] === null ? null : Number(r[1]),
    idnodos: r[2] === null ? null : Number(r[2]),
    nodo: r[3],
    idplanes: r[4] === null ? null : Number(r[4]),
    plan: r[5],
    tipo: r[6],
    ip: r[7],
    gratis: r[24],
    estado: r[25],
  }))

  const plans = planRows.map((r) => ({
    id: Number(r[0]),
    identplan: r[1],
    nombre: r[2],
    precio: r[3],
    estado: r[7],
  }))

  const connectionsByClient = new Map()
  for (const conn of connections) {
    if (conn.idclientes == null) continue
    const list = connectionsByClient.get(conn.idclientes) ?? []
    list.push(conn)
    connectionsByClient.set(conn.idclientes, list)
  }

  const clientIds = new Set(clients.map((c) => c.id))

  // Duplicate detection
  const nclienteCount = new Map()
  const dniCount = new Map()
  for (const c of clients) {
    const nc = String(c.ncliente ?? "").trim()
    if (nc) nclienteCount.set(nc, (nclienteCount.get(nc) ?? 0) + 1)
    const dni = normalizeDni(c.dnicuit)
    if (dni) dniCount.set(dni, (dniCount.get(dni) ?? 0) + 1)
  }
  const duplicateNcliente = new Set(
    [...nclienteCount.entries()].filter(([, n]) => n > 1).map(([k]) => k)
  )
  const duplicateDni = new Set(
    [...dniCount.entries()].filter(([, n]) => n > 1).map(([k]) => k)
  )

  // Attach primary technology from active connection or latest
  for (const c of clients) {
    const conns = connectionsByClient.get(c.id) ?? []
    const active = conns.filter((x) => x.estado === "A")
    const source = active.length ? active : conns
    const tipo = source[0]?.tipo ?? null
    c.techRaw = tipo
    c.techFromConn = mapTechnology(tipo)
  }

  const ctx = { duplicateNcliente, duplicateDni, connectionsByClient }
  const classification = { IMPORTAR: 0, REVISAR: 0, NO_IMPORTAR: 0 }
  const classificationReasons = {}

  for (const c of clients) {
    const { bucket, reasons } = classifyClient(c, ctx)
    classification[bucket]++
    for (const r of reasons) {
      classificationReasons[r] = (classificationReasons[r] ?? 0) + 1
    }
  }

  // Client stats by estado
  const clientEstado = {}
  for (const c of clients) {
    clientEstado[c.estado] = (clientEstado[c.estado] ?? 0) + 1
  }

  // Missing fields
  const missing = {
    sin_direccion: clients.filter((c) => isBlank(c.domicilio)).length,
    sin_localidad: clients.filter((c) => isBlank(c.ciudad)).length,
    sin_telefono: clients.filter((c) => isBlank(c.telefono)).length,
    sin_dni: clients.filter((c) => isBlank(c.dnicuit)).length,
    sin_email: clients.filter((c) => isBlank(c.email)).length,
  }

  const duplicateNclienteCount = [...duplicateNcliente].length
  const duplicateDniRecords = [...dniCount.entries()]
    .filter(([, n]) => n > 1)
    .reduce((sum, [, n]) => sum + n, 0)

  // Technology from connections (active)
  const techConn = {}
  const techConnAll = {}
  for (const conn of connections) {
    const key = String(conn.tipo ?? "").trim() || "(vacío)"
    techConnAll[key] = (techConnAll[key] ?? 0) + 1
    if (conn.estado === "A") {
      techConn[key] = (techConn[key] ?? 0) + 1
    }
  }

  // Plans per client (via active connections)
  const planClientCount = new Map()
  for (const conn of connections) {
    if (conn.estado !== "A" || !conn.idclientes) continue
    const key = conn.plan || `(id ${conn.idplanes})`
    if (!planClientCount.has(key)) planClientCount.set(key, new Set())
    planClientCount.get(key).add(conn.idclientes)
  }

  const plansList = [...planClientCount.entries()]
    .map(([plan, set]) => ({ plan, clientes: set.size }))
    .sort((a, b) => b.clientes - a.clientes)

  // Localities
  const localityCount = new Map()
  for (const c of clients) {
    if (c.estado === "B") continue
    const loc = String(c.ciudad ?? "").trim() || "(sin localidad)"
    localityCount.set(loc, (localityCount.get(loc) ?? 0) + 1)
  }
  const localitiesList = [...localityCount.entries()]
    .map(([localidad, count]) => ({ localidad, clientes: count }))
    .sort((a, b) => b.clientes - a.clientes)

  // Normalized locality variants
  const localityVariants = new Map()
  for (const c of clients) {
    if (isBlank(c.ciudad)) continue
    const norm = normalizeLocality(c.ciudad)
    if (!localityVariants.has(norm)) localityVariants.set(norm, new Set())
    localityVariants.get(norm).add(String(c.ciudad).trim())
  }
  const inconsistentLocalities = [...localityVariants.entries()]
    .filter(([, variants]) => variants.size > 1)
    .map(([norm, variants]) => ({
      normalized: norm,
      variants: [...variants],
      count: variants.size,
    }))
    .sort((a, b) => b.variants.length - a.variants.length)

  // Orphans
  const orphanConnections = connections.filter(
    (c) => c.idclientes != null && !clientIds.has(c.idclientes)
  ).length
  const clientsWithoutConnections = clients.filter(
    (c) => !(connectionsByClient.get(c.id)?.length)
  ).length
  const activeClientsWithoutActiveConn = clients.filter((c) => {
    if (c.estado !== "A") return false
    const conns = connectionsByClient.get(c.id) ?? []
    return !conns.some((x) => x.estado === "A")
  }).length

  // Connection stats
  const connEstado = {}
  for (const c of connections) {
    connEstado[c.estado] = (connEstado[c.estado] ?? 0) + 1
  }

  // Suspended: clients A but all connections B? or estado P?
  const suspendedEstimate = clients.filter((c) => {
    if (c.estado !== "A") return false
    const conns = connectionsByClient.get(c.id) ?? []
    return conns.length > 0 && conns.every((x) => x.estado === "B")
  }).length

  const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0)

  const report = {
    meta: {
      dumpPath: DUMP_PATH,
      fileSizeMb: Number(
        (fs.statSync(DUMP_PATH).size / (1024 * 1024)).toFixed(2)
      ),
      tablesInDump: Object.keys(tableCounts).sort(),
    },
    totales: {
      registros_insertados: totalRecords,
      por_tabla: tableCounts,
      auto_increment_estimado: autoIncrements,
      clientes: clients.length,
      conexiones: connections.length,
      planes_catalogo: plans.length,
      tickets: tableCounts.ticket ?? 0,
      prefacturaciones: tableCounts.prefacturaciones ?? 0,
      recaudaciones: tableCounts.recaudaciones ?? 0,
      chatbots: tableCounts.chatbots ?? 0,
    },
    clientes: {
      total: clients.length,
      por_estado: clientEstado,
      activos_A: clientEstado.A ?? 0,
      baja_B: clientEstado.B ?? 0,
      otros_estados: Object.fromEntries(
        Object.entries(clientEstado).filter(([k]) => k !== "A" && k !== "B")
      ),
      suspendidos_estimado_cliente_A_conexion_B: suspendedEstimate,
      duplicados_ncliente: duplicateNclienteCount,
      registros_con_ncliente_duplicado: [...duplicateNcliente].reduce(
        (s, nc) => s + nclienteCount.get(nc),
        0
      ),
      duplicados_dni_grupos: [...duplicateDni].length,
      registros_con_dni_duplicado: duplicateDniRecords,
      campos_vacios: missing,
      prueba_test: clients.filter((c) => isTestName(c.nombre)).length,
      observ_con_baja: clients.filter((c) =>
        String(c.observ ?? "").toLowerCase().includes("baja")
      ).length,
    },
    conexiones: {
      total: connections.length,
      por_estado: connEstado,
      activas_A: connEstado.A ?? 0,
      baja_B: connEstado.B ?? 0,
      huerfanas_sin_cliente: orphanConnections,
    },
    tecnologia: {
      conexiones_activas_por_tipo: techConn,
      todas_las_conexiones_por_tipo: techConnAll,
      mapeo_bespoke: {
        fiber: (techConn.Fibra ?? 0) + (techConn.fibra ?? 0),
        wireless: techConn.Wireless ?? 0,
        otros: Object.entries(techConn)
          .filter(([k]) => !["Fibra", "Wireless", "fibra"].includes(k))
          .reduce((s, [, n]) => s + n, 0),
      },
    },
    planes: {
      catalogo: plans.map((p) => ({
        id: p.id,
        codigo: p.identplan,
        nombre: p.nombre,
        precio: p.precio,
        estado: p.estado,
      })),
      clientes_por_plan_conexion_activa: plansList,
    },
    localidades: {
      top_25: localitiesList.slice(0, 25),
      total_variantes_raw: localityCount.size,
      inconsistencias_normalizacion: inconsistentLocalities.slice(0, 15),
    },
    depuracion: {
      clientes_sin_conexion: clientsWithoutConnections,
      clientes_activos_sin_conexion_activa: activeClientsWithoutActiveConn,
      clasificacion: classification,
      motivos_no_importar_revisar: classificationReasons,
      estimacion_migracion_final: {
        importar_directo: classification.IMPORTAR,
        revisar_manual: classification.REVISAR,
        no_importar: classification.NO_IMPORTAR,
        estimado_final_conservador: classification.IMPORTAR,
        estimado_final_optimista:
          classification.IMPORTAR +
          Math.round(classification.REVISAR * 0.7),
        estimado_final_con_revision:
          classification.IMPORTAR +
          Math.round(classification.REVISAR * 0.75),
      },
    },
    relaciones: {
      clientes_idclientes_pk: true,
      conexiones_idclientes_fk: "idclientes → clientes.idclientes (lógico, sin FK explícita en dump)",
      conexiones_idplanes_fk: "idplanes → planes.idplanes",
      conexiones_idnodos_fk: "idnodos → nodos",
      ticket_fk: "ticket.idclientes → clientes, ticket.idconexiones → conexiones",
      prefacturaciones_idcliente: "idcliente → clientes (sin FK en dump)",
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main()
