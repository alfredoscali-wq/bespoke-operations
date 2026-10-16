import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"

/**
 * Número visible en la interfaz.
 * CLI-005788 se muestra como 5788. No reemplaza la clave guardada ni el identificador enviado a una API.
 */
export function presentCustomerNumber(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return ""
  const cli = /^CLI-(\d+)$/i.exec(trimmed)
  if (cli) {
    const stripped = cli[1].replace(/^0+/, "")
    return stripped || "0"
  }
  return abnetNumberFromExternalCode(trimmed) ?? trimmed
}
