import fs from "node:fs"
import path from "node:path"

const projectRoot = process.cwd()
const sourceDir = path.join(projectRoot, ".next", "types")
const targetDir = path.join(projectRoot, ".next", "dev", "types")

if (!fs.existsSync(sourceDir)) {
  process.exit(0)
}

fs.mkdirSync(targetDir, { recursive: true })

for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".ts")) {
    continue
  }

  fs.copyFileSync(
    path.join(sourceDir, entry.name),
    path.join(targetDir, entry.name)
  )
}
