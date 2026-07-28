/**
 * Convert mammoth docx → markdown for MASTER_PROJECT_CONTEXT.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const inputPath = path.join(root, "docs/MASTER_PROJECT_CONTEXT.raw.md")
const outputPath = path.join(root, "docs/MASTER_PROJECT_CONTEXT.md")

const FOOTER = `---

## FIN DEL DOCUMENTO

**BESPOKE OPERATIONS — MASTER PROJECT CONTEXT — VERSIÓN 1.0**

**Estado del proyecto:** DESARROLLO ACTIVO

**Arquitectura:** CONSOLIDADA

**Próximo objetivo:** Presence Engine Backend → Reporting Engine → Automation Engine.

Este es el contexto oficial del proyecto. A partir de este documento trabajaremos siempre sobre esta base.`

function unescape(text) {
  return text
    .replace(/\\#/g, "#")
    .replace(/\\\*/g, "*")
    .replace(/\\-/g, "-")
    .replace(/\\\./g, ".")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\_/g, "_")
}

function nextNonEmptyLine(lines, start) {
  for (let j = start; j < lines.length; j += 1) {
    const value = lines[j].trim()
    if (value) return value
  }
  return null
}

function isSectionTitle(line) {
  return /^\d+\.\s+[A-ZÁÉÍÓÚÑ0-9]/.test(line.trim())
}

function isSubsectionTitle(line) {
  return /^\d+\.\d+\s+/.test(line.trim())
}

function isBullet(line) {
  const t = line.trim()
  return t.startsWith("•") || /^-\s+\S/.test(t)
}

function isDashDivider(line) {
  return /^-{10,}$/.test(line.trim())
}

function isEqDivider(line) {
  return /^={10,}$/.test(line.trim())
}

function normalizeBullet(line) {
  const t = line.trim()
  return t.startsWith("•") ? `- ${t.slice(1).trim()}` : t
}

function preprocessSections(text) {
  const lines = text.split(/\r?\n/)
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()

    if (!line) {
      i += 1
      continue
    }

    const next = nextNonEmptyLine(lines, i + 1)
    if (isSectionTitle(line) && next && isEqDivider(next)) {
      out.push("")
      out.push(`## ${line}`)
      out.push("")
      i += 1
      continue
    }

    if (isEqDivider(line)) {
      i += 1
      const inner = []
      while (i < lines.length && !isEqDivider(lines[i].trim())) {
        if (lines[i].trim()) inner.push(lines[i].trim())
        i += 1
      }
      if (i < lines.length) i += 1

      if (inner.length === 1 && isSectionTitle(inner[0])) {
        out.push("")
        out.push(`## ${inner[0]}`)
        out.push("")
        continue
      }

      const joined = inner.join(" ")

      if (/FIN DEL DOCUMENTO/i.test(joined)) {
        out.push(FOOTER)
        continue
      }

      if (/PARTE 3/i.test(joined)) {
        out.push("")
        out.push("---")
        out.push("")
        out.push("# PARTE 3 — ENGINE ARCHITECTURE")
        out.push("")
        out.push("**Versión:** 1.0  ")
        out.push("**Fecha:** 27/07/2026")
        out.push("")
        continue
      }

      if (/PARTE 2/i.test(joined)) {
        out.push("")
        out.push("---")
        out.push("")
        out.push("# PARTE 2 — ESTADO FUNCIONAL DE LOS MÓDULOS")
        out.push("")
        out.push("**Versión:** 1.0  ")
        out.push("**Fecha:** 27/07/2026")
        out.push("")
        continue
      }

      if (
        /BESPOKE OPERATIONS/i.test(joined) &&
        /MASTER PROJECT CONTEXT/i.test(joined) &&
        !/PARTE [23]/i.test(joined) &&
        !/FIN DEL DOCUMENTO/i.test(joined)
      ) {
        continue
      }

      if (inner.length > 0) {
        out.push("")
        out.push(...inner)
        out.push("")
      }
      continue
    }

    out.push(line)
    i += 1
  }

  return out.join("\n")
}

function convertBody(lines) {
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      i += 1
      continue
    }

    if (line.startsWith("#") || line.startsWith(">") || line.startsWith("---")) {
      out.push(line)
      i += 1
      continue
    }

    if (isSectionTitle(line)) {
      out.push("")
      out.push(`## ${line}`)
      out.push("")
      i += 1
      continue
    }

    if (isDashDivider(line)) {
      out.push("")
      out.push("---")
      out.push("")
      i += 1
      continue
    }

    if (isSubsectionTitle(line)) {
      out.push("")
      out.push(`### ${line}`)
      out.push("")
      i += 1
      continue
    }

    if (isBullet(line)) {
      out.push("")
      while (i < lines.length && isBullet(lines[i].trim())) {
        out.push(normalizeBullet(lines[i].trim()))
        i += 1
      }
      out.push("")
      continue
    }

    if (/^\d+\.\s+[a-záéíóúñ]/.test(line)) {
      out.push("")
      while (i < lines.length) {
        const current = lines[i].trim()
        if (!current) break
        if (current === "↓" || /^\d+\.\s+[a-záéíóúñ]/.test(current)) {
          out.push(current)
          i += 1
          continue
        }
        break
      }
      out.push("")
      continue
    }

    if (line === "↓") {
      out.push("")
      out.push("↓")
      out.push("")
      i += 1
      continue
    }

    if (/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s/()-]+:$/.test(line) && i + 1 < lines.length) {
      const label = line.slice(0, -1)
      i += 1
      const values = []
      while (i < lines.length) {
        const current = lines[i].trim()
        if (
          !current ||
          isDashDivider(current) ||
          isSectionTitle(current) ||
          isSubsectionTitle(current) ||
          isBullet(current) ||
          current.startsWith("#") ||
          current.startsWith("---") ||
          /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s/()-]+:$/.test(current)
        ) {
          break
        }
        values.push(current)
        i += 1
      }

      out.push("")
      if (values.length === 0) {
        out.push(`**${label}:**`)
      } else if (values.length === 1 && values[0].length < 100) {
        out.push(`**${label}:** ${values[0]}`)
      } else if (values.every((v) => v.length < 60 && !v.endsWith("."))) {
        out.push(`**${label}:**`)
        out.push("")
        values.forEach((v) => out.push(`- ${v}`))
      } else {
        out.push(`**${label}:**`)
        out.push("")
        out.push(values.join(" ").replace(/\s+/g, " ").trim())
      }
      out.push("")
      continue
    }

    const paragraph = []
    while (i < lines.length) {
      const current = lines[i].trim()
      if (
        !current ||
        isDashDivider(current) ||
        isSectionTitle(current) ||
        isSubsectionTitle(current) ||
        isBullet(current) ||
        current.startsWith("#") ||
        current.startsWith(">") ||
        current.startsWith("---") ||
        current === "↓" ||
        /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s/()-]+:$/.test(current) ||
        /^\d+\.\s+[a-záéíóúñ]/.test(current)
      ) {
        break
      }
      paragraph.push(current)
      i += 1
    }

    if (paragraph.length) {
      out.push("")
      out.push(paragraph.join(" ").replace(/\s+/g, " ").trim())
      out.push("")
    } else {
      i += 1
    }
  }

  return out
}

function normalizeHeader(text) {
  return text.replace(
    /^# Bespoke Operations\r?\n## Master Project Context\r?\n\r?\n\*\*Versión:\*\*[^\n]+/,
    `# Bespoke Operations

## Master Project Context

**Versión:** 1.0

**Última actualización:** 27/07/2026

**Estado:** Desarrollo Activo`
  )
}

function convert(input) {
  const text = preprocessSections(unescape(input))
  const lines = text.split(/\r?\n/)
  const body = convertBody(lines)
  let result = normalizeHeader(body.join("\n").replace(/\n{3,}/g, "\n\n").trim())

  if (!result.includes("## FIN DEL DOCUMENTO")) {
    result = `${result}\n\n${FOOTER}`
  }

  return `${result.trim()}\n`
}

if (!fs.existsSync(inputPath)) {
  console.error(`Missing ${inputPath}`)
  process.exit(1)
}

const markdown = convert(fs.readFileSync(inputPath, "utf8"))
fs.writeFileSync(outputPath, markdown, "utf8")
console.log(`Wrote ${outputPath} (${markdown.length} chars)`)
