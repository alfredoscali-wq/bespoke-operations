export const NETWORK_TARGET_DECRYPT_ERROR =
  "No se pudo descifrar la credencial del destino."

export function isNetworkTargetDecryptError(
  message: string | null | undefined
): boolean {
  return message?.trim() === NETWORK_TARGET_DECRYPT_ERROR
}
